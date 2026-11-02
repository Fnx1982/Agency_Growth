/**
 * E-mails enviados pelo Resend (https://resend.com), remetente MAIL_FROM (hello@molinagrowthagency.com).
 *
 * Para a EQUIPE (TEAM_EMAIL, em português): pagamento recebido, parcela paga/falhou, cancelamentos,
 *   pedidos de plano personalizado e mensagens do Contact us.
 * Para o CLIENTE (em inglês): boas-vindas com o link do contrato assinado, aviso de parcela não paga
 *   (serviço pausado), pagamento regularizado, plano concluído e cancelamento por falta de pagamento.
 *   O recibo com o valor continua sendo enviado pela própria Stripe.
 *
 * Os formulários (Custom e Contact us) NÃO mandam e-mail automático para quem preencheu: qualquer
 * pessoa poderia digitar o e-mail de outra e usar o site para mandar spam, o que queima o domínio.
 */
import { PLAN_NAMES } from "./prices.js";
import { planTerms } from "./plan-terms.js";
import { h, fmt, EMAIL_RE } from "./utils.js";

/* ---------------- envio ---------------- */
/**
 * Envia um e-mail. Sem "to", vai para a equipe (TEAM_EMAIL).
 * "key" evita e-mail duplicado quando a Stripe reenvia o mesmo aviso (o Resend ignora a repetição por 24h).
 */
export async function sendMail(env, { to, key, ...msg }) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  const list = to ? [].concat(to) : teamList(env);
  if (!list.length) throw new Error("TEAM_EMAIL não configurado");
  const headers = { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = String(key).slice(0, 256);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({ from: env.MAIL_FROM || "Molina Growth <onboarding@resend.dev>", to: list, ...msg }),
  });
  if (!res.ok) throw new Error("Resend " + res.status + ": " + (await res.text()));
}

/** E-mail para o cliente: se falhar, só registra no log (não pode travar o aviso da equipe). */
async function toClient(env, email, msg) {
  if (!email || !EMAIL_RE.test(email)) return;
  try {
    await sendMail(env, { to: email, reply_to: replyTo(env), ...msg });
  } catch (e) {
    console.error("e-mail do cliente falhou", email, e?.message || e);
  }
}

const replyTo = (env) => env.REPLY_TO || env.CONTACT_EMAIL || teamList(env)[0];

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

/** Layout dos e-mails para o cliente: logo, conteúdo e rodapé com contato. */
const clientWrap = (test, inner) => wrap(
  (test ? '<p style="background:#fff3cd;padding:8px 12px;border-radius:4px">TEST payment, no real money was charged.</p>' : "") +
  '<p style="margin:0 0 18px;font-weight:700;letter-spacing:.02em">MOLINA GROWTH</p>' + inner +
  '<p style="margin:26px 0 0;padding-top:14px;border-top:1px solid #ddd;color:#555;font-size:13px">' +
  "Questions? Just reply to this email.<br>Molina Growth Agency · molinagrowthagency.com</p>");

/* ---------------- ajudantes ---------------- */
const fmtDateEn = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "-");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-");
const testBanner = (test) => (test ? '<p style="background:#fff3cd;padding:8px 12px;border-radius:4px">Pagamento de TESTE, nenhum dinheiro real.</p>' : "");
const planLabel = (m) => `${PLAN_NAMES[m.plan] || m.plan}, ${m.months} ${m.months === "1" ? "month" : "months"}`;
const regionLabel = (m) => (m.region === "us" ? "EUA" : "UK");
const firstName = (m) => String(m.rep_name || "there").split(" ")[0];

