/**
 * PREÇOS DOS PLANOS — fonte única.
 * Este arquivo é usado pelo site (para mostrar) E pelo Worker (para cobrar).
 * Altere só aqui.
 *
 *   std       = valor mensal cheio (sem desconto), em unidade normal (ex.: 120.90 = £120,90)
 *   DISCOUNTS = desconto por duração, para pagamento à vista (0.15 = 15%)
 *
 * Total cobrado = std × meses × (1 − desconto), arredondado ao centavo.
 * Ex.: Starter UK 6 meses = 120.90 × 6 × 0.85 = £616.59
 */
export const PRICES = {
  uk: {
    currency: "GBP",
    locale: "en-GB",
    label: "United Kingdom",
    plans: {
      starter: { std: 120.90 },
      premium: { std: 249.90 },
    },
  },
  us: {
    currency: "USD",
    locale: "en-US",
    label: "United States",
    plans: {
      starter: { std: 160.90 },
      premium: { std: 329.90 },
    },
  },
};

/** Desconto por duração (meses). 1 mês = sem desconto. */
export const DISCOUNTS = { 1: 0, 2: 0.05, 3: 0.10, 6: 0.15, 12: 0.20 };

/** Durações oferecidas (meses), na ordem dos botões. */
export const DURATIONS = [1, 2, 3, 6, 12];

/** Nome exibido de cada plano. */
export const PLAN_NAMES = { starter: "Starter", premium: "Premium" };

/** Total em centavos (minor units) para cobrar, ou null se a combinação não existir. */
export function totalMinor(region, plan, months) {
  const std = PRICES[region]?.plans[plan]?.std;
  const d = DISCOUNTS[months];
  if (typeof std !== "number" || typeof d !== "number") return null;
  return Math.round(std * 100 * months * (1 - d));
}

/** Preço cheio (sem desconto) em centavos. */
export function fullMinor(region, plan, months) {
  const std = PRICES[region]?.plans[plan]?.std;
  return typeof std === "number" ? Math.round(std * 100 * months) : null;
}