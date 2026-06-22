// src/shared/home/home.ts
// Dados da Home. Lógica FORA da tela: a HomeScreen só chama loadHomeData().
// Tudo é limitado ao próprio tenant pelo RLS (policies *_isolation via public.tenant_id()),
// por isso não filtramos tenant_id manualmente.

import { supabase } from "../supabase";

export type DocumentKind = "budget" | "service_order";

export type RecentDoc = {
  id: string;
  kind: DocumentKind;
  workStatus: string;
  total: number;
  number: number | null;
  createdAt: string;
  clientName: string | null;
};

export type HomeData = {
  businessName: string;
  clientCount: number; // clientes ativos (não arquivados)
  documentCount: number; // atendimentos ativos (não arquivados)
  recentDocs: RecentDoc[];
};

export async function loadHomeData(): Promise<{
  data: HomeData | null;
  error: string | null;
}> {
  const [tenantRes, clientsRes, docsCountRes, recentRes] = await Promise.all([
    supabase.from("tenants").select("name").single(),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("documents")
      .select("id, kind, work_status, total, number, created_at, clients(name)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firstError =
    tenantRes.error || clientsRes.error || docsCountRes.error || recentRes.error;
  if (firstError) {
    console.error("[home]", firstError.message);
    return { data: null, error: "Não foi possível carregar a Home. Tente de novo." };
  }

  const recentDocs: RecentDoc[] = (recentRes.data ?? []).map((d: any) => ({
    id: d.id,
    kind: d.kind,
    workStatus: d.work_status,
    total: Number(d.total ?? 0),
    number: d.number ?? null,
    createdAt: d.created_at,
    clientName: clientNameOf(d.clients),
  }));

  return {
    data: {
      businessName: tenantRes.data?.name ?? "",
      clientCount: clientsRes.count ?? 0,
      documentCount: docsCountRes.count ?? 0,
      recentDocs,
    },
    error: null,
  };
}

// O embed clients(name) pode vir como objeto (relação to-one) ou array; tratamos os dois.
function clientNameOf(clients: any): string | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0]?.name ?? null;
  return clients.name ?? null;
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
