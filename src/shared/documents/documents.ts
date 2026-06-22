// src/shared/documents/documents.ts
// Lógica de atendimentos (orçamento/OS) — Etapa 5. Fica FORA das telas.
// RLS (documents/document_items/document_services *_isolation via public.tenant_id())
// limita tudo ao próprio tenant. As tabelas filhas NÃO têm trigger, então o app calcula
// line_total e total. Eventos (document_created) são gerados por trigger no banco.
// Nesta etapa o documento nasce como rascunho (work_status 'draft') e sem número.

import { supabase } from "../supabase";

export type DocumentKind = "budget" | "service_order";

export type ItemInput = {
  description: string;
  quantity: string; // texto no formulário; convertido na gravação
  unitPrice: string;
};

export type ServiceInput = {
  description: string;
  price: string;
};

export type DocumentInput = {
  clientId: string;
  kind: DocumentKind;
  observation: string;
  validUntil: string; // 'YYYY-MM-DD' ou ''
  discount: string;
  items: ItemInput[];
  services: ServiceInput[];
};

export const emptyItem: ItemInput = { description: "", quantity: "1", unitPrice: "0" };
export const emptyService: ServiceInput = { description: "", price: "0" };

export const emptyDocument: DocumentInput = {
  clientId: "",
  kind: "budget",
  observation: "",
  validUntil: "",
  discount: "0",
  items: [],
  services: [],
};

export type DocumentListRow = {
  id: string;
  kind: DocumentKind;
  workStatus: string;
  total: number;
  number: number | null;
  createdAt: string;
  clientName: string | null;
  archivedAt: string | null;
};

// ---- cálculos (puros, reutilizáveis pela tela para o total ao vivo) ----

export function lineTotal(item: ItemInput): number {
  return round2(toNumber(item.quantity) * toNumber(item.unitPrice));
}

export function computeTotal(input: {
  items: ItemInput[];
  services: ServiceInput[];
  discount: string;
}): number {
  const itemsSum = input.items.reduce((acc, it) => acc + lineTotal(it), 0);
  const servicesSum = input.services.reduce((acc, sv) => acc + toNumber(sv.price), 0);
  const total = itemsSum + servicesSum - toNumber(input.discount);
  return round2(Math.max(total, 0));
}

// ---- leitura ----

export async function listDocuments(
  includeArchived = false
): Promise<{ data: DocumentListRow[]; error: string | null }> {
  let query = supabase
    .from("documents")
    .select("id, kind, work_status, total, number, created_at, archived_at, clients(name)");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[documents] list", error.message);
    return { data: [], error: "Não foi possível carregar os atendimentos. Tente de novo." };
  }
  const rows: DocumentListRow[] = (data ?? []).map((d: any) => ({
    id: d.id,
    kind: d.kind,
    workStatus: d.work_status,
    total: Number(d.total ?? 0),
    number: d.number ?? null,
    createdAt: d.created_at,
    clientName: clientNameOf(d.clients),
    archivedAt: d.archived_at ?? null,
  }));
  return { data: rows, error: null };
}

// Arquivamento (soft) do atendimento — não remove pagamentos/cobranças/anexos/eventos.
export async function archiveDocument(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("documents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[documents] archive", error.message);
    return { error: "Não foi possível arquivar o atendimento." };
  }
  return { error: null };
}

export async function restoreDocument(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("documents").update({ archived_at: null }).eq("id", id);
  if (error) {
    console.error("[documents] restore", error.message);
    return { error: "Não foi possível restaurar o atendimento." };
  }
  return { error: null };
}

export type DocumentDetail = {
  id: string;
  clientId: string;
  kind: DocumentKind;
  workStatus: string;
  observation: string;
  validUntil: string;
  discount: string;
  total: number;
  items: ItemInput[];
  services: ServiceInput[];
};

