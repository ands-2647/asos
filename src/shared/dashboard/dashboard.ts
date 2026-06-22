// src/shared/dashboard/dashboard.ts
// Dashboard executivo. SOMENTE leitura/agregação — não altera nada, sem migrations.
// Agrega no client-side (volume por tenant é pequeno). Ignora documentos arquivados,
// consistente com o financeiro. RLS já limita tudo ao tenant.
//
// Definições (verificáveis por SQL):
//  - faturamento = soma de payments.amount (de documentos não arquivados)
//  - ticket médio = média de documents.total (não arquivados)
//  - taxa de conversão = OS com origin_document_id / total de orçamentos

import { supabase } from "../supabase";

export type RankRow = { label: string; value: number; count: number };
export type MonthPoint = { month: string; label: string; value: number };

export type DashboardData = {
  revenueMonth: number;
  revenue30d: number;
  serviceOrderCount: number;
  budgetCount: number;
  avgTicket: number;
  activeClients: number;

  budgetsApproved: number;
  budgetsReproved: number;
  conversionRate: number; // 0..1

  topClients: RankRow[];
  topServices: RankRow[];
  topItems: RankRow[];

  revenueByMonth: MonthPoint[]; // 12 meses
  documentsByMonth: MonthPoint[]; // 12 meses
};

export async function loadDashboard(): Promise<{ data: DashboardData | null; error: string | null }> {
  const today = new Date();
  const todayIso = isoDate(today);
  const cutoff30 = isoDate(addDays(today, -30));
  const currentMonth = monthKey(today);
  const months = last12Months(today);

  const [paysRes, docsRes, clientsRes, itemsRes, servicesRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, paid_on, documents!inner(archived_at, clients(name))")
      .is("documents.archived_at", null),
    supabase
      .from("documents")
      .select("kind, work_status, total, created_at, origin_document_id")
      .is("archived_at", null),
    supabase.from("clients").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase
      .from("document_items")
      .select("description, quantity, line_total, documents!inner(archived_at)")
      .is("documents.archived_at", null),
    supabase
      .from("document_services")
      .select("description, price, documents!inner(archived_at)")
      .is("documents.archived_at", null),
  ]);

  const firstErr = paysRes.error || docsRes.error || clientsRes.error || itemsRes.error || servicesRes.error;
  if (firstErr) {
    console.error("[dashboard]", firstErr.message);
    return { data: null, error: "Não foi possível carregar o dashboard." };
  }

  const pays = paysRes.data ?? [];
  const docs = docsRes.data ?? [];

  // ---- faturamento ----
  let revenueMonth = 0;
  let revenue30d = 0;
  const revByMonth = new Map<string, number>();
  for (const p of pays as any[]) {
    const amount = Number(p.amount ?? 0);
    const paidOn: string = p.paid_on;
    if (paidOn?.slice(0, 7) === currentMonth) revenueMonth += amount;
    if (paidOn >= cutoff30 && paidOn <= todayIso) revenue30d += amount;
    const mk = paidOn?.slice(0, 7);
    if (mk) revByMonth.set(mk, (revByMonth.get(mk) ?? 0) + amount);
  }

  // ---- contagens / ticket / conversão ----
  let serviceOrderCount = 0;
  let budgetCount = 0;
  let budgetsApproved = 0;
  let budgetsReproved = 0;
  let convertedOs = 0;
  let totalSum = 0;
  const docsByMonth = new Map<string, number>();
  for (const d of docs as any[]) {
    totalSum += Number(d.total ?? 0);
    if (d.kind === "service_order") {
      serviceOrderCount++;
      if (d.origin_document_id) convertedOs++;
    } else if (d.kind === "budget") {
      budgetCount++;
      if (d.work_status === "approved") budgetsApproved++;
      if (d.work_status === "reproved") budgetsReproved++;
    }
    const mk = (d.created_at as string)?.slice(0, 7);
    if (mk) docsByMonth.set(mk, (docsByMonth.get(mk) ?? 0) + 1);
  }
  const avgTicket = docs.length > 0 ? round2(totalSum / docs.length) : 0;
  const conversionRate = budgetCount > 0 ? convertedOs / budgetCount : 0;

  // ---- rankings ----
  const topClients = rank(
    (pays as any[]).map((p) => ({ label: clientName(p.documents), value: Number(p.amount ?? 0) }))
  );
  const topServices = rank(
    ((servicesRes.data ?? []) as any[]).map((s) => ({
      label: s.description ?? "—",
      value: Number(s.price ?? 0),
    }))
  );
  const topItems = rank(
    ((itemsRes.data ?? []) as any[]).map((i) => ({
      label: i.description ?? "—",
      value: Number(i.line_total ?? 0),
    }))
  );

  return {
    data: {
      revenueMonth: round2(revenueMonth),
      revenue30d: round2(revenue30d),
      serviceOrderCount,
      budgetCount,
      avgTicket,
      activeClients: clientsRes.count ?? 0,
      budgetsApproved,
      budgetsReproved,
      conversionRate,
      topClients,
      topServices,
      topItems,
      revenueByMonth: months.map((m) => ({ month: m, label: monthLabel(m), value: round2(revByMonth.get(m) ?? 0) })),
      documentsByMonth: months.map((m) => ({ month: m, label: monthLabel(m), value: docsByMonth.get(m) ?? 0 })),
    },
    error: null,
  };
}

// ---- helpers ----

function rank(rows: { label: string; value: number }[]): RankRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const r of rows) {
    const key = (r.label ?? "—").trim() || "—";
    const cur = map.get(key) ?? { value: 0, count: 0 };
    cur.value += r.value;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, value: round2(v.value), count: v.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function clientName(documents: any): string {
  const doc = Array.isArray(documents) ? documents[0] : documents;
  const c = doc ? (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients) : null;
  return (c?.name ?? "—").trim() || "—";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function last12Months(d: Date): string[] {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthLabel(mk: string): string {
  const [y, m] = mk.split("-");
  return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
