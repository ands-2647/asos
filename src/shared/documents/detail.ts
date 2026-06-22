// src/shared/documents/detail.ts
// Leitura completa do atendimento (visualização), timeline de eventos e conversão
// orçamento -> OS. Fica FORA das telas. RLS limita tudo ao próprio tenant.

import { supabase } from "../supabase";
import type { DocumentKind } from "./documents";

export type DetailItem = { description: string; quantity: number; unitPrice: number; lineTotal: number };
export type DetailService = { description: string; price: number };
export type DocRef = { id: string; number: number | null; kind: DocumentKind };

export type DocumentFull = {
  id: string;
  number: number | null;
  kind: DocumentKind;
  workStatus: string;
  clientName: string | null;
  clientPhone: string | null;
  createdAt: string;
  issuedOn: string | null;
  validUntil: string | null;
  discount: number;
  total: number;
  observation: string | null;
  originDocumentId: string | null;
  origin: DocRef | null; // documento de origem (se este for uma conversão)
  conversions: DocRef[]; // documentos gerados a partir deste
  items: DetailItem[];
  services: DetailService[];
  archivedAt: string | null;
};

export type TimelineEvent = {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
};

export async function getDocumentDetail(
  id: string
): Promise<{ data: DocumentFull | null; error: string | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, number, kind, work_status, created_at, issued_on, valid_until, discount, total, observation, origin_document_id, archived_at, " +
        "clients(name, phone), " +
        "document_items(description, quantity, unit_price, line_total, position), " +
        "document_services(description, price, position)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[detail] get", error?.message);
    return { data: null, error: "Atendimento não encontrado." };
  }

  const d: any = data;

  const items: DetailItem[] = (d.document_items ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((i: any) => ({
      description: i.description ?? "",
      quantity: Number(i.quantity ?? 0),
      unitPrice: Number(i.unit_price ?? 0),
      lineTotal: Number(i.line_total ?? 0),
    }));

  const services: DetailService[] = (d.document_services ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((s: any) => ({ description: s.description ?? "", price: Number(s.price ?? 0) }));

  // origem (se este documento foi gerado a partir de outro)
  let origin: DocRef | null = null;
  if (d.origin_document_id) {
    const { data: o } = await supabase
      .from("documents")
      .select("id, number, kind")
      .eq("id", d.origin_document_id)
      .single();
    if (o) origin = { id: o.id, number: o.number ?? null, kind: o.kind as DocumentKind };
  }

  // conversões (documentos que apontam para este como origem)
  const { data: conv } = await supabase
    .from("documents")
    .select("id, number, kind")
    .eq("origin_document_id", id)
    .order("created_at", { ascending: true });
  const conversions: DocRef[] = (conv ?? []).map((c: any) => ({
    id: c.id,
    number: c.number ?? null,
    kind: c.kind as DocumentKind,
  }));

  const client = clientObj(d.clients);

  return {
    data: {
      id: d.id,
      number: d.number ?? null,
      kind: d.kind,
      workStatus: d.work_status,
      clientName: client?.name ?? null,
      clientPhone: client?.phone ?? null,
      createdAt: d.created_at,
      issuedOn: d.issued_on ?? null,
      validUntil: d.valid_until ?? null,
      discount: Number(d.discount ?? 0),
      total: Number(d.total ?? 0),
      observation: d.observation ?? null,
      originDocumentId: d.origin_document_id ?? null,
      origin,
      conversions,
      items,
      services,
      archivedAt: d.archived_at ?? null,
    },
    error: null,
  };
}

export async function listDocumentEvents(
  documentId: string
): Promise<{ data: TimelineEvent[]; error: string | null }> {
  const { data, error } = await supabase
    .from("events")
    .select("id, type, summary, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[detail] events", error.message);
    return { data: [], error: "Não foi possível carregar o histórico." };
  }
  const rows: TimelineEvent[] = (data ?? []).map((e: any) => ({
    id: e.id,
    type: e.type,
    summary: e.summary,
    createdAt: e.created_at,
  }));
  return { data: rows, error: null };
}

// Converte um orçamento APROVADO em uma OS, copiando itens/serviços e mantendo o vínculo
// via origin_document_id. A OS nasce como rascunho (sem número).
export async function convertBudgetToOrder(
  budgetId: string
): Promise<{ id: string | null; error: string | null }> {
  const { data: b, error: bErr } = await supabase
    .from("documents")
    .select(
      "tenant_id, client_id, equipment_id, kind, work_status, discount, observation, total, " +
        "document_items(description, quantity, unit_price, line_total, position), " +
        "document_services(description, price, position)"
    )
    .eq("id", budgetId)
    .single();

  if (bErr || !b) {
    console.error("[detail] convert load", bErr?.message);
    return { id: null, error: "Orçamento não encontrado." };
  }

  const src: any = b;
  if (src.kind !== "budget") return { id: null, error: "Apenas orçamentos podem ser convertidos." };
  if (src.work_status !== "approved")
    return { id: null, error: "Só é possível converter um orçamento aprovado." };

  const { data: created, error: insErr } = await supabase
    .from("documents")
    .insert({
      tenant_id: src.tenant_id,
      client_id: src.client_id,
      equipment_id: src.equipment_id ?? null,
      kind: "service_order",
      origin_document_id: budgetId,
      discount: Number(src.discount ?? 0),
      observation: src.observation ?? null,
      total: Number(src.total ?? 0),
    })
    .select("id")
    .single();

  if (insErr || !created) {
    console.error("[detail] convert insert", insErr?.message);
    return { id: null, error: "Não foi possível criar a OS." };
  }

  const newId = created.id as string;
  const tenantId = src.tenant_id as string;

  const items = (src.document_items ?? [])
    .slice()
    .sort((a: any, z: any) => (a.position ?? 0) - (z.position ?? 0))
    .map((i: any, idx: number) => ({
      tenant_id: tenantId,
      document_id: newId,
      description: i.description,
      quantity: Number(i.quantity ?? 0),
      unit_price: Number(i.unit_price ?? 0),
      line_total: Number(i.line_total ?? 0),
      position: idx,
    }));
  if (items.length > 0) {
    const { error } = await supabase.from("document_items").insert(items);
    if (error) {
      await supabase.from("documents").delete().eq("id", newId);
      console.error("[detail] convert items", error.message);
      return { id: null, error: "Não foi possível copiar as peças para a OS." };
    }
  }

  const services = (src.document_services ?? [])
    .slice()
    .sort((a: any, z: any) => (a.position ?? 0) - (z.position ?? 0))
    .map((s: any, idx: number) => ({
      tenant_id: tenantId,
      document_id: newId,
      description: s.description,
      price: Number(s.price ?? 0),
      position: idx,
    }));
  if (services.length > 0) {
    const { error } = await supabase.from("document_services").insert(services);
    if (error) {
      await supabase.from("documents").delete().eq("id", newId);
      console.error("[detail] convert services", error.message);
      return { id: null, error: "Não foi possível copiar os serviços para a OS." };
    }
  }

  return { id: newId, error: null };
}

// ---- helpers ----

function clientObj(clients: any): { name: string | null; phone: string | null } | null {
  if (!clients) return null;
  const c = Array.isArray(clients) ? clients[0] : clients;
  if (!c) return null;
  return { name: c.name ?? null, phone: c.phone ?? null };
}

export function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