export async function getDocument(
  id: string
): Promise<{ data: DocumentDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, client_id, kind, work_status, observation, valid_until, discount, total, " +
        "document_items(description, quantity, unit_price, position), " +
        "document_services(description, price, position)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[documents] get", error?.message);
    return { data: null, error: "Atendimento não encontrado." };
  }

  // O select com embeds aninhados não é um literal (concatenação), então o supabase-js
  // não infere o shape; tratamos a linha como any para o mapeamento.
  const d: any = data;

  const items: ItemInput[] = (d.document_items ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((i: any) => ({
      description: i.description ?? "",
      quantity: String(i.quantity ?? "0"),
      unitPrice: String(i.unit_price ?? "0"),
    }));

  const services: ServiceInput[] = (d.document_services ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((s: any) => ({ description: s.description ?? "", price: String(s.price ?? "0") }));

  return {
    data: {
      id: d.id,
      clientId: d.client_id,
      kind: d.kind,
      workStatus: d.work_status,
      observation: d.observation ?? "",
      validUntil: d.valid_until ?? "",
      discount: String(d.discount ?? "0"),
      total: Number(d.total ?? 0),
      items,
      services,
    },
    error: null,
  };
}

// ---- escrita ----

export async function createDocument(
  input: DocumentInput
): Promise<{ id: string | null; error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { id: null, error: invalid };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { id: null, error: tErr ?? "Tenant não encontrado." };

  const total = computeTotal(input);

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      client_id: input.clientId,
      kind: input.kind,
      observation: emptyToNull(input.observation),
      valid_until: emptyToNull(input.validUntil),
      discount: toNumber(input.discount),
      total,
    })
    .select("id")
    .single();

  if (docErr || !doc) {
    return { id: null, error: translateWriteError(docErr) };
  }

  const childErr = await replaceChildren(tenantId, doc.id, input);
  if (childErr) {
    // compensa: remove o documento recém-criado para não deixar órfão
    await supabase.from("documents").delete().eq("id", doc.id);
    return { id: null, error: childErr };
  }

  return { id: doc.id, error: null };
}

export async function updateDocument(
  id: string,
  input: DocumentInput
): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const total = computeTotal(input);

  const { error: docErr } = await supabase
    .from("documents")
    .update({
      client_id: input.clientId,
      kind: input.kind,
      observation: emptyToNull(input.observation),
      valid_until: emptyToNull(input.validUntil),
      discount: toNumber(input.discount),
      total,
    })
    .eq("id", id);

  if (docErr) return { error: translateWriteError(docErr) };

  const childErr = await replaceChildren(tenantId, id, input);
  if (childErr) return { error: childErr };

  return { error: null };
}

// Substitui itens e serviços do documento (apaga e reinsere). Usado em create e update.
async function replaceChildren(
  tenantId: string,
  documentId: string,
  input: DocumentInput
): Promise<string | null> {
  const delItems = await supabase.from("document_items").delete().eq("document_id", documentId);
  if (delItems.error) return translateWriteError(delItems.error);
  const delServices = await supabase
    .from("document_services")
    .delete()
    .eq("document_id", documentId);
  if (delServices.error) return translateWriteError(delServices.error);

  const itemRows = input.items
    .filter((it) => it.description.trim() !== "")
    .map((it, idx) => ({
      tenant_id: tenantId,
      document_id: documentId,
      description: it.description.trim(),
      quantity: toNumber(it.quantity),
      unit_price: toNumber(it.unitPrice),
      line_total: lineTotal(it),
      position: idx,
    }));

  if (itemRows.length > 0) {
    const { error } = await supabase.from("document_items").insert(itemRows);
    if (error) return translateWriteError(error);
  }

  const serviceRows = input.services
    .filter((sv) => sv.description.trim() !== "")
    .map((sv, idx) => ({
      tenant_id: tenantId,
      document_id: documentId,
      description: sv.description.trim(),
      price: toNumber(sv.price),
      position: idx,
    }));

  if (serviceRows.length > 0) {
    const { error } = await supabase.from("document_services").insert(serviceRows);
    if (error) return translateWriteError(error);
  }

  return null;
}

// ---- helpers ----

function validate(input: DocumentInput): string | null {
  if (!input.clientId) return "Selecione o cliente.";
  const hasItem = input.items.some((it) => it.description.trim() !== "");
  const hasService = input.services.some((sv) => sv.description.trim() !== "");
  if (!hasItem && !hasService) return "Adicione ao menos uma peça ou um serviço.";
  return null;
}

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[documents] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

function translateWriteError(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  console.error("[documents] write", error.message);
  return "Não foi possível salvar o atendimento. Tente de novo.";
}

function clientNameOf(clients: any): string | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0]?.name ?? null;
  return clients.name ?? null;
}

function toNumber(v: string): number {
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

const KIND_LABEL: Record<DocumentKind, string> = {
  budget: "Orçamento",
  service_order: "Ordem de serviço",
};
const WORK_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  approved: "Aprovado",
  reproved: "Reprovado",
  in_progress: "Em andamento",
  partial: "Parcial",
  done: "Concluído",
  cancelled: "Cancelado",
};
export function kindLabel(kind: DocumentKind): string {
  return KIND_LABEL[kind] ?? kind;
}
export function workStatusLabel(status: string): string {
  return WORK_STATUS_LABEL[status] ?? status;
}
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
