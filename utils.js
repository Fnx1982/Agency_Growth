/** Funções pequenas usadas em vários arquivos do Worker. */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Limpa texto vindo do formulário: remove caracteres de controle e limita o tamanho. */
export function clean(value, max = 200) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

/** Escapa HTML para os e-mails. */
export function h(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Telefone em formato internacional (+447700900123) ou null. */
export function toE164(phone) {
  const digits = String(phone).replace(/[^\d+]/g, "");
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

/** Formata centavos na moeda (ex.: 127740, "GBP" -> £1,277.40). */
export function fmt(minor, currency) {
  return new Intl.NumberFormat(currency === "GBP" ? "en-GB" : "en-US", { style: "currency", currency }).format(minor / 100);
}
