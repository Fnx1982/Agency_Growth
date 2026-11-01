/**
 * Lógica da página: configurador de plano, pagamento (Stripe), orçamento e páginas legais.
 * Preços: prices.js   |   Textos/listas: content.js   |   Visual: style.css
 */
import { PRICES, PLAN_NAMES, DISCOUNTS, totalMinor, fullMinor, monthlyMinor } from "./prices.js";
import { CONTRACT_VERSION, CONTRACTS, renderAgreement } from "./contracts.js";
import { planTerms } from "./plan-terms.js";
import { INCLUDED, COMPARE, SERVICES, LEGAL, CONTACT, BADGES } from "./content.js";
import { DIAL, TOP, EXAMPLES, FORMATS, TRUNK_ZERO } from "./countries.js";

/* ---------------- utilitários ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ---------------- estado ---------------- */
const state = { region: "uk", plan: "starter", months: 1, billing: "upfront" }; // abre no Starter, 1 mês, à vista
let config = { testMode: true, contactEmail: CONTACT.email || "" };

try {
  const saved = localStorage.getItem("mg_region");
  if (saved === "uk" || saved === "us") state.region = saved;
  else if (/^en-US/.test(navigator.language)) state.region = "us";
} catch (_) { /* storage bloqueado: segue com UK */ }

const money = (value) => {
  const r = PRICES[state.region];
  return new Intl.NumberFormat(r.locale, { style: "currency", currency: r.currency }).format(value);
};
const currentPlan = () => PRICES[state.region].plans[state.plan];
const isMonthly = () => state.billing === "monthly" && state.months > 1;
const currentTotal = () => totalMinor(state.region, state.plan, state.months) / 100;
/** Valor cobrado agora: à vista = total com desconto; mensal = 1ª parcela (preço cheio). */
const chargeNow = () => (isMonthly() ? monthlyMinor(state.region, state.plan) / 100 : currentTotal());
const planLabel = () => `${PLAN_NAMES[state.plan]}, ${state.months} ${state.months === 1 ? "month" : "months"}`;

/* ---------------- render do configurador ---------------- */
function render() {
  const plan = currentPlan();
  const monthly = isMonthly();
  const total = currentTotal();
  const full = fullMinor(state.region, state.plan, state.months) / 100;
  const pct = Math.round((DISCOUNTS[state.months] || 0) * 100);
  const saving = full - total;

  $$(".region button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.region === state.region)));
  $$("[data-plan]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.plan === state.plan)));
  $$("[data-months]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.months) === state.months)));
  $$("[data-billing]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.billing === (monthly ? "monthly" : "upfront"))));
  $("#paywrap").hidden = state.months === 1; // 1 mês = pagamento único
  $("#pay-up-note").textContent = pct ? `Save ${pct}%` : "One payment";

  if (monthly) {
    $("#total").textContent = money(plan.std);
    $("#per").hidden = false;
    $("#was").hidden = true; $("#off").hidden = true;
    $("#sub").innerHTML = `<b>${state.months} monthly payments</b>, charged automatically, then the plan ends. Total ${esc(money(full))}.`;
    $("#bar").style.width = "0%";
    $("#savetext").innerHTML = `Pay upfront instead to save <b>${esc(money(saving))}</b> (${pct}%).`;
  } else {
    $("#total").textContent = money(total);
    $("#per").hidden = true;
    $("#was").textContent = pct ? money(full) : ""; $("#was").hidden = !pct;
    $("#off").textContent = pct ? `${pct}% off` : ""; $("#off").hidden = !pct;
    $("#sub").innerHTML = state.months === 1
      ? `<b>Paid upfront for 1 month</b> at the standard rate of ${esc(money(plan.std))}.`
      : `<b>${esc(money(total / state.months))} per month</b>, paid upfront for ${state.months} months. Standard rate ${esc(money(plan.std))}.`;
    $("#bar").style.width = Math.min(100, pct * 4) + "%";
    $("#savetext").innerHTML = pct
      ? `You save <b>${esc(money(saving))}</b> (${pct}%) by paying ${state.months} months upfront.`
      : `Pay 2 months or more upfront to save from 5% up to 20%.`;
  }
  $("#incl").innerHTML = INCLUDED[state.plan].map((i) => `<li>${esc(i)}</li>`).join("");
  $("#paybtn").textContent = monthly ? `Pay ${money(chargeNow())} today` : "Pay " + money(chargeNow());
  $("#pb-plan").textContent = planLabel() + (monthly ? ", monthly" : "");
  $("#pb-total").textContent = money(chargeNow()) + (monthly ? "/mo" : "");

  $("#cmp-s").textContent = "from " + money(totalMinor(state.region, "starter", 12) / 1200) + "/mo";
  $("#cmp-p").textContent = "from " + money(totalMinor(state.region, "premium", 12) / 1200) + "/mo";
}

/* ---------------- conteúdo estático gerado a partir de content.js ---------------- */
function renderStatic() {
  const cell = (v) => v === true ? '<span class="yes" role="img" aria-label="Included"></span>'
    : v === false ? '<span class="no" role="img" aria-label="Not included"></span>' : esc(v);
  $("#cmp-body").innerHTML = COMPARE
    .map(([name, s, p]) => `<tr><th scope="row">${esc(name)}</th><td class="c">${cell(s)}</td><td class="c">${cell(p)}</td></tr>`)
    .join("");
  $("#chips").innerHTML = SERVICES
    .map((s) => `<label><input type="checkbox" name="services" value="${esc(s)}">${esc(s)}</label>`).join("");
  $("#yr").textContent = new Date().getFullYear();
  // selos verdes (texto em content.js > BADGES)
  for (const [plan, text] of Object.entries(BADGES.plan || {})) {
    const b = $(`[data-plan="${plan}"]`);
    if (b && text) { b.classList.add("has-badge"); b.insertAdjacentHTML("beforeend", `<i class="badge">${esc(text)}</i>`); }
  }
  for (const [m, text] of Object.entries(BADGES.months || {})) {
    const b = $(`[data-months="${m}"]`);
    if (b && text) { b.classList.add("has-badge"); b.insertAdjacentHTML("beforeend", `<i class="badge">${esc(text)}</i>`); }
  }
  renderPhoneCountries();
  syncPhoneCountry();
  applyConfig(); // mostra o e-mail de contato mesmo antes de carregar a config do servidor
  $("#wa-main").href = CONTACT.whatsappUrl;
  $("#wa-float").href = CONTACT.whatsappUrl;
  $("#wa-number").textContent = CONTACT.whatsappNumber;
}

/* ---------------- telefone com código do país (formata enquanto digita) ---------------- */
let countryOptions = "";
function countryOptionsHtml() {
  if (countryOptions) return countryOptions;
  let names;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (_) { names = { of: (c) => c }; }
  const opt = (c) => `<option value="${c}">${esc(names.of(c) || c)} (+${DIAL[c]})</option>`;
  const rest = Object.keys(DIAL).filter((c) => !TOP.includes(c)).sort((a, b) => (names.of(a) || a).localeCompare(names.of(b) || b));
  return (countryOptions = TOP.map(opt).join("") + "<option disabled>──────────</option>" + rest.map(opt).join(""));
}

/** Aplica o formato do país aos dígitos. Ex.: BR "11912345678" → "(11) 9 1234-5678". */
function formatPhone(country, digits) {
  const masks = FORMATS[country];
  if (!digits) return "";
  if (!masks) { // padrão: últimos 4 dígitos juntos, o resto em grupos de 3 (ex.: 901 234 5678)
    if (digits.length < 7) return digits;
    const head = digits.slice(0, -4).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return head + " " + digits.slice(-4);
  }
  const fit = masks.find((m) => (m.match(/0/g) || []).length === digits.length)
    || masks.find((m) => (m.match(/0/g) || []).length >= digits.length) || masks[masks.length - 1];
  let out = "", i = 0;
  for (const ch of fit) {
    if (i >= digits.length) break;
    if (ch === "0") out += digits[i++];
    else out += ch;
  }
  return out + (i < digits.length ? " " + digits.slice(i) : ""); // dígitos a mais ficam no fim
}

/** Liga um seletor de país + campo de telefone. Usado no formulário Custom e no Contact us. */
function phoneWidget(select, input) {
  let touched = false;
  select.innerHTML = countryOptionsHtml();
  const digitsOf = () => {
    let d = input.value.replace(/\D/g, "");
    if (TRUNK_ZERO.includes(select.value)) d = d.replace(/^0+/, ""); // 07400 → 7400
    return d.slice(0, 15);
  };
  const reformat = () => { input.value = formatPhone(select.value, digitsOf()); };
  const placeholder = () => { input.placeholder = EXAMPLES[select.value] || "Phone number"; };
  input.addEventListener("input", reformat);
  select.addEventListener("change", () => { touched = true; placeholder(); reformat(); });
  const w = {
    sync() { if (!touched) { select.value = state.region === "us" ? "US" : "GB"; placeholder(); reformat(); } },
    full() { const d = digitsOf(); return d ? `+${DIAL[select.value]} ${input.value}` : ""; },
    valid() { const d = digitsOf(); return !d || (d.length >= 6 && d.length <= 15); },
    reset() { input.value = ""; },
  };
  w.sync();
  return w;
}
let quotePhone, contactPhone;
let checkoutPhone;
function renderPhoneCountries() {
  quotePhone = phoneWidget($("#q-cc"), $("#q-phone"));
  contactPhone = phoneWidget($("#c-cc"), $("#c-phone"));
  checkoutPhone = phoneWidget($("#co-cc"), $("#co-phone"));
  // país do endereço (nomes em inglês)
  let names;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (_) { names = { of: (c) => c }; }
  const codes = [...TOP, ...Object.keys(DIAL).filter((c) => !TOP.includes(c)).sort((a, b) => (names.of(a) || a).localeCompare(names.of(b) || b))];
  $("#co-country").innerHTML = codes.map((c, i) => (i === TOP.length ? "<option disabled>──────────</option>" : "") +
    `<option value="${esc(names.of(c) || c)}" data-code="${c}">${esc(names.of(c) || c)}</option>`).join("");
}
let countryTouched = false;
function syncPhoneCountry() {
  quotePhone?.sync(); contactPhone?.sync(); checkoutPhone?.sync();
  const sel = $("#co-country");
  if (sel && !countryTouched) {
    const code = state.region === "us" ? "US" : "GB";
    const opt = [...sel.options].find((o) => o.dataset.code === code);
    if (opt) sel.value = opt.value;
  }
  if ($("#pc-label")) $("#pc-label").textContent = state.region === "us" ? "ZIP code" : "Postcode";
}

function applyConfig() {
  if (config.contactEmail) {
    const a = $("#contactmail");
    a.textContent = config.contactEmail;
    a.href = "mailto:" + config.contactEmail;
    const [user, domain] = config.contactEmail.split("@");
    $("#mail-label").innerHTML = domain ? `${esc(user)}<wbr>@${esc(domain)}` : esc(config.contactEmail); // quebra antes do @
    $("#c-mailto").href = "mailto:" + config.contactEmail;
    $("#c-mailto").textContent = config.contactEmail;
  }
}

/* ---------------- cliques gerais ---------------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.region) {
    state.region = b.dataset.region;
    try { localStorage.setItem("mg_region", state.region); } catch (_) {}
    render();
    syncPhoneCountry();
  } else if (b.dataset.plan) { state.plan = b.dataset.plan; render(); }
  else if (b.dataset.months) { state.months = Number(b.dataset.months); render(); }
  else if (b.dataset.billing) { state.billing = b.dataset.billing; render(); }
  else if (b.dataset.legal) openLegal(b.dataset.legal);
  else if (b.hasAttribute("data-close")) b.closest("dialog").close();
});

/* ---------------- validação de formulários ---------------- */
// tira o vermelho do campo assim que a pessoa corrige
document.addEventListener("input", (e) => { if (e.target.hasAttribute?.("aria-invalid") && e.target.value.trim()) e.target.removeAttribute("aria-invalid"); });
document.addEventListener("change", (e) => { if (e.target.type === "checkbox" && e.target.checked) e.target.removeAttribute("aria-invalid"); });
function validate(form) {
  const invalid = $$("[required]", form).filter((i) =>
    i.type === "checkbox" ? !i.checked : !i.value.trim() || (i.type === "email" && !EMAIL_RE.test(i.value.trim())));
  $$("input,select,textarea", form).forEach((i) => i.removeAttribute("aria-invalid"));
  invalid.forEach((i) => i.setAttribute("aria-invalid", "true"));
  if (invalid.length) invalid[0].focus();
  return invalid.length === 0;
}

async function postJSON(url, body) {
  let res;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (_) {
    throw new Error("Couldn't reach our server. Check your connection and try again.");
  }
  // Sem backend (ex.: site aberto pelo GitHub Pages ou Live Server) a resposta não é JSON
  if (!(res.headers.get("content-type") || "").includes("application/json")) {
    const e = new Error("This isn't available on this preview of the site yet. Please contact us on WhatsApp.");
    e.preview = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/* ---------------- checkout: cadastro → contrato → pagamento ---------------- */
const checkout = $("#checkout");

function setStep(n) {
  $("#co-step1").hidden = n !== 1;
  $("#co-step2").hidden = n !== 2;
  [1, 2, 3].forEach((i) => $("#prog-" + i).toggleAttribute("aria-current", i === n));
  $("#conote").textContent = "";
  $("#co-form-wrap").scrollTop = 0;
  checkout.scrollTop = 0;
}

$("#paybtn").addEventListener("click", () => {
  const monthly = isMonthly();
  $("#co-title").textContent = planLabel() + (monthly ? ", monthly" : "");
  $("#co-sub").textContent = monthly
    ? `${PRICES[state.region].label} plan, ${state.months} monthly payments`
    : `${PRICES[state.region].label} plan, paid upfront`;
  $("#co-amt").textContent = money(chargeNow()) + (monthly ? "/mo" : "");
  $("#co-form-wrap").hidden = false;
  $("#co-done").hidden = true;
  setStep(1);
  checkout.showModal();
  setTimeout(() => $("#coform input[name=legal_name]")?.focus(), 50);
});
checkout.addEventListener("click", (e) => { if (e.target === checkout) checkout.close(); });
$("#co-country").addEventListener("change", () => { countryTouched = true; });

function clientData() {
  const f = $("#coform");
  return {
    legal_name: f.legal_name.value.trim(), reg_no: f.reg_no.value.trim(),
    street: f.street.value.trim(), city: f.city.value.trim(), postcode: f.postcode.value.trim(), country: f.country.value,
    rep_name: f.rep_name.value.trim(), rep_title: f.rep_title.value.trim(), email: f.email.value.trim(),
    phone: checkoutPhone.full(), website: f.website.value.trim(), sig_name: f.sig_name.value.trim(),
    b2b: f.b2b.checked, agree: f.agree.checked,
  };
}

function renderPreview() {
  const c = clientData();
  const t = planTerms(state.region, state.plan, state.months, isMonthly() ? "monthly" : "upfront");
  const version = CONTRACT_VERSION[state.region];
  $("#ag-name").textContent = `Business Marketing Services Agreement (${state.region === "us" ? "Florida, United States" : "England and Wales"})`;
  $("#co-summary").innerHTML = `<b>${esc(t.plan_name)}</b><span>${esc(t.price)}</span><span>${esc(t.billing)}</span>`;
  $("#ag-preview").innerHTML = renderAgreement(version, {
    ...t,
    order_id: "Assigned when you pay",
    accepted_at: "Recorded when you sign",
    legal_name: c.legal_name, reg_no: c.reg_no,
    address: [c.street, c.city, c.postcode, c.country].filter(Boolean).join(", "),
    rep_name: c.rep_name, rep_title: c.rep_title, email: c.email,
    sig_name: c.sig_name, ip: "Recorded when you sign",
  });
}

$("#co-next").addEventListener("click", () => {
  const note = $("#conote");
  note.className = "note err";
  if (!validate($("#co-step1"))) {
    note.textContent = $("#coform").b2b.checked ? "Fill in the highlighted fields to continue." : "Fill in the highlighted fields and confirm you’re buying for your business.";
    return;
  }
  if (!checkoutPhone.valid()) { $("#co-phone").setAttribute("aria-invalid", "true"); note.textContent = "Check the phone number, or leave it blank."; return; }
  renderPreview();
  setStep(2);
  $("#ag-preview").scrollTop = 0;
});
$("#co-back").addEventListener("click", () => setStep(1));
$("#coform input[name=sig_name]").addEventListener("input", () => {
  // atualiza só o nome na tabela de assinatura, sem redesenhar o contrato todo
  const cell = $("#ag-preview .ag-sign td");
  if (cell) cell.textContent = $("#coform input[name=sig_name]").value || "[to be completed]";
});
$("#coform input[name=agree]").addEventListener("change", (e) => {
  if (e.target.checked) { $("#conote").textContent = ""; e.target.removeAttribute("aria-invalid"); }
});

$("#coform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $("#conote");
  const btn = $("#co-submit");
  note.className = "note err";
  if ($("#co-step2").hidden) { $("#co-next").click(); return; } // Enter na etapa 1 = continuar
  if (!validate($("#co-step2"))) {
    note.textContent = "Type your full name and tick the box to sign the agreement.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Opening secure payment…";
  try {
    const { url } = await postJSON("/api/checkout", {
      region: state.region, plan: state.plan, months: state.months,
      billing: isMonthly() ? "monthly" : "upfront", client: clientData(),
    });
    window.location.href = url; // vai para a página segura da Stripe
  } catch (err) {
    note.textContent = err.message;
    btn.disabled = false;
    btn.textContent = "Sign and continue to payment";
  }
});

/** Quando o cliente volta da Stripe: ?paid=cs_... (pagou) ou ?cancelled=1 (desistiu). */
async function handleReturn() {
  const params = new URLSearchParams(location.search);
  const paidId = params.get("paid");
  const cancelled = params.has("cancelled");
  if (!paidId && !cancelled) return;
  history.replaceState(null, "", location.pathname + location.hash); // limpa a URL

  if (cancelled) {
    $("#co-title").textContent = planLabel();
    $("#co-sub").textContent = `${PRICES[state.region].label} plan, paid upfront`;
    $("#co-amt").textContent = money(currentTotal());
    $("#co-form-wrap").hidden = false;
    $("#co-done").hidden = true;
    $("#conote").className = "note";
    $("#conote").textContent = "Payment cancelled. You have not been charged.";
    checkout.showModal();
    return;
  }

  $("#co-form-wrap").hidden = true;
  $("#co-done").hidden = false;
  $("#co-title").textContent = "Thank you";
  $("#co-sub").textContent = "";
  $("#co-amt").textContent = "";
  checkout.showModal();
  try {
    const res = await fetch("/api/order-status?id=" + encodeURIComponent(paidId));
    const s = await res.json();
    if (s.paid) {
      const amount = new Intl.NumberFormat(s.currency === "gbp" ? "en-GB" : "en-US", { style: "currency", currency: String(s.currency).toUpperCase() }).format(s.amount / 100);
      const monthly = s.billing === "monthly";
      $("#co-title").textContent = `${PLAN_NAMES[s.plan] || "Your"} plan, ${s.months} ${s.months === "1" ? "month" : "months"}${monthly ? ", monthly" : ""}`;
      $("#co-amt").textContent = amount + (monthly ? "/mo" : "");
      $("#done-text").textContent = monthly
        ? `Thank you${s.name ? ", " + s.name.split(" ")[0] : ""}. Your first monthly payment of ${amount} has been received. The remaining ${Number(s.months) - 1} payments are charged automatically each month, and a receipt goes to ${s.email || "your email"} each time.`
        : `Thank you${s.name ? ", " + s.name.split(" ")[0] : ""}. A receipt for ${amount} is on its way to ${s.email || "your email"}.`;
      if (s.hasAgreement) { $("#ag-link").href = "agreement.html?id=" + encodeURIComponent(paidId); $("#ag-link-wrap").hidden = false; }
    } else {
      $("#co-done h3").textContent = "Payment processing";
      $("#done-text").textContent = "Your bank is still confirming the payment. You'll get an email as soon as it completes.";
    }
  } catch (_) { /* o recibo da Stripe cobre esse caso */ }
}

/* ---------------- barra fixa de pagamento (celular/tablet) ---------------- */
const paybar = $("#paybar");
$("#pb-btn").addEventListener("click", () => $("#paybtn").click());
if ("IntersectionObserver" in window) {
  let configVisible = true;
  let pastConfig = false;
  let formVisible = false; // esconde a barra enquanto a pessoa preenche o formulário Custom
  const update = () => {
    const show = !configVisible && pastConfig && !formVisible && !checkout.open;
    paybar.classList.toggle("show", show);
    document.body.classList.toggle("paybar-on", show);
    paybar.setAttribute("aria-hidden", String(!show));
    $("#pb-btn").tabIndex = show ? 0 : -1;
  };
  new IntersectionObserver(([entry]) => {
    configVisible = entry.isIntersecting;
    pastConfig = entry.boundingClientRect.top < 0; // só mostra depois de rolar além do painel
    update();
  }).observe($(".config"));
  new IntersectionObserver(([entry]) => { formVisible = entry.isIntersecting; update(); }).observe($("#quoteform"));
  checkout.addEventListener("close", update);
  $("#paybtn").addEventListener("click", () => setTimeout(update, 0));
}

/* ---------------- plano personalizado ---------------- */
$("#quoteform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const note = $("#quotenote");
  const btn = f.querySelector("button[type=submit]");
  note.className = "note err";
  if (!validate(f)) { note.textContent = "Add your name, business and a valid email so we can reply."; return; }
  if (!quotePhone.valid()) {
    $("#q-phone").setAttribute("aria-invalid", "true"); $("#q-phone").focus();
    note.textContent = "Check the phone number, or leave it blank."; return;
  }

  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    await postJSON("/api/quote", {
      region: state.region, name: f.name.value, business: f.business.value, email: f.email.value,
      phone: quotePhone.full(), website: f.website.value, message: f.message.value, mg_trap: f.mg_trap.value,
      services: $$("input[name=services]:checked", f).map((i) => i.value),
    });
    f.reset();
    note.className = "note ok";
    note.textContent = "Request sent. We'll reply by email within one business day.";
  } catch (err) {
    note.textContent = err.preview || !config.contactEmail ? err.message : `${err.message} You can also email us at ${config.contactEmail}.`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Request a custom quote";
  }
});

/* ---------------- Contact us: formulário de mensagem ---------------- */
const contactDlg = $("#contactdlg");
$("#mail-main").addEventListener("click", () => {
  $("#c-done").hidden = true;
  $("#contactform").hidden = false;
  $("#cnote").textContent = "";
  contactDlg.showModal();
  setTimeout(() => $("#contactform input[name=name]").focus(), 50);
});
contactDlg.addEventListener("click", (e) => { if (e.target === contactDlg) contactDlg.close(); });
$("#contactform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const note = $("#cnote");
  const btn = f.querySelector("button[type=submit]");
  note.className = "note err";
  if (!validate(f)) { note.textContent = "Add your name, a valid email and your message."; return; }
  if (!contactPhone.valid()) { $("#c-phone").setAttribute("aria-invalid", "true"); note.textContent = "Check the phone number, or leave it blank."; return; }
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    await postJSON("/api/contact", {
      region: state.region, name: f.name.value, email: f.email.value, phone: contactPhone.full(),
      message: f.message.value, mg_trap: f.mg_trap.value,
    });
    f.reset(); contactPhone.reset();
    $("#contactform").hidden = true;
    $("#c-done").hidden = false;
  } catch (err) {
    note.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Send message";
  }
});

/* ---------------- páginas legais ---------------- */
function openLegal(key) {
  const page = LEGAL[key];
  const email = config.contactEmail || "us";
  $("#legal-title").textContent = page.title;
  $("#legal-body").innerHTML = page.sections
    .map(([h, p]) => `${h ? `<h4>${esc(h)}</h4>` : ""}<p>${esc(p.replaceAll("{email}", email))
      .replace("{agreement_uk}", '<a href="agreement.html?region=uk" target="_blank" rel="noopener">Agreement for UK clients (England and Wales)</a>')
      .replace("{agreement_us}", '<a href="agreement.html?region=us" target="_blank" rel="noopener">Agreement for US clients (Florida)</a>')}</p>`).join("");
  $("#legal").showModal();
}
$("#legal").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------------- início ---------------- */
renderStatic();
render();
fetch("/api/config")
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => { if (c) { config = { ...config, ...c }; applyConfig(); } })
  .catch(() => {})
  .then(handleReturn);