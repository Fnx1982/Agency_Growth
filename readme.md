# Molina Growth: site de planos + pagamento (Stripe)

Todos os arquivos ficam na RAIZ do repositório (sem pastas).

| Arquivo | Para que serve |
|---|---|
| `index.html` | estrutura da página e textos fixos |
| `style.css` | visual (cores no topo, em `:root`) |
| `prices.js` | **preços**: fonte única, usada pelo site E pela cobrança |
| `content.js` | itens dos planos, tabela, serviços, WhatsApp, termos/reembolso/privacidade |
| `app.js` | lógica da página (configurador, cadastro, contrato, pagamento, formulários) |
| `contracts.js` | **contratos** UK (England and Wales) e EUA (Florida). Mudou o texto? crie uma versão nova |
| `plan-terms.js` | texto do plano que entra na seção 19 do contrato (preço, forma de pagamento, condições) |
| `agreement.html` / `agreement.js` | página do contrato assinado (o cliente baixa em PDF) |
| `countries.js` | países, DDI e formato de telefone |
| `*.png` | logo e ícones |
| `worker.js` | backend na Cloudflare (rotas `/api/...`) |
| `stripe-api.js` | integração com a Stripe |
| `email.js` | e-mails para a equipe (Resend) |
| `utils.js` | funções auxiliares |
| `wrangler.toml` | configuração da Cloudflare + e-mails da equipe |
| `.assetsignore` | esconde os arquivos do backend do público |

## Onde o site roda
- **GitHub Pages**: só o visual (pagamento e formulário não funcionam).
- **Cloudflare Workers**: site completo, grátis, em `https://molina-growth.SEU-USUARIO.workers.dev`.

## Chaves (Cloudflare > Worker > Settings > Variables and Secrets, tipo Secret)
- `STRIPE_SECRET_KEY`: `sk_test_...` para testes, depois `sk_live_...`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...` (Stripe > Desenvolvedores > Webhooks)
- `RESEND_API_KEY`: `re_...`

## Webhook da Stripe
Endpoint: `https://SEU-SITE/api/webhook`, estilo Instantâneo (Snapshot), eventos:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`,
`invoice.payment_failed`, `customer.subscription.deleted`.

## Plano mensal (parcelado)
- Sem desconto; cobrado todo mês e encerra sozinho após N meses.
- Parcela falhou: e-mail para a equipe (pausar campanhas). A Stripe avisa o cliente (ative em Configurações > Billing).
- 90 dias sem pagar: a tarefa diária (Cron em `wrangler.toml`) cancela a assinatura e avisa a equipe.

## Sem domínio próprio
O Resend só envia de `onboarding@resend.dev` e só para o e-mail da sua conta Resend
(por isso `TEAM_EMAIL` no `wrangler.toml` tem que ser esse e-mail).
O recibo do cliente é enviado pela Stripe: ative em Configurações > E-mails de clientes > Pagamentos bem-sucedidos.