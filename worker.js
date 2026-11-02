/**
 * Molina Growth: Worker (backend)
 *
 * Os arquivos do site são servidos automaticamente pela Cloudflare. Este Worker responde às rotas /api/*:
 *
 *   GET  /api/config                 -> configurações públicas + conferência das chaves
 *   POST /api/checkout               -> registra o contrato assinado e cria o pagamento na Stripe
 *                                       (à vista = pagamento único com desconto; mensal = assinatura sem desconto)
 *   GET  /api/order-status?id=       -> status do pagamento (quando o cliente volta da Stripe)
 *   GET  /api/agreement?id=          -> dados do contrato assinado (para a página agreement.html)
 *   POST /api/webhook                -> avisos da Stripe: pagamento, parcela paga/falhou, assinatura encerrada
 *   POST /api/quote                  -> formulário de plano personalizado -> e-mail para a equipe
 *   POST /api/contact                -> mensagem do "Contact us" -> e-mail para a equipe
 *
 * Tarefa diária (Cron Trigger, ver wrangler.toml): cancela assinaturas com parcela em atraso há 90 dias.
 */
import { PRICES, PLAN_NAMES, DISCOUNTS, UNPAID_CANCEL_DAYS } from "./prices.js";
import { CONTRACT_VERSION } from "./contracts.js";
import { planTerms } from "./plan-terms.js";
import { stripe, isTestKey, isLiveKey, validSignature } from "./stripe-api.js";
import { sendPaidEmail, sendQuoteEmail, sendContactEmail, sendSubscriptionEmail } from "./email.js";
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
        case "GET /api/agreement":    return await agreement(url, env);
        case "POST /api/webhook":     return await webhook(request, env, url);
        case "POST /api/quote":       return await quote(request, env);
        case "POST /api/contact":     return await contact(request, env);
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err?.stack || err);
      // Em modo de teste mostra o motivo real; com a chave real (sk_live_) o cliente vê só a mensagem genérica.
      const detail = !isLiveKey(env) ? ` [${err?.message || err}]` : "";
      return json({ error: "Something went wrong on our side. Please try again in a minute." + detail }, 500);
    }
  },

  // Roda uma vez por dia (wrangler.toml > [triggers]).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cancelLongUnpaid(env).catch((e) => console.error("cron", e?.stack || e)));
  },
};

