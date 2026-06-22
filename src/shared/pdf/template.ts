// src/shared/pdf/template.ts
// Template do PDF (Orçamento / OS). Domínio de apresentação PURO: recebe dados já
// resolvidos e devolve um documento HTML A4 pronto para impressão (window.print()).
// Sem imports de I/O — assim pode ser testado isoladamente.

export type PdfCompany = {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  cnpj: string | null;
  logoUrl: string | null;
};

export type PdfItem = { description: string; quantity: number; unitPrice: number; lineTotal: number };
export type PdfService = { description: string; price: number };

export type PdfData = {
  company: PdfCompany;
  kindLabel: string; // "Orçamento" | "Ordem de serviço"
  number: number | null;
  statusLabel: string;
  clientName: string | null;
  clientPhone: string | null;
  issueDate: string; // já formatada (dd/mm/aaaa)
  items: PdfItem[];
  services: PdfService[];
  discount: number;
  total: number;
  observation: string | null;
};

export function buildDocumentHtml(data: PdfData): string {
  const itemsSubtotal = data.items.reduce((a, i) => a + i.lineTotal, 0);
  const servicesSubtotal = data.services.reduce((a, s) => a + s.price, 0);
  const subtotal = itemsSubtotal + servicesSubtotal;

  const docTitle = `${data.kindLabel}${data.number != null ? ` Nº ${data.number}` : ""}`;
  const fileTitle = `${data.kindLabel}${data.number != null ? ` ${data.number}` : ""} - ${data.company.name}`;

  const contactLine = [
    data.company.phone ? `Tel: ${esc(data.company.phone)}` : "",
    data.company.whatsapp ? `WhatsApp: ${esc(data.company.whatsapp)}` : "",
    data.company.cnpj ? `CNPJ: ${esc(data.company.cnpj)}` : "",
  ]
    .filter(Boolean)
    .join("&nbsp;&nbsp;•&nbsp;&nbsp;");

  const itemsRows =
    data.items.length === 0
      ? `<tr><td colspan="4" class="empty">Nenhuma peça.</td></tr>`
      : data.items
          .map(
            (i) => `<tr>
              <td>${esc(i.description)}</td>
              <td class="num">${formatQty(i.quantity)}</td>
              <td class="num">${money(i.unitPrice)}</td>
              <td class="num">${money(i.lineTotal)}</td>
            </tr>`
          )
          .join("");

  const servicesRows =
    data.services.length === 0
      ? `<tr><td colspan="2" class="empty">Nenhum serviço.</td></tr>`
      : data.services
          .map(
            (s) => `<tr>
              <td>${esc(s.description)}</td>
              <td class="num">${money(s.price)}</td>
            </tr>`
          )
          .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fileTitle)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1A1A2E; font-size: 12px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { max-width: 182mm; margin: 0 auto; padding: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #3C3489; padding-bottom: 14px; }
  .biz-logo { display: block; max-height: 52px; max-width: 170px; object-fit: contain; margin-bottom: 8px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #3C3489; letter-spacing: -0.3px; }
  .biz-contact { font-size: 11px; color: #6B7280; margin-top: 4px; }
  .biz-addr { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .doc-meta { text-align: right; min-width: 180px; }
  .doc-type { font-size: 16px; font-weight: 700; }
  .doc-line { font-size: 11px; color: #6B7280; margin-top: 3px; }
  .status-chip { display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 600; color: #3C3489; background: #EEEDF6; border-radius: 999px; padding: 3px 10px; }

  .client { margin-top: 18px; padding: 12px 14px; background: #F8F8FB; border: 1px solid #E5E7EB; border-radius: 8px; }
  .client .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #6B7280; }
  .client .val { font-size: 14px; font-weight: 600; }
  .client .sub { font-size: 12px; color: #6B7280; margin-top: 2px; }

  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #3C3489; margin: 20px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #6B7280; border-bottom: 1px solid #E5E7EB; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #F0F0F3; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.empty { color: #9CA3AF; text-align: center; padding: 12px; }

  .totals { margin-top: 16px; margin-left: auto; width: 56%; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
  .totals .row.grand { border-top: 2px solid #3C3489; margin-top: 6px; padding-top: 9px; font-size: 16px; font-weight: 700; color: #3C3489; }

  .obs { margin-top: 20px; }
  .obs .body { white-space: pre-wrap; font-size: 12px; padding: 10px 12px; background: #F8F8FB; border: 1px solid #E5E7EB; border-radius: 8px; }

  .signatures { margin-top: 48px; display: flex; gap: 40px; }
  .sign { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid #1A1A2E; margin-bottom: 6px; }
  .sign .cap { font-size: 11px; color: #6B7280; }

  .foot { margin-top: 26px; text-align: center; font-size: 10px; color: #9CA3AF; }
  @media print { .page { padding: 0; } }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="biz-id">
        ${data.company.logoUrl ? `<img class="biz-logo" src="${esc(data.company.logoUrl)}" alt="logo" />` : ""}
        <div class="biz-name">${esc(data.company.name)}</div>
        ${contactLine ? `<div class="biz-contact">${contactLine}</div>` : ""}
        ${data.company.address ? `<div class="biz-addr">${esc(data.company.address)}</div>` : ""}
      </div>
      <div class="doc-meta">
        <div class="doc-type">${esc(docTitle)}</div>
        <div class="doc-line">Emissão: ${esc(data.issueDate)}</div>
        <div class="status-chip">${esc(data.statusLabel)}</div>
      </div>
    </div>

    <div class="client">
      <div class="lbl">Cliente</div>
      <div class="val">${esc(data.clientName ?? "—")}</div>
      ${data.clientPhone ? `<div class="sub">${esc(data.clientPhone)}</div>` : ""}
    </div>

    <div class="section-title">Peças</div>
    <table>
      <thead><tr><th>Descrição</th><th class="num">Qtd</th><th class="num">Preço un.</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="section-title">Serviços</div>
    <table>
      <thead><tr><th>Descrição</th><th class="num">Valor</th></tr></thead>
      <tbody>${servicesRows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>Desconto</span><span>- ${money(data.discount)}</span></div>
      <div class="row grand"><span>Total</span><span>${money(data.total)}</span></div>
    </div>

    ${
      data.observation
        ? `<div class="obs"><div class="section-title">Observações</div><div class="body">${esc(
            data.observation
          )}</div></div>`
        : ""
    }

    <div class="signatures">
      <div class="sign"><div class="line">&nbsp;</div><div class="cap">Assinatura do cliente</div></div>
      <div class="sign"><div class="line">&nbsp;</div><div class="cap">Assinatura da empresa</div></div>
    </div>

    <div class="foot">Documento gerado por ${esc(data.company.name)} • AS OS</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},150);};</script>
</body>
</html>`;
}

// ---- helpers puros ----

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