/** Botões "Responder por e-mail" e "Chamar no WhatsApp" com mensagem pronta para o cliente. */
function replyButtons(m, subject, body) {
  const mailto = `mailto:${encodeURIComponent(m.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const digits = String(m.phone || "").replace(/\D/g, "");
  return button(mailto, "Responder por e-mail", true) + (digits ? button(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, "Chamar no WhatsApp") : "");
}

function clientRows(m) {
  return [
    ["Empresa", m.legal_name], ["Registro / EIN", m.reg_no], ["Endereço", m.address],
    ["Representante", m.rep_name ? `${m.rep_name}${m.rep_title ? ", " + m.rep_title : ""}` : ""],
    ["E-mail", m.email], ["Telefone", m.phone], ["Site", m.website],
  ];
}

/* ---------------- pagamento concluído (à vista ou 1ª parcela) ---------------- */
export async function sendPaidEmail(session, env, { test, site, endsAt, key }) {
  const m = session.metadata || {};
  const monthly = m.billing === "monthly";
  const amount = fmt(session.amount_total, String(session.currency || "").toUpperCase());
  const plan = planLabel(m);
  const t = planTerms(m.region, m.plan, Number(m.months), m.billing);

  const replyBody =
    `Hi ${firstName(m)}! This is the Molina Growth team. Thank you for purchasing the ${plan} plan. ` +
    `To get started, we'll need access to your Google Ads and/or Meta Ads accounts, and we'll send you a short ` +
    `step-by-step guide for that shortly. Any questions, just reply here.`;
  const agreementUrl = `${site}/agreement.html?id=${encodeURIComponent(session.id)}`;
  const dashboard = `https://dashboard.stripe.com/${test ? "test/" : ""}${monthly ? "subscriptions/" + (session.subscription || "") : "payments/" + (session.payment_intent || "")}`;

  await sendMail(env, {
    key: key && key + ":team",
    reply_to: m.email || undefined,
    subject: `${test ? "[TESTE] " : ""}Pagamento recebido: ${plan} ${regionLabel(m)}, ${monthly ? "1ª parcela " : ""}${amount} (${m.legal_name || m.rep_name})`,
    html: wrap(
      testBanner(test) +
      `<h2 style="margin:0 0 6px">${monthly ? "Novo plano mensal: 1ª parcela de " : "Novo pagamento: "}${h(amount)}</h2>` +
      '<p style="margin:0 0 18px;color:#555">Entrar em contato com o cliente e enviar o passo a passo de acesso às contas de anúncio.</p>' +
      replyButtons(m, `Molina Growth: your ${plan} plan, next steps`, replyBody) +
      button(agreementUrl, "Ver contrato assinado") +
      button(dashboard, "Abrir na Stripe") +
      table([
        ["Plano", `${plan} (${regionLabel(m)})`],
        ["Pagamento", monthly ? `Mensal: ${t.price}` : `À vista: ${t.price}`],
        ...(monthly ? [["Termina em", `${fmtDate(endsAt)} (encerra sozinho após ${m.months} parcelas)`]] : []),
        ...clientRows(m),
        ["Assinado por", `${m.sig_name || "-"} em ${m.accepted_at ? new Date(m.accepted_at).toUTCString() : "-"} (IP ${m.ip || "-"})`],
        ["Contrato", m.contract],
        ["Referência", session.id],
      ]),
    ),
  });

  // Cliente: boas-vindas + contrato assinado
  await toClient(env, m.email, {
    key: key && key + ":client",
    subject: `${test ? "[TEST] " : ""}Welcome to Molina Growth: your ${plan} plan`,
    html: clientWrap(test,
      `<h2 style="margin:0 0 10px">Thank you, ${h(firstName(m))}</h2>` +
      `<p style="margin:0 0 14px">Your payment for the <b>${h(plan)}</b> plan has been received. ` +
      `A copy of the agreement you signed is available at the link below. You can save it as a PDF from that page.</p>` +
      button(agreementUrl, "View your signed agreement", true) +
      table([
        ["Plan", `${plan} (${m.region === "us" ? "USA" : "UK"})`],
        ["Payment", monthly ? `Monthly: ${t.price}` : `Upfront: ${t.price}`],
        ...(monthly ? [["Last payment", `${m.months} monthly payments, ending ${fmtDateEn(endsAt)}`]] : []),
        ["Business", m.legal_name],
        ["Signed by", `${m.sig_name || "-"}, ${m.accepted_at ? new Date(m.accepted_at).toUTCString() : "-"}`],
        ["Reference", session.id],
      ], 120) +
      `<h3 style="margin:22px 0 6px">What happens next</h3>` +
      `<p style="margin:0">Within one business day we'll contact you on WhatsApp or email with a short step-by-step guide ` +
      `to give us access to your Google Ads and/or Meta Ads accounts. A payment receipt is sent separately by Stripe.</p>`),
  });
}

