// src/shared/whatsapp/whatsapp.ts
// Compartilhamento de Orçamento/OS via WhatsApp (link wa.me — sem API paga/oficial).
// Fica FORA das telas. Reaproveita os dados do documento (getDocumentDetail) e o contato
// da empresa (tenants + tenant_settings). Não gera/armazena PDF (Storage intacto): o
// wa.me transporta apenas texto; o PDF é gerado/salvo pelo botão "Gerar PDF" e anexado
// manualmente pelo usuário no WhatsApp.

import { supabase } from "../supabase";
import { getDocumentDetail } from "../documents/detail";
import { kindLabel, formatBRL, formatShortDate } from "../documents/documents";

export type WhatsAppShare = {
  message: string;
  clientPhone: string | null; // já normalizado para o wa.me (dígitos, com DDI)
};

export async function buildWhatsAppMessage(
  documentId: string
): Promise<{ data: WhatsAppShare | null; error: string | null }> {
  const { data: doc, error } = await getDocumentDetail(documentId);
  if (error || !doc) return { data: null, error: error ?? "Atendimento não encontrado." };

  const { data: tenant } = await supabase.from("tenants").select("name").single();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("whatsapp, phone")
    .single();

  const company = tenant?.name?.trim() || "nossa empresa";
  const contact = settings?.whatsapp || settings?.phone || null;
  const tipo = doc.kind === "budget" ? "orçamento" : "ordem de serviço";
  const numero = doc.number != null ? ` nº ${doc.number}` : "";

  const lines: string[] = [
    doc.clientName ? `Olá ${doc.clientName}.` : "Olá.",
    `Seu ${tipo}${numero} foi preparado pela ${company}.`,
    `Valor total: ${formatBRL(doc.total)}`,
  ];
  if (doc.validUntil) lines.push(`Validade: ${formatShortDate(doc.validUntil)}`);
  if (contact) lines.push(`Em caso de dúvidas: WhatsApp: ${contact}`);

  // kindLabel reaproveitado para consistência caso seja necessário em outros pontos
  void kindLabel;

  return {
    data: { message: lines.join("\n"), clientPhone: normalizePhone(doc.clientPhone) },
    error: null,
  };
}

export async function shareDocumentWhatsApp(documentId: string): Promise<{ error: string | null }> {
  const { data, error } = await buildWhatsAppMessage(documentId);
  if (error || !data) return { error: error ?? "Não foi possível montar a mensagem." };

  // com telefone -> abre conversa com o cliente; sem telefone -> abre sem destinatário
  const base = data.clientPhone ? `https://wa.me/${data.clientPhone}` : "https://wa.me/";
  const url = `${base}?text=${encodeURIComponent(data.message)}`;

  const win = window.open(url, "_blank");
  if (!win) return { error: "Permita pop-ups para abrir o WhatsApp." };
  return { error: null };
}

// Mantém só dígitos. Para números BR locais (10 ou 11 dígitos) prefixa o DDI 55.
export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}
