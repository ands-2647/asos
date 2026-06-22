// src/shared/financial/financial.ts
// Dashboard financeiro + agenda de cobranças. Somente LEITURA/agregação — não altera
// payment_status, não cria triggers, não muda regras financeiras. RLS: as tabelas já
// limitam ao tenant (charges/payments/documents/clients *_isolation). Lógica fora das telas.

import { supabase } from "../supabase";
import { kindLabel, formatBRL, formatShortDate, type DocumentKind } from "../documents/documents";
import { methodLabel } from "../payments/payments";

export const UPCOMING_DAYS = 7;

export type FinancialSummary = {
  totalReceivable: number; // soma de todas as cobranças pendentes
  overdueAmount: number;
  overdueCount: number;
  upcomingAmount: number; // pendentes vencendo em <= UPCOMING_DAYS
  upcomingCount: number;
  receivedThisMonth: number; // pagamentos com paid_on no mês corrente
};

export type ChargeAgendaRow = {
  chargeId: string;
  documentId: string;
  clientName: string | null;
  docLabel: string; // "Orçamento #3" / "OS (rascunho)"
  amount: number;
  dueDate: string;
  daysLate: number; // só relevante para vencidas
};

export type RecentPayment = {
  id: string;
  clientName: string | null;
  amount: number;
  method: string;
  paidOn: string;
};

export type FinancialData = {
  summary: FinancialSummary;
  overdue: ChargeAgendaRow[];
  upcoming: ChargeAgendaRow[];
  recentPayments: RecentPayment[];
};

export async function loadFinancial(): Promise<{ data: FinancialData | null; error: string | null }> {
  const today = isoDate(new Date());
  const horizon = isoDate(addDays(new Date(), UPCOMING_DAYS));
  const monthStart = monthStartISO(new Date());

  const [pendingRes, recentRes, monthRes] = await Promise.all([
    supabase
      .from("charges")
      .select("id, amount, due_date, document_id, documents!inner(number, kind, archived_at, clients(name))")
      .eq("status", "pending")
      .is("documents.archived_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("payments")
      .select("id, amount, method, paid_on, documents!inner(archived_at, clients(name))")
      .is("documents.archived_at", null)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("payments")
      .select("amount, documents!inner(archived_at)")
      .is("documents.archived_at", null)
      .gte("paid_on", monthStart),
  ]);

  const firstError = pendingRes.error || recentRes.error || monthRes.error;
  if (firstError) {
    console.error("[financial] load", firstError.message);
    return { data: null, error: "Não foi possível carregar o financeiro." };
  }

  const pending = (pendingRes.data ?? []).map((c: any) => {
    const doc = oneOf(c.documents);
    const client = doc ? oneOf(doc.clients) : null;
    return {
      chargeId: c.id as string,
      documentId: c.document_id as string,
      amount: Number(c.amount ?? 0),
      dueDate: c.due_date as string,
      clientName: client?.name ?? null,
      docLabel: docLabel(doc?.kind, doc?.number ?? null),
    };
  });

  const overdue: ChargeAgendaRow[] = pending
    .filter((r) => r.dueDate < today)
    .map((r) => ({ ...r, daysLate: daysBetween(r.dueDate, today) }));

  const upcoming: ChargeAgendaRow[] = pending
    .filter((r) => r.dueDate >= today && r.dueDate <= horizon)
    .map((r) => ({ ...r, daysLate: 0 }));

  const totalReceivable = round2(pending.reduce((a, r) => a + r.amount, 0));
  const overdueAmount = round2(overdue.reduce((a, r) => a + r.amount, 0));
  const upcomingAmount = round2(upcoming.reduce((a, r) => a + r.amount, 0));
  const receivedThisMonth = round2(
    (monthRes.data ?? []).reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0)
  );

  const recentPayments: RecentPayment[] = (recentRes.data ?? []).map((p: any) => {
    const doc = oneOf(p.documents);
    const client = doc ? oneOf(doc.clients) : null;
    return {
      id: p.id,
      clientName: client?.name ?? null,
      amount: Number(p.amount ?? 0),
      method: p.method,
      paidOn: p.paid_on,
    };
  });

  return {
    data: {
      summary: {
        totalReceivable,
        overdueAmount,
        overdueCount: overdue.length,
        upcomingAmount,
        upcomingCount: upcoming.length,
        receivedThisMonth,
      },
      overdue,
      upcoming,
      recentPayments,
    },
    error: null,
  };
}

// reexports úteis para a tela (evita a tela importar de vários módulos)
export { formatBRL, formatShortDate, methodLabel };

// ---- helpers ----

function docLabel(kind: DocumentKind | undefined, number: number | null): string {
  if (!kind) return "Atendimento";
  return `${kindLabel(kind)}${number != null ? ` #${number}` : " (rascunho)"}`;
}
function oneOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
function monthStartISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
}
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
