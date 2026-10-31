/**
 * PREÇOS DOS PLANOS — fonte única.
 * Este arquivo é usado pelo site (para mostrar) E pelo Worker (para cobrar).
 * Altere só aqui. Valores em unidade normal (ex.: 1277.40 = £1.277,40).
 *
 *   std    = valor mensal padrão (sem desconto), usado para calcular a economia
 *   totals = valor TOTAL pago adiantado para cada duração (em meses)
 */
export const PRICES = {
  uk: {
    currency: "GBP",
    locale: "en-GB",
    label: "United Kingdom",
    plans: {
      starter: { std: 120.90, totals: { 1: 114.90, 2: 199.80, 3: 326.70, 6: 617.40, 12: 1162.80 } },
      premium: { std: 249.90, totals: { 1: 237.90, 2: 399.80, 3: 674.70, 6: 1277.40, 12: 2398.80 } },
    },
  },
  us: {
    currency: "USD",
    locale: "en-US",
    label: "United States",
    plans: {
      starter: { std: 160.90, totals: { 1: 152.90, 2: 269.80, 3: 434.70, 6: 821.40, 12: 1546.80 } },
      premium: { std: 329.90, totals: { 1: 313.90, 2: 539.80, 3: 890.70, 6: 1685.40, 12: 3166.80 } },
    },
  },
};

/** Durações oferecidas (meses), na ordem dos botões. */
export const DURATIONS = [1, 2, 3, 6, 12];

/** Nome exibido de cada plano. */
export const PLAN_NAMES = { starter: "Starter", premium: "Premium" };

/** Devolve o total em centavos (minor units), ou null se a combinação não existir. */
export function totalMinor(region, plan, months) {
  const total = PRICES[region]?.plans[plan]?.totals[months];
  return typeof total === "number" ? Math.round(total * 100) : null;
}