// src/shared/notifications/notifications.ts
// Central de notificações. Fica FORA das telas. RLS: notifications_isolation por tenant_id().
//
// O banco NÃO gera notificações (sem trigger). A geração é feita pelo app sob demanda em
// syncNotifications(): varre charges/documents do tenant e INSERE as notificações que faltam,
// com dedupe (não cria outra se já existir uma NÃO LIDA do mesmo tipo + atendimento).
//
// Tipos (CHECK do banco): charge_due | budget_waiting | os_idle | account.
// "Lida" = read_at preenchido (read_at IS NULL = não lida).

import { supabase } from "../supabase";

export const NEAR_DUE_DAYS = 3; // cobrança "próxima do vencimento"
export const OS_IDLE_DAYS = 7; // OS "parada há muitos dias"

export type NotificationType = "charge_due" | "budget_waiting" | "os_idle" | "account";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  documentId: string | null;
  actionLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  charge_due: "Cobrança",
  budget_waiting: "Orçamento",
  os_idle: "Serviço",
  account: "Conta",
};
export function notificationTypeLabel(t: NotificationType): string {
  return TYPE_LABEL[t] ?? t;
}

// ---- leitura ----

export async function listNotifications(): Promise<{
  data: AppNotification[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, document_id, action_label, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notifications] list", error.message);
    return { data: [], error: "Não foi possível carregar as notificações." };
  }
  return { data: (data ?? []).map(mapRow), error: null };
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) {
    console.error("[notifications] count", error.message);
    return 0;
  }
  return count ?? 0;
}

// ---- marcar como lida ----

export async function markRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    console.error("[notifications] markRead", error.message);
    return { error: "Não foi possível marcar como lida." };
  }
  return { error: null };
}

export async function markAllRead(): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) {
    console.error("[notifications] markAllRead", error.message);
    return { error: "Não foi possível marcar todas como lidas." };
  }
  return { error: null };
}

// ---- geração (sync sob demanda, idempotente) ----

type Candidate = {
  type: NotificationType;
  title: string;
  documentId: string;
  actionLabel: string;
};

export async function syncNotifications(): Promise<{ created: number; error: string | null }> {
  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { created: 0, error: tErr };

  const today = isoDate(new Date());
  const horizon = isoDate(addDays(new Date(), NEAR_DUE_DAYS));
  const idleCutoff = new Date(Date.now() - OS_IDLE_DAYS * 86400000).toISOString();

  const candidates: Candidate[] = [];

  // 1) cobranças pendentes vencidas ou a vencer em <= NEAR_DUE_DAYS
  const { data: charges } = await supabase
    .from("charges")
    .select("document_id, due_date, documents!inner(archived_at)")
    .eq("status", "pending")
    .is("documents.archived_at", null)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true });
  for (const c of charges ?? []) {
    const overdue = (c as any).due_date < today;
    candidates.push({
      type: "charge_due",
      documentId: (c as any).document_id,
      title: overdue ? "Cobrança vencida" : "Cobrança próxima do vencimento",
      actionLabel: "Ver atendimento",
    });
  }

  // 2) orçamentos aguardando aprovação
  const { data: budgets } = await supabase
    .from("documents")
    .select("id")
    .eq("kind", "budget")
    .eq("work_status", "waiting")
    .is("archived_at", null);
  for (const b of budgets ?? []) {
    candidates.push({
      type: "budget_waiting",
      documentId: (b as any).id,
      title: "Orçamento aguardando aprovação",
      actionLabel: "Ver atendimento",
    });
  }

  // 3) OS em andamento parada há > OS_IDLE_DAYS
  const { data: idleOs } = await supabase
    .from("documents")
    .select("id")
    .eq("kind", "service_order")
    .eq("work_status", "in_progress")
    .is("archived_at", null)
    .lt("updated_at", idleCutoff);
  for (const o of idleOs ?? []) {
    candidates.push({
      type: "os_idle",
      documentId: (o as any).id,
      title: `Serviço em andamento há mais de ${OS_IDLE_DAYS} dias`,
      actionLabel: "Ver atendimento",
    });
  }

  if (candidates.length === 0) return { created: 0, error: null };

  // dedupe contra notificações NÃO LIDAS já existentes (tipo + documento)
  const { data: existing } = await supabase
    .from("notifications")
    .select("type, document_id")
    .is("read_at", null);
  const seen = new Set<string>((existing ?? []).map((n: any) => `${n.type}|${n.document_id ?? ""}`));

  const rows = candidates
    .filter((c) => {
      const key = `${c.type}|${c.documentId}`;
      if (seen.has(key)) return false;
      seen.add(key); // evita duplicar dentro do próprio lote
      return true;
    })
    .map((c) => ({
      tenant_id: tenantId,
      type: c.type,
      title: c.title,
      document_id: c.documentId,
      action_label: c.actionLabel,
    }));

  if (rows.length === 0) return { created: 0, error: null };

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] sync insert", error.message);
    return { created: 0, error: "Não foi possível gerar as notificações." };
  }
  return { created: rows.length, error: null };
}

// ---- helpers ----

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[notifications] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

function mapRow(n: any): AppNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    documentId: n.document_id ?? null,
    actionLabel: n.action_label ?? null,
    readAt: n.read_at ?? null,
    createdAt: n.created_at,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
