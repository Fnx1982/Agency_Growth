/**
 * Integração com a Stripe (conta Brasil, pessoa física / CPF).
 * Usa o Checkout hospedado da Stripe: o cliente paga numa página segura da Stripe
 * (cartão, Apple Pay, Google Pay) e volta para o site. Docs: https://docs.stripe.com/api/checkout/sessions
 */

/** Chamada autenticada à API da Stripe. Corpo em formato de formulário, como a Stripe exige. */
export async function stripe(env, path, { method = "GET", params } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
  const init = {
    method,
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY },
  };
  if (params) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = toForm(params);
  }
  const res = await fetch("https://api.stripe.com/v1" + path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Stripe", path, res.status, JSON.stringify(data));
    const e = new Error("Stripe API " + res.status + ": " + (data.error?.message || ""));
    e.status = res.status;
    throw e;
  }
  return data;
}

/** Converte objeto aninhado no formato da Stripe: a[b][0][c]=valor */
export function toForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") toForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export const isTestKey = (env) => String(env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
export const isLiveKey = (env) => /^(sk|rk)_live_/.test(String(env.STRIPE_SECRET_KEY || ""));

/**
 * Verifica a assinatura do webhook.
 * Cabeçalho Stripe-Signature: "t=1700000000,v1=abc...,v1=def..."
 * Assinado: "{t}.{corpo bruto}" com HMAC-SHA256 e o signing secret (whsec_...).
 * Rejeita eventos com mais de 5 minutos (proteção contra replay).
 */
export async function validSignature(raw, header, secret) {
  if (!header || !secret) return false;
  let t = null;
  const sigs = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = v;
    else if (k === "v1" && v) sigs.push(v.trim());
  }
  if (!t || !sigs.length) return false;
  if (!/^\d+$/.test(t) || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => safeEqual(s, expected));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}