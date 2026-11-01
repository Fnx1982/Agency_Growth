/**
 * Molina Growth: Worker (backend)
 *
 * Os arquivos do site (index.html, style.css, app.js, imagens) são servidos automaticamente pela Cloudflare.
 * Este Worker só responde às rotas /api/*:
 *
 *   GET  /api/config                 -> configurações públicas (e-mail de contato, link de agenda)
 *   POST /api/checkout               -> cria a sessão de pagamento na Stripe (preço calculado AQUI, nunca no navegador)
 *   GET  /api/order-status?id=       -> status de um pagamento (usado quando o cliente volta da Stripe)
 *   POST /api/webhook                -> Stripe avisa pagamento concluído -> e-mail para a equipe
 *   POST /api/quote                  -> formulário de plano personalizado -> e-mail para a equipe
 *   POST /api/contact                -> mensagem do "Contact us" -> e-mail para a equipe
 */
import { PRICES, PLAN_NAMES, totalMinor } from "./prices.js";
import { stripe, isTestKey, isLiveKey, validSignature } from "./stripe-api.js";
import { sendPaidEmail, sendQuoteEmail, sendContactEmail } from "./email.js";
import { json, clean, EMAIL_RE } from "./utils.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = request.method + " " + url.pathname;
    try {
      switch (route) {
        case "GET /api/config":       return config(env);
        case "POST /api/checkout":    return await createCheckout(request, env, url);
        case "GET /api/order-status": return await orderStatus(url, env);
        case "POST /api/webhook":     return await webhook(request, env, ctx);
        case "POST /api/quote":       return await quote(request, env);
        case "POST /api/contact":     return await contact(request, env);
      }
      // Qualquer outra coisa: arquivos do site (ou 404)
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err?.stack || err);
      // Em modo de teste (ou sem chave), mostra o motivo real para facilitar a configuração.
      // Com a chave real (sk_live_) o cliente vê só a mensagem genérica.
      const detail = !isLiveKey(env) ? ` [${err?.message || err}]` : "";
      return json({ error: "Something went wrong on our side. Please try again in a minute." + detail }, 500);
    }
  },
};

/* ---------------- config pública ---------------- */
function config(env) {
  const key = String(env.STRIPE_SECRET_KEY || "");
  return json({
    // "setup" ajuda a conferir a configuração sem expor nenhuma chave
    setup: {
      stripeKey: !key ? "FALTANDO" : key.startsWith("sk_test_") ? "ok (teste)" : key.startsWith("sk_live_") ? "ok (real)"
        : key.startsWith("pk_") ? "ERRADA: essa é a chave pública (pk_), use a secreta (sk_)" : key.startsWith("rk_") ? "ok (restrita)" : "ERRADA: não parece uma chave da Stripe",
      webhookSecret: !env.STRIPE_WEBHOOK_SECRET ? "FALTANDO" : String(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_") ? "ok" : "ERRADA: deve começar com whsec_",
      resendKey: !env.RESEND_API_KEY ? "FALTANDO" : String(env.RESEND_API_KEY).startsWith("re_") ? "ok" : "ERRADA: deve começar com re_",
      teamEmail: env.TEAM_EMAIL || "FALTANDO",
    },
    testMode: isTestKey(env),
    contactEmail: env.CONTACT_EMAIL || "",
  });
}

/* ---------------- criar pagamento ---------------- */
async function createCheckout(request, env, url) {
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "Invalid request." }, 400);

  const region = b.region in PRICES ? b.region : null;
  const plan = b.plan in PLAN_NAMES ? b.plan : null;
  const months = Number(b.months);
  const amount = region && plan ? totalMinor(region, plan, months) : null;
  if (!amount) return json({ error: "Choose a valid plan and length." }, 400);
  if (b.agree !== true) return json({ error: "Accept the terms to continue." }, 400);

  const r = PRICES[region];
  const planName = `${PLAN_NAMES[plan]}, ${months} ${months === 1 ? "month" : "months"}`;
  const site = url.origin;

  const session = await stripe(env, "/checkout/sessions", {
    method: "POST",
    params: {
      mode: "payment",
      locale: "en",
      success_url: `${site}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?cancelled=1`,
      // As formas de pagamento (cartão, Apple Pay, Google Pay) são escolhidas no painel da Stripe:
      // Settings > Payment methods. Pix e boleto não aparecem porque só funcionam em reais (BRL).
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      submit_type: "pay",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: r.currency.toLowerCase(),
          unit_amount: amount,
          product_data: {
            name: `Molina Growth ${planName}`,
            description: `${r.label} plan, paid upfront. Advertising spend is not included.`,
          },
        },
      }],
      custom_fields: [
        { key: "business", label: { type: "custom", custom: "Business name" }, type: "text" },
        { key: "website", label: { type: "custom", custom: "Website or Google profile" }, type: "text", optional: true },
      ],
      metadata: { plan, months: String(months), region },
      payment_intent_data: {
        description: `Molina Growth ${planName} (${r.label})`,
        metadata: { plan, months: String(months), region },
      },
    },
  });

  return json({ url: session.url });
}