/* ---------------- config pública ---------------- */
function config(env) {
  const key = String(env.STRIPE_SECRET_KEY || "");
  return json({
    setup: {
      stripeKey: !key ? "FALTANDO" : key.startsWith("sk_test_") ? "ok (teste)" : key.startsWith("sk_live_") ? "ok (real)"
        : key.startsWith("pk_") ? "ERRADA: essa é a chave pública (pk_), use a secreta (sk_)" : key.startsWith("rk_") ? "ok (restrita)" : "ERRADA: não parece uma chave da Stripe",
      webhookSecret: !env.STRIPE_WEBHOOK_SECRET ? "FALTANDO" : String(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_") ? "ok" : "ERRADA: deve começar com whsec_",
      resendKey: !env.RESEND_API_KEY ? "FALTANDO" : String(env.RESEND_API_KEY).startsWith("re_") ? "ok" : "ERRADA: deve começar com re_",
      teamEmail: env.TEAM_EMAIL || "FALTANDO",
      mailFrom: env.MAIL_FROM || "onboarding@resend.dev (padrão)",
    },
    testMode: isTestKey(env),
    contactEmail: env.CONTACT_EMAIL || "",
  });
}

/* ---------------- checkout: contrato assinado + pagamento ---------------- */
async function createCheckout(request, env, url) {
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "Invalid request." }, 400);

  const region = b.region in PRICES ? b.region : null;
  const plan = b.plan in PLAN_NAMES ? b.plan : null;
  const months = Number(b.months);
  const billing = b.billing === "monthly" && months > 1 ? "monthly" : "upfront";
  if (!region || !plan || !(months in DISCOUNTS)) return json({ error: "Choose a valid plan and length." }, 400);

  // Dados do cliente (cadastro prévio) — vão para o contrato
  const c = b.client || {};
  const d = {
    legal_name: clean(c.legal_name, 160), reg_no: clean(c.reg_no, 80),
    street: clean(c.street, 160), city: clean(c.city, 80), postcode: clean(c.postcode, 20), country: clean(c.country, 60),
    rep_name: clean(c.rep_name, 120), rep_title: clean(c.rep_title, 80), email: clean(c.email, 160),
    phone: clean(c.phone, 40), website: clean(c.website, 200), sig_name: clean(c.sig_name, 120),
  };
  const missing = ["legal_name", "street", "city", "postcode", "country", "rep_name", "rep_title", "sig_name"].filter((k) => !d[k]);
  if (missing.length) return json({ error: "Fill in all required business details and sign the agreement." }, 400);
  if (!EMAIL_RE.test(d.email)) return json({ error: "Enter a valid email address." }, 400);
  if (c.b2b !== true) return json({ error: "Confirm that you are buying for your business." }, 400);
  if (c.agree !== true) return json({ error: "Accept the agreement to continue." }, 400);

  const t = planTerms(region, plan, months, billing);
  const r = PRICES[region];
  const contract = CONTRACT_VERSION[region];
  const acceptedAt = new Date().toISOString();
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  const site = url.origin;

  // Registro da assinatura (prova do aceite) — fica salvo na Stripe junto com o pagamento
  const metadata = {
    plan, months: String(months), region, billing, plan_version: t.plan_version, contract,
    accepted_at: acceptedAt, ip: ip.slice(0, 60), sig_name: d.sig_name, b2b: "yes",
    legal_name: d.legal_name, reg_no: d.reg_no || "", address: [d.street, d.city, d.postcode, d.country].join(", ").slice(0, 480),
    rep_name: d.rep_name, rep_title: d.rep_title, email: d.email, phone: d.phone || "", website: d.website || "",
  };

  const productName = `Molina Growth ${PLAN_NAMES[plan]}, ${months} ${months === 1 ? "month" : "months"}${billing === "monthly" ? " (monthly)" : ""}`;
  const common = {
    locale: "en",
    customer_email: d.email,
    billing_address_collection: "auto",
    success_url: `${site}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/?cancelled=1`,
    metadata,
  };

  const params = billing === "monthly"
    ? {
        ...common,
        mode: "subscription",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: r.currency.toLowerCase(),
            unit_amount: t.per_minor,
            recurring: { interval: "month" },
            product_data: { name: productName, description: `${r.label} plan, ${months} monthly payments, then ends automatically. Advertising spend is not included.` },
          },
        }],
        subscription_data: { description: `${productName} (${r.label})`, metadata },
      }
    : {
        ...common,
        mode: "payment",
        submit_type: "pay",
        customer_creation: "always",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: r.currency.toLowerCase(),
            unit_amount: t.total_minor,
            product_data: { name: productName, description: `${r.label} plan, paid upfront. Advertising spend is not included.` },
          },
        }],
        payment_intent_data: {
          description: `${productName} (${r.label})`,
          metadata: { plan, months: String(months), region, billing, legal_name: d.legal_name, contract },
        },
      };

  const session = await stripe(env, "/checkout/sessions", { method: "POST", params });
  return json({ url: session.url });
}

/* ---------------- status (quando o cliente volta da Stripe) ---------------- */
async function orderStatus(url, env) {
  const id = url.searchParams.get("id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Invalid payment reference." }, 400);
  const s = await stripe(env, "/checkout/sessions/" + id);
  const m = s.metadata || {};
  return json({
    paid: s.payment_status === "paid",
    status: s.status,
    name: m.rep_name || s.customer_details?.name || "",
    email: m.email || s.customer_details?.email || "",
    amount: s.amount_total,
    currency: s.currency,
    plan: m.plan || "",
    months: m.months || "",
    billing: m.billing || "upfront",
    hasAgreement: Boolean(m.contract),
  });
}

/* ---------------- contrato assinado (para visualizar / baixar) ---------------- */
async function agreement(url, env) {
  const id = url.searchParams.get("id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Invalid agreement reference." }, 400);
  const s = await stripe(env, "/checkout/sessions/" + id);
  const m = s.metadata || {};
  if (!m.contract) return json({ error: "Agreement not found." }, 404);
  const t = planTerms(m.region, m.plan, Number(m.months), m.billing);
  return json({
    version: m.contract,
    paid: s.payment_status === "paid",
    data: {
      ...t,
      order_id: `${s.id} · ${m.plan_version}`,
      accepted_at: m.accepted_at ? new Date(m.accepted_at).toUTCString() : "",
      legal_name: m.legal_name, reg_no: m.reg_no, address: m.address,
      rep_name: m.rep_name, rep_title: m.rep_title, email: m.email,
      sig_name: m.sig_name, ip: m.ip,
    },
  });
}

