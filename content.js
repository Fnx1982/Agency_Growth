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
      ["The service", "Molina Growth provides advertising management, lead generation and social media services as described in the plan you buy. We don't guarantee a specific number of leads or sales, as results depend on your market, offer and ad budget."],
      ["Payment", "Fixed plans are paid in full upfront for the selected period. Prices exclude your advertising spend, which you pay directly to Google or Meta."],
      ["Start date", "Your service period starts on the day your campaigns go live after the kickoff call, not the day you pay."],
      ["Your accounts", "You keep ownership of your ad and social accounts and give us the access needed to deliver the service."],
      ["Contact", "Questions about these terms: {email}."],
    ],
  },
  refund: {
    title: "Refund policy",
    sections: [
      ["Before kickoff", "If you cancel before your kickoff call, we refund the full amount you paid."],
      ["After campaigns go live", "Fixed plans are discounted for upfront payment. After campaigns go live, unused full months can be refunded at the standard monthly rate, minus any discount already applied. [Edit this to match your policy.]"],
      ["How to request", "Email {email} with your order details. Refunds go back to the original card within 5 to 10 business days."],
    ],
  },
  privacy: {
    title: "Privacy",
    sections: [
      ["What we collect", "Your name, business, contact details and billing address, used to deliver the service and contact you about it."],
      ["Payments", "Card payments are handled by Stripe. We never see or store your card number."],
      ["Your rights", "You can ask us to access, correct or delete your data at any time by emailing {email}."],
    ],
  },
};  