// src/shared/pdf/pdf.ts
// Geração do PDF de Orçamento/OS. Junta os dados (Supabase, via RLS) com o template puro
// e dispara a impressão nativa do navegador (window.print) — sem dependências externas.
// Fica FORA das telas; a tela só chama generateDocumentPdf(id).

import { supabase } from "../supabase";
import { getDocumentDetail } from "../documents/detail";
import { kindLabel } from "../documents/documents";
import { statusLabel } from "../documents/domain/status";
import { buildDocumentHtml, type PdfData } from "./template";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function loadPdfData(
  documentId: string
): Promise<{ data: PdfData | null; error: string | null }> {
  const { data: detail, error } = await getDocumentDetail(documentId);
  if (error || !detail) return { data: null, error: error ?? "Atendimento não encontrado." };

  // empresa: nome (tenants) + contato (tenant_settings). Ambos limitados ao tenant pelo RLS.
  const { data: tenant } = await supabase.from("tenants").select("name").single();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("phone, whatsapp, address, cnpj, logo_url")
    .single();

  const issueDate = formatDate(detail.issuedOn ?? detail.createdAt);

  // logo: gera URL assinada quando houver caminho salvo (bucket privado)
  let logoUrl: string | null = null;
  if (settings?.logo_url) {
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrl(settings.logo_url, 60 * 60);
    logoUrl = signed?.signedUrl ?? null;
  }

  return {
    data: {
      company: {
        name: tenant?.name ?? "AS OS",
        phone: settings?.phone ?? null,
        whatsapp: settings?.whatsapp ?? null,
        address: settings?.address ?? null,
        cnpj: settings?.cnpj ?? null,
        logoUrl,
      },
      kindLabel: kindLabel(detail.kind),
      number: detail.number,
      statusLabel: statusLabel(detail.workStatus),
      clientName: detail.clientName,
      clientPhone: detail.clientPhone,
      issueDate,
      items: detail.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      services: detail.services.map((s) => ({ description: s.description, price: s.price })),
      discount: detail.discount,
      total: detail.total,
      observation: detail.observation,
    },
    error: null,
  };
}

export async function generateDocumentPdf(documentId: string): Promise<{ error: string | null }> {
  const { data, error } = await loadPdfData(documentId);
  if (error || !data) return { error: error ?? "Não foi possível gerar o PDF." };

  // Abre o documento numa nova aba; o próprio HTML dispara window.print() ao carregar.
  const win = window.open("", "_blank");
  if (!win) {
    return { error: "Permita pop-ups para gerar o PDF." };
  }
  win.document.open();
  win.document.write(buildDocumentHtml(data));
  win.document.close();
  win.focus();
  return { error: null };
}