/* ---------------- webhook da Stripe ---------------- */
async function webhook(request, env, url) {
  const raw = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook secret not configured" }, 500);
  const ok = await validSignature(raw, request.headers.get("Stripe-Signature") || "", env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Bad signature" }, 400);

  let evt;
  try { evt = JSON.parse(raw); } catch (_) { return json({ error: "Bad payload" }, 400); }
  const obj = evt.data?.object || {};
  const test = isTestKey(env);
  const site = url.origin;

  switch (evt.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const paid = evt.type === "checkout.session.async_payment_succeeded" || obj.payment_status === "paid";
      if (!paid) return json({ received: true, pending: true });
      let endsAt = null;
      if (obj.mode === "subscription" && obj.subscription) {
        endsAt = await scheduleEnd(env, obj.subscription, Number(obj.metadata?.months || 0));
      }
      await sendPaidEmail(obj, env, { test, site, endsAt, key: evt.id });
      return json({ received: true });
    }

    case "invoice.payment_failed": {
      const subId = invoiceSubscription(obj);
      if (!subId || obj.billing_reason === "subscription_create") return json({ received: true, ignored: true });
      const sub = await stripe(env, "/subscriptions/" + subId);
      const since = Number(sub.metadata?.unpaid_since || 0);
      if (!since) {
        // primeira falha: marca a data para contar os 3 meses
        await stripe(env, "/subscriptions/" + subId, { method: "POST", params: { metadata: { unpaid_since: String(Math.floor(Date.now() / 1000)) } } });
        await sendSubscriptionEmail("failed", sub, env, { test, site, invoice: obj, key: evt.id });
      }
      return json({ received: true });
    }

    case "invoice.paid": {
      const subId = invoiceSubscription(obj);
      if (!subId || obj.billing_reason === "subscription_create") return json({ received: true, ignored: true });
      const sub = await stripe(env, "/subscriptions/" + subId);
      if (Number(sub.metadata?.unpaid_since || 0)) {
        await stripe(env, "/subscriptions/" + subId, { method: "POST", params: { metadata: { unpaid_since: "" } } });
        await sendSubscriptionEmail("recovered", sub, env, { test, site, invoice: obj, key: evt.id });
      } else {
        await sendSubscriptionEmail("installment", sub, env, { test, site, invoice: obj, key: evt.id });
      }
      return json({ received: true });
    }

    case "customer.subscription.deleted": {
      const m = obj.metadata || {};
      if (m.cancel_reason === "nonpayment") return json({ received: true }); // e-mail já enviado pela tarefa diária
      const endedOnSchedule = obj.cancel_at && obj.canceled_at && Math.abs(obj.canceled_at - obj.cancel_at) < 3 * 86400;
      await sendSubscriptionEmail(endedOnSchedule ? "completed" : "cancelled", obj, env, { test, site, key: evt.id });
      return json({ received: true });
    }
  }
  return json({ received: true, ignored: evt.type });
}

/** Na API nova da Stripe a assinatura fica em invoice.parent.subscription_details. */
function invoiceSubscription(inv) {
  const s = inv.subscription || inv.parent?.subscription_details?.subscription;
  return typeof s === "string" ? s : s?.id || null;
}

/** Agenda o fim automático da assinatura depois de N parcelas. Retorna a data de término (ISO). */
async function scheduleEnd(env, subId, months) {
  if (!months) return null;
  const sub = await stripe(env, "/subscriptions/" + subId);
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000).toISOString(); // já agendado (webhook repetido)
  const anchor = sub.billing_cycle_anchor || sub.start_date || Math.floor(Date.now() / 1000);
  const cancelAt = addMonthsUTC(anchor, months) - 3600; // 1h antes da (N+1)ª cobrança
  await stripe(env, "/subscriptions/" + subId, { method: "POST", params: { cancel_at: String(cancelAt), proration_behavior: "none" } });
  return new Date(cancelAt * 1000).toISOString();
}

function addMonthsUTC(unixSeconds, months) {
  const d = new Date(unixSeconds * 1000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return Math.floor(d.getTime() / 1000);
}

/* ---------------- tarefa diária: cancelar após 90 dias sem pagar ---------------- */
async function cancelLongUnpaid(env) {
  const limit = UNPAID_CANCEL_DAYS * 86400;
  const now = Math.floor(Date.now() / 1000);
  for (const status of ["past_due", "unpaid"]) {
    const list = await stripe(env, `/subscriptions?status=${status}&limit=100`);
    for (const sub of list.data || []) {
      const since = Number(sub.metadata?.unpaid_since || 0);
      if (!since || now - since < limit) continue;
      await stripe(env, "/subscriptions/" + sub.id, { method: "POST", params: { metadata: { cancel_reason: "nonpayment" } } });
      await stripe(env, "/subscriptions/" + sub.id, { method: "DELETE" });
      await sendSubscriptionEmail("cancelled_nonpayment", sub, env, { test: isTestKey(env), key: "nonpay:" + sub.id });
      console.log("cron: assinatura cancelada por falta de pagamento", sub.id);
    }
  }
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
  if (b.mg_trap) { console.log("quote: honeypot preenchido, ignorado"); return json({ ok: true }); }

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