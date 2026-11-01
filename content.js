/**
 * TEXTOS DO SITE que vêm de listas: itens dos planos, tabela de comparação,
 * serviços do plano personalizado, países e páginas legais.
 * Edite à vontade — o layout se ajusta sozinho.
 */

/**
 * CONTATO: link do WhatsApp e número exibido.
 * O texto depois de "?text=" é a mensagem que já vem escrita para o cliente (espaços viram %20).
 */
export const CONTACT = {
  whatsappUrl: "https://wa.me/447466689871?text=Hi!%20I%20want%20to%20know%20more%20about%20your%20Meta%20Ads%20trial",
  whatsappNumber: "+44 7466 689871",
  email: "molinagrowthagency@gmail.com", // aparece em "Contact us" e no rodapé
};

/**
 * SELOS VERDES de destaque no seletor de plano.
 * Use texto de recomendação ("Recommended", "Top pick"). Só use "Most popular" quando for verdade,
 * ou seja, quando esse for de fato o plano mais vendido: no UK e nos EUA afirmação falsa é propaganda enganosa.
 * Para tirar um selo, deixe o texto vazio: "".
 */
export const BADGES = {
  plan: { premium: "Recommended" },
  months: { 2: "Top pick" },
};

/** Itens mostrados no painel preto ao escolher o plano. */
export const INCLUDED = {
  starter: [
    "Google Ads or Meta Ads (one platform)",
    "Campaign strategy and planning",
    "Keyword research (Google Ads)",
    "Audience and location targeting",
    "Ad creative planning",
    "Basic conversion tracking",
    "Monthly performance report",
  ],
  premium: [
    "Google Ads and Meta Ads",
    "Campaign strategy and planning",
    "Keyword research and audience targeting",
    "Ad creative planning",
    "Conversion tracking and monitoring",
    "Competitor research",
    "Landing page consultation",
    "Social media management",
    "4 social posts per month",
    "Monthly report and recommendations",
  ],
};

/**
 * Tabela "What each plan includes".
 * [serviço, Starter, Premium]  ->  true = incluído, false = não incluído, texto = mostra o texto
 */
export const COMPARE = [
  ["Ad platforms managed", "Google or Meta", "Google and Meta"],
  ["Campaign strategy and planning", true, true],
  ["Keyword research", true, true],
  ["Audience and location targeting", true, true],
  ["Ad creative planning", true, true],
  ["Conversion tracking", "Basic", "Tracking and monitoring"],
  ["Competitor research", false, true],
  ["Landing page consultation", false, true],
  ["Social media management", false, true],
  ["Social posts", false, "4 per month"],
  ["Monthly report", "Performance report", "Report and recommendations"],
];

/** Opções do formulário de plano personalizado. */
export const SERVICES = [
  "Google Ads", "Meta Ads", "Lead Generation", "Social Media Management", "Social Media Posts",
  "Campaign Strategy", "Keyword Research", "Conversion Tracking", "Competitor Research",
  "Landing Page Consultation", "Monthly Reporting", "Marketing Account Audit",
];

/** Países do endereço de cobrança, por região. O primeiro é o padrão. */
export const COUNTRIES = {
  uk: [["GB", "United Kingdom"], ["IE", "Ireland"], ["US", "United States"]],
  us: [["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"]],
};

/**
 * Páginas legais (rodapé e checkout). {email} é trocado pelo CONTACT_EMAIL.
 * IMPORTANTE: revise com cuidado — a Stripe pode pedir isso para aprovar a conta.
 */
export const LEGAL = {
  terms: {
    title: "Terms of service",
    sections: [
      ["Service agreement", "Every plan is provided under our Business Marketing Services Agreement, which you review and sign before paying. UK clients sign the agreement governed by the laws of England and Wales; US clients sign the agreement governed by Florida law."],
      ["Read the full agreements", "{agreement_uk}"],
      ["", "{agreement_us}"],
      ["Business customers", "Our plans are for businesses. You confirm at checkout that you are buying for your business and are authorised to sign for it."],
      ["Payment", "Upfront plans are paid in full in advance, with a discount for 2 months or more. Monthly plans are charged automatically each month at the standard rate, with no discount, and end automatically after the number of months you chose. Prices exclude your advertising spend, which you pay directly to Google or Meta."],
      ["No guaranteed results", "Results depend on your market, offer, budget and other factors outside our control, so we don't guarantee a specific number of leads or sales."],
      ["Contact", "Questions about these terms: {email}."],
    ],
  },
  refund: {
    title: "Cancellation and refunds",
    sections: [
      ["Cancelling", "You can cancel at any time by emailing {email}. Cancellation takes effect at the end of the period you have already paid for. For monthly plans, no further monthly payments are taken after that."],
      ["Payments already made", "Fees already paid for a billing period are not automatically refundable if you choose not to use the remaining services in that period, unless a refund is required by law. For upfront plans, the billing period is the full plan length you chose. Where a refund is due, it is calculated fairly, taking account of the services already performed, and paid within 30 days."],
      ["Failed monthly payments", "If a monthly payment fails, your campaigns are paused until the payment is made. If a payment remains unpaid for 3 months, the plan is cancelled and the agreement ends; amounts already due remain payable."],
      ["Advertising spend", "Money you pay directly to Google, Meta or other platforms is not part of our fee and cannot be refunded by us."],
      ["Full terms", "These rules are set out in full in sections 3, 8 and 9 of the service agreement you sign at checkout."],
    ],
  },
  privacy: {
    title: "Privacy",
    sections: [
      ["What we collect", "Your name, business details, contact details and address, used to prepare your service agreement, deliver the service and contact you about it."],
      ["Payments and records", "Card payments are handled by Stripe. We never see or store your card number. Your signed agreement record (details, date, time and IP address of signing) is stored with your payment record at Stripe."],
      ["Your rights", "You can ask us to access, correct or delete your data at any time by emailing {email}, except where we must keep records by law."],
    ],
  },
};