/* ---------------- status (quando o cliente volta da Stripe) ---------------- */
async function orderStatus(url, env) {
  const id = url.searchParams.get("id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Invalid payment reference." }, 400);
  const s = await stripe(env, "/checkout/sessions/" + id);
  return json({
    paid: s.payment_status === "paid",
    status: s.status,
    name: s.customer_details?.name || "",
    email: s.customer_details?.email || "",
    amount: s.amount_total,
    currency: s.currency,
    plan: s.metadata?.plan || "",
    months: s.metadata?.months || "",
  });
}

/* ---------------- webhook ---------------- */
async function webhook(request, env, ctx) {
  const raw = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook secret not configured" }, 500);
  const ok = await validSignature(raw, request.headers.get("Stripe-Signature") || "", env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Bad signature" }, 400);

  let evt;
  try { evt = JSON.parse(raw); } catch (_) { return json({ error: "Bad payload" }, 400); }

  const session = evt.data?.object;
  const paidNow =
    (evt.type === "checkout.session.completed" && session?.payment_status === "paid") ||
    evt.type === "checkout.session.async_payment_succeeded";
  if (!paidNow) return json({ received: true, ignored: evt.type });

  ctx.waitUntil(sendPaidEmail(session, env, isTestKey(env)).catch((e) => console.error("email", e)));
  return json({ received: true });
}

/* ---------------- mensagem do Contact us ---------------- */
async function contact(request, env) {
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "Invalid request." }, 400);
  if (b.mg_trap) { console.log("contact: honeypot preenchido, ignorado"); return json({ ok: true }); }
  const d = {
    name: clean(b.name, 120), email: clean(b.email, 160), phone: clean(b.phone, 40),
    message: String(b.message ?? "").replace(/\r/g, "").trim().slice(0, 4000),
    region: b.region === "us" ? "EUA" : "UK",
  };
  if (!d.name || !EMAIL_RE.test(d.email) || !d.message) return json({ error: "Add your name, a valid email and your message." }, 400);
  await sendContactEmail(d, env);
  return json({ ok: true });
}

/* ---------------- orçamento personalizado ---------------- */
async function quote(request, env) {
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "Invalid request." }, 400);
  if (b.mg_trap) { console.log("quote: honeypot preenchido, ignorado"); return json({ ok: true }); } // campo invisível: se veio preenchido é robô

  const d = {
    name: clean(b.name, 120), business: clean(b.business, 120), email: clean(b.email, 160),
    phone: clean(b.phone, 40), website: clean(b.website, 200), message: clean(b.message, 3000),
    region: b.region === "us" ? "EUA" : "UK",
    services: Array.isArray(b.services) ? b.services.slice(0, 20).map((s) => clean(s, 60)) : [],
  };
  if (!d.name || !d.business || !EMAIL_RE.test(d.email))
    return json({ error: "Add your name, business and a valid email." }, 400);

  await sendQuoteEmail(d, env);
  return json({ ok: true });
}