/* ---------------- avisos do plano mensal ---------------- */
export async function sendSubscriptionEmail(kind, sub, env, { test, invoice, key } = {}) {
  const m = sub.metadata || {};
  const plan = planLabel(m);
  const amount = invoice ? fmt(invoice.amount_due ?? invoice.amount_paid ?? 0, String(invoice.currency || "").toUpperCase()) : "";
  const cancelOn = m.unpaid_since ? fmtDate(new Date((Number(m.unpaid_since) + 90 * 86400) * 1000).toISOString())
    : fmtDate(new Date(Date.now() + 90 * 86400 * 1000).toISOString());
  const dashboard = `https://dashboard.stripe.com/${test ? "test/" : ""}subscriptions/${sub.id}`;

  const K = {
    failed: {
      subject: `Parcela NÃO paga: ${plan} (${m.legal_name || m.rep_name})`,
      title: `Parcela mensal falhou${amount ? ": " + amount : ""}`,
      text: `<b>Pausar as campanhas</b> até o pagamento. A Stripe vai tentar cobrar de novo e manda ao cliente um e-mail para atualizar o cartão (se estiver ativado nas configurações). Se continuar sem pagar, o plano é <b>cancelado automaticamente em ${cancelOn}</b> (3 meses).`,
      reply: [`Molina Growth: payment issue on your ${plan} plan`,
        `Hi ${firstName(m)}, this is the Molina Growth team. Your monthly payment for the ${plan} plan didn't go through, so your campaigns are paused for now. Please update your card using the link in the email from Stripe, or reply here and we'll help. As set out in our agreement, if the payment remains unpaid for 3 months the plan will be cancelled.`],
    },
    recovered: {
      subject: `Pagamento regularizado: ${plan} (${m.legal_name || m.rep_name})`,
      title: `Parcela paga após atraso${amount ? ": " + amount : ""}`,
      text: "O cliente regularizou o pagamento. <b>Reativar as campanhas.</b>",
      reply: [`Molina Growth: payment received`, `Hi ${firstName(m)}, this is the Molina Growth team. Thank you, your payment has been received and we're resuming your campaigns.`],
    },
    installment: {
      subject: `Parcela paga: ${plan} (${m.legal_name || m.rep_name})${amount ? ", " + amount : ""}`,
      title: `Parcela mensal paga${amount ? ": " + amount : ""}`,
      text: "Pagamento mensal recebido normalmente. Nada a fazer.",
      reply: null,
    },
    completed: {
      subject: `Plano mensal concluído: ${plan} (${m.legal_name || m.rep_name})`,
      title: "Plano mensal terminou",
      text: `Todas as ${m.months} parcelas foram cobradas e a assinatura encerrou sozinha. Bom momento para oferecer a renovação.`,
      reply: [`Molina Growth: your ${plan} plan`, `Hi ${firstName(m)}, this is the Molina Growth team. Your ${plan} plan has now been completed. Would you like to continue with a new plan? Just reply here.`],
    },
    cancelled: {
      subject: `Assinatura cancelada: ${plan} (${m.legal_name || m.rep_name})`,
      title: "Assinatura cancelada antes do fim",
      text: "A assinatura foi cancelada (pelo painel da Stripe ou a pedido do cliente). Não haverá novas cobranças. <b>Encerrar o serviço ao fim do período já pago.</b>",
      reply: null,
    },
    cancelled_nonpayment: {
      subject: `CANCELADO por falta de pagamento: ${plan} (${m.legal_name || m.rep_name})`,
      title: "Plano cancelado: 3 meses sem pagamento",
      text: "A parcela ficou em aberto por 3 meses e o plano foi <b>cancelado automaticamente</b>, como previsto no contrato. Valores já vencidos continuam devidos.",
      reply: [`Molina Growth: your ${plan} plan has been cancelled`,
        `Hi ${firstName(m)}, this is the Molina Growth team. As your monthly payment for the ${plan} plan has remained unpaid for 3 months, the plan has been cancelled as set out in our agreement. If you'd like to restart, just reply here.`],
    },
  }[kind];
  if (!K) return;

  await sendMail(env, {
    key: key && key + ":team",
    reply_to: m.email || undefined,
    subject: `${test ? "[TESTE] " : ""}${K.subject}`,
    html: wrap(
      testBanner(test) +
      `<h2 style="margin:0 0 6px">${h(K.title)}</h2>` +
      `<p style="margin:0 0 18px;color:#333">${K.text}</p>` +
      (K.reply ? replyButtons(m, K.reply[0], K.reply[1]) : "") +
      button(dashboard, "Abrir na Stripe") +
      table([["Plano", `${plan} (${regionLabel(m)}), mensal`], ...clientRows(m), ["Assinatura", sub.id]]),
    ),
  });

  // Cliente: só nos casos que mudam algo para ele (falhou, regularizou, terminou, cancelado por falta de pagamento)
  if (K.reply && kind !== "cancelled") {
    await toClient(env, m.email, {
      key: key && key + ":client",
      subject: `${test ? "[TEST] " : ""}${K.reply[0]}`,
      html: clientWrap(test, `<p style="margin:0 0 14px">${h(K.reply[1])}</p>`),
    });
  }
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