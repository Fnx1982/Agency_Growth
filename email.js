/**
 * E-mails para a EQUIPE, enviados pelo Resend (https://resend.com).
 *
 * Sem domínio próprio, o Resend só envia a partir de onboarding@resend.dev e SOMENTE para o
 * e-mail com que você criou a conta no Resend. Por isso TEAM_EMAIL tem que ser esse e-mail.
 * O recibo do CLIENTE é enviado pela própria Stripe (ative em Configurações > E-mails de clientes).
 */
import { PLAN_NAMES } from "./prices.js";
import { h, fmt } from "./utils.js";

/* ---------------- envio ---------------- */
export async function sendMail(env, msg) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  const to = teamList(env);
  if (!to.length) throw new Error("TEAM_EMAIL não configurado");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Molina Growth <onboarding@resend.dev>", to, ...msg }),
  });
  if (!res.ok) throw new Error("Resend " + res.status + ": " + (await res.text()));
}

export const teamList = (env) => String(env.TEAM_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);

/* ---------------- peças de layout ---------------- */
const wrap = (inner) => '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#000">' + inner + "</div>";

const button = (href, label, dark) =>
  `<a href="${h(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:700;` +
  (dark ? "background:#000;color:#E3E3DF" : "background:#E3E3DF;color:#000;border:1.5px solid #000") + `">${h(label)}</a>`;

const table = (rows, labelWidth = 140) =>
  '<table style="border-collapse:collapse;width:100%;margin-top:14px;font-size:14px">' +
  rows.map(([k, v]) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#555;width:${labelWidth}px">${h(k)}</td>` +
    `<td style="padding:8px;border-bottom:1px solid #ddd"><b>${h(v || "-")}</b></td></tr>`).join("") +
  "</table>";

/* ---------------- pagamento concluído ---------------- */
export async function sendPaidEmail(session, env, testMode) {
  const m = session.metadata || {};
  const c = session.customer_details || {};
  const field = (key) => (session.custom_fields || []).find((f) => f.key === key)?.text?.value || "";
  const name = c.name || "Client";
  const first = name.split(" ")[0];
  const email = c.email || "";
  const phone = c.phone || "";
  const amount = fmt(session.amount_total, String(session.currency || "").toUpperCase());
  const planName = `${PLAN_NAMES[m.plan] || m.plan}, ${m.months} ${m.months === "1" ? "month" : "months"}`;
  const regionLabel = m.region === "us" ? "EUA" : "UK";
  const a = c.address || {};
  const address = [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ");
  const phoneDigits = phone.replace(/\D/g, "");

  // Mensagem pronta para a equipe mandar ao cliente (e-mail ou WhatsApp)
  const replySubject = `Molina Growth: your ${planName} plan, next steps`;
  const replyBody =
    `Hi ${first}! This is the Molina Growth team. Thank you for purchasing the ${planName} plan. ` +
    `To get started, we'll need access to your Google Ads and/or Meta Ads accounts, and we'll send you a short ` +
    `step-by-step guide for that shortly. Any questions, just reply here.`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`;
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(replyBody)}` : "";
  const dashboard = `https://dashboard.stripe.com/${testMode ? "test/" : ""}payments/${session.payment_intent || ""}`;

  await sendMail(env, {
    reply_to: email || undefined,
    subject: `${testMode ? "[TESTE] " : ""}Pagamento recebido: ${planName} ${regionLabel}, ${amount} (${name})`,
    html: wrap(
      (testMode ? '<p style="background:#fff3cd;padding:8px 12px;border-radius:4px">Pagamento de TESTE, nenhum dinheiro real.</p>' : "") +
      `<h2 style="margin:0 0 6px">Novo pagamento: ${h(amount)}</h2>` +
      '<p style="margin:0 0 18px;color:#555">Entrar em contato com o cliente e enviar o passo a passo de acesso às contas de anúncio.</p>' +
      button(mailto, "Responder por e-mail", true) +
      (whatsapp ? button(whatsapp, "Chamar no WhatsApp") : "") +
      button(dashboard, "Abrir na Stripe") +
      table([
        ["Plano", `${planName} (${regionLabel})`],
        ["Valor pago", amount],
        ["Cliente", name],
        ["Empresa", field("business")],
        ["E-mail", email],
        ["Telefone", phone],
        ["Site", field("website")],
        ["Endereço", address],
        ["Referência", session.id],
        ["Data", new Date((session.created || Date.now() / 1000) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
      ]),
    ),
  });
}

/* ---------------- pedido de orçamento ---------------- */
export async function sendQuoteEmail(d, env) {
  const first = d.name.split(" ")[0];
  const replySubject = "Molina Growth: your custom plan";
  const replyBody =
    `Hi ${first}! This is the Molina Growth team. Thank you for your interest in a custom plan` +
    (d.services.length ? ` (${d.services.join(", ")})` : "") +
    `. We're reviewing your request and will send you a tailored proposal shortly. Any questions, just reply here.`;
  const mailto = `mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`;
  const phoneDigits = String(d.phone || "").replace(/\D/g, "");
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(replyBody)}` : "";

  await sendMail(env, {
    reply_to: d.email,
    subject: `Pedido de plano personalizado (${d.region}): ${d.business}`,
    html: wrap(
      '<h2 style="margin:0 0 6px">Novo pedido de plano personalizado</h2>' +
      '<p style="margin:0 0 18px;color:#555">Montar a proposta e responder o cliente.</p>' +
      button(mailto, "Responder por e-mail", true) +
      (whatsapp ? button(whatsapp, "Chamar no WhatsApp") : "") +
      table([
        ["Região", d.region], ["Nome", d.name], ["Empresa", d.business], ["E-mail", d.email],
        ["Telefone", d.phone], ["Site", d.website], ["Serviços", d.services.join(", ")],
      ], 120) +
      `<p style="margin:16px 0 4px;color:#555">Mensagem do cliente:</p><p style="white-space:pre-wrap;margin:0">${h(d.message || "(sem mensagem)")}</p>`,
    ),
  });
}

/* ---------------- mensagem do Contact us ---------------- */
export async function sendContactEmail(d, env) {
  const first = d.name.split(" ")[0];
  const replyBody = `Hi ${first}! This is the Molina Growth team. Thank you for your message. `;
  const mailto = `mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent("Re: your message to Molina Growth")}&body=${encodeURIComponent(replyBody)}`;
  const phoneDigits = String(d.phone || "").replace(/\D/g, "");
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(replyBody)}` : "";

  await sendMail(env, {
    reply_to: d.email,
    subject: `Mensagem pelo site (${d.region}): ${d.name}`,
    html: wrap(
      '<h2 style="margin:0 0 6px">Nova mensagem pelo site</h2>' +
      '<p style="margin:0 0 18px;color:#555">Enviada pelo botão "Send us a message" do Contact us.</p>' +
      button(mailto, "Responder por e-mail", true) +
      (whatsapp ? button(whatsapp, "Chamar no WhatsApp") : "") +
      table([["Região", d.region], ["Nome", d.name], ["E-mail", d.email], ["Telefone", d.phone]], 120) +
      `<p style="margin:16px 0 4px;color:#555">Mensagem:</p><p style="white-space:pre-wrap;margin:0">${h(d.message)}</p>`,
    ),
  });
}