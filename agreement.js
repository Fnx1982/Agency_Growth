/**
 * Mostra o contrato:
 *   agreement.html?id=cs_...   -> contrato assinado (dados vêm do servidor/Stripe)
 *   agreement.html?region=uk   -> modelo em branco (UK ou US), para consulta antes de comprar
 */
import { CONTRACT_VERSION, renderAgreement } from "./contracts.js";

const params = new URLSearchParams(location.search);
const doc = document.getElementById("doc");
const status = document.getElementById("status");
document.getElementById("print").addEventListener("click", () => window.print());

async function load() {
  const id = params.get("id");
  if (id) {
    try {
      const res = await fetch("/api/agreement?id=" + encodeURIComponent(id));
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Agreement not found.");
      doc.innerHTML = renderAgreement(j.version, j.data);
      status.textContent = j.paid
        ? "Signed agreement. Use “Download PDF / Print” and choose “Save as PDF” to keep a copy."
        : "This agreement was signed, but the payment is not complete yet.";
    } catch (e) {
      status.textContent = "We couldn't load this agreement. Please contact us at molinagrowthagency@gmail.com.";
      return;
    }
  } else {
    const region = params.get("region") === "us" ? "us" : "uk";
    doc.innerHTML = renderAgreement(CONTRACT_VERSION[region], {});
    status.textContent = "Template for reference. Your plan and business details are filled in when you sign at checkout.";
  }
  doc.hidden = false;
}
load();