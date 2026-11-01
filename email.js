/**
 * E-mails para a EQUIPE, enviados pelo Resend (https://resend.com).
 *
 * Sem domínio próprio, o Resend só envia a partir de onboarding@resend.dev e SOMENTE para o
 * e-mail com que você criou a conta no Resend. Por isso TEAM_EMAIL tem que ser esse e-mail.
 * O recibo do CLIENTE é enviado pela própria Stripe (ative em Configurações > E-mails de clientes).
 */
import { PLAN_NAMES } from "./prices.js";
import { planTerms } from "./plan-terms.js";
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

/* ---------------- ajudantes ---------------- */
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
export async function sendPaidEmail(session, env, { test, site, endsAt }) {
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
}

/* ---------------- avisos do plano mensal ---------------- */
export async function sendSubscriptionEmail(kind, sub, env, { test, invoice } = {}) {
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