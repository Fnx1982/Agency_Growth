/**
 * Texto do plano que entra na seção 19 do contrato (usado pelo site e pelo servidor).
 * Assim o que o cliente vê antes de assinar é exatamente o que fica registrado.
 */
import { PRICES, PLAN_NAMES, DISCOUNTS, PLAN_VERSION, totalMinor, fullMinor, monthlyMinor } from "./prices.js";

export const PLAN_INCLUDES = {
  starter: ["Google Ads or Meta Ads management (one platform)", "Campaign strategy and planning", "Keyword research (Google Ads)",
    "Audience and location targeting", "Ad creative planning", "Basic conversion tracking", "Monthly performance report"],
  premium: ["Google Ads and Meta Ads management", "Campaign strategy and planning", "Keyword research and audience targeting",
    "Ad creative planning", "Conversion tracking and monitoring", "Competitor research", "Landing page consultation",
    "Social media management", "4 social posts per month", "Monthly report and recommendations"],
};

export function money(region, minor) {
  const r = PRICES[region];
  return new Intl.NumberFormat(r.locale, { style: "currency", currency: r.currency }).format(minor / 100);
}

/** Dados do plano para o contrato. billing: "upfront" | "monthly". */
export function planTerms(region, plan, months, billing) {
  const r = PRICES[region];
  const pct = Math.round((DISCOUNTS[months] || 0) * 100);
  const monthly = billing === "monthly" && months > 1;
  const per = monthlyMinor(region, plan);
  const total = monthly ? per * months : totalMinor(region, plan, months);
  const mLabel = `${months} ${months === 1 ? "month" : "months"}`;
  return {
    plan_name: `${PLAN_NAMES[plan]}, ${mLabel} (${r.label})`,
    plan_description: PLAN_INCLUDES[plan].join("; ") + ".",
    deliverables: `As listed in the plan description, for ${mLabel}. Anything not listed is excluded and may be quoted separately. Advertising spend is not included.`,
    price: monthly
      ? `${money(region, per)} per month × ${months} = ${money(region, total)} (${r.currency})`
      : `${money(region, total)} (${r.currency}), single payment`,
    billing: monthly
      ? `Monthly, charged automatically in advance on the same day each month for ${months} months, then ends automatically`
      : `Paid upfront in full for ${mLabel}`,
    discount: monthly
      ? "No discount (monthly payments are charged at the standard rate). No setup fee. No trial."
      : pct ? `${pct}% upfront discount (standard price ${money(region, fullMinor(region, plan, months))}). No setup fee. No trial.` : "No discount. No setup fee. No trial.",
    conditions: monthly
      ? "If a monthly payment fails, the Services are paused until the payment is made. If a payment remains unpaid for 3 months, the Service Provider will cancel the Selected Plan and this Agreement will terminate; amounts already due remain payable. The Client may cancel future monthly payments in accordance with Section 3."
      : "The full price for the selected period is paid in advance at the upfront price shown at checkout.",
    ad_budget: "Paid by the Client directly to Google and/or Meta from the Client’s own advertising accounts; amount to be agreed during onboarding.",
    start_date: "To be confirmed by email after onboarding (when campaigns go live).",
    plan_version: PLAN_VERSION,
    total_minor: total,
    per_minor: monthly ? per : null,
  };
}