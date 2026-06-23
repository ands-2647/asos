// src/shared/charges/charges.ts
// Cobranças (fluxo "receber depois"). Fica FORA das telas. RLS: charges_isolation por tenant_id().
//
// A tabela charges NÃO tem triggers: criar cobrança NÃO mexe em payment_status nem gera
// evento sozinha. Por isso o app:
//  - ao CRIAR: insere a cobrança (status 'pending') e registra o evento 'charge_scheduled';
//  - ao RECEBER: registra um PAGAMENTO normal em payments (o trigger recalc_payment_status
//    recalcula payment_status e gera 'payment_registered'), marca a cobrança como 'done' e
//    registra o evento 'charge_done';
//  - ao CANCELAR: apenas muda o status para 'cancelled'.
//
// status no banco: 'pending' | 'done' | 'cancelled'. "Vencida" é DERIVADO
// (pending + vencimento < hoje) — não é um status armazenado.

import { supabase } from "../supabase";

export type ChargeDbStatus = "pending" | "done" | "cancelled";
export type ChargeViewStatus = "pending" | "overdue" | "done" | "cancelled";

export type Charge = {
  id: string;
  amount: number;
  dueDate: string; // 'YYYY-MM-DD'
  status: ChargeDbStatus;
  note: string | null;
  viewStatus: ChargeViewStatus; // derivado para exibição
};

export type ChargeInput = {
  amount: string;
  dueDate: string;
  note: string;
};

const CHARGE_STATUS_LABEL: Record<ChargeViewStatus, string> = {
  pending: "Pendente",
  overdue: "Vencida",
  done: "Recebida",
  cancelled: "Cancelada",
};

export function chargeStatusLabel(status: ChargeViewStatus): string {
  return CHARGE_STATUS_LABEL[status] ?? status;
}

function viewStatusOf(status: ChargeDbStatus, dueDate: string): ChargeViewStatus {
  if (status === "pending" && isPast(dueDate)) return "overdue";
  return status;
}

export async function listCharges(
  documentId: string
): Promise<{ data: Charge[]; error: string | null }> {
  const { data, error } = await supabase
    .from("charges")
    .select("id, amount, due_date, status, note")
    .eq("document_id", documentId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[charges] list", error.message);
    return { data: [], error: "Não foi possível carregar as cobranças." };
  }
  const rows: Charge[] = (data ?? []).map((c: any) => ({
    id: c.id,
    amount: Number(c.amount ?? 0),
    dueDate: c.due_date,
    status: c.status,
    note: c.note ?? null,
    viewStatus: viewStatusOf(c.status, c.due_date),
  }));
  return { data: rows, error: null };
}

// Cria a cobrança (status 'pending'). Não registra pagamento nem altera payment_status.
export async function createCharge(
  documentId: string,
  input: ChargeInput
): Promise<{ error: string | null }> {
  const amount = toNumber(input.amount);
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };
  if (!input.dueDate) return { error: "Informe a data de vencimento." };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const { data: created, error } = await supabase
    .from("charges")
    .insert({
      tenant_id: tenantId,
      document_id: documentId,
      amount,
      due_date: input.dueDate,
      status: "pending",
      note: emptyToNull(input.note),
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[charges] create", error?.message);
    return { error: "Não foi possível criar a cobrança." };
  }

  // evento de timeline (charges não tem trigger próprio)
  await logEvent(tenantId, documentId, "charge_scheduled", "Cobrança agendada", {
    amount,
    due_date: input.dueDate,
  });

  return { error: null };
}

// Cria UMA cobrança do valor em aberto (total - já recebido - já cobrado pendente),
// com vencimento hoje. Usada automaticamente na APROVAÇÃO do orçamento e no botão
// "Gerar cobrança do valor em aberto". Não duplica: se já estiver tudo cobrado, não cria.
export async function chargeOpenBalance(
  documentId: string
): Promise<{ error: string | null; created: boolean }> {
  const { data: doc } = await supabase.from("documents").select("total").eq("id", documentId).single();
  if (!doc) return { error: "Atendimento não encontrado.", created: false };
  const total = Number(doc.total ?? 0);

  const { data: pays } = await supabase.from("payments").select("amount").eq("document_id", documentId);
  const received = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0);

  const { data: pend } = await supabase
    .from("charges").select("amount").eq("document_id", documentId).eq("status", "pending");
  const alreadyCharged = (pend ?? []).reduce((a: number, c: any) => a + Number(c.amount ?? 0), 0);

  const open = round2(total - received - alreadyCharged);
  if (open <= 0.005) return { error: null, created: false };

  const { error } = await createCharge(documentId, {
    amount: String(open),
    dueDate: new Date().toISOString().slice(0, 10),
    note: "Valor a receber",
  });
  return { error, created: error == null };
}

// Recebe a cobrança: registra pagamento normal (dispara recalc_payment_status) e marca 'done'.
export async function settleCharge(
  charge: Charge,
  documentId: string,
  method: string
): Promise<{ error: string | null }> {
  if (charge.status !== "pending") return { error: "Esta cobrança já foi encerrada." };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  // 1) pagamento normal — o trigger recalcula payment_status e gera 'payment_registered'
  const pay = await supabase.from("payments").insert({
    tenant_id: tenantId,
    document_id: documentId,
    amount: charge.amount,
    method,
    paid_on: new Date().toISOString().slice(0, 10),
  });
  if (pay.error) {
    console.error("[charges] settle payment", pay.error.message);
    return { error: "Não foi possível registrar o pagamento da cobrança." };
  }

  // 2) cobrança -> recebida
  const upd = await supabase
    .from("charges")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", charge.id);
  if (upd.error) {
    console.error("[charges] settle update", upd.error.message);
    return { error: "Pagamento registrado, mas houve erro ao atualizar a cobrança." };
  }

  // 3) evento de timeline da cobrança
  await logEvent(tenantId, documentId, "charge_done", "Cobrança recebida", {
    amount: charge.amount,
    method,
  });

  return { error: null };
}

export async function cancelCharge(charge: Charge): Promise<{ error: string | null }> {
  if (charge.status !== "pending") return { error: "Só é possível cancelar cobranças pendentes." };
  const { error } = await supabase
    .from("charges")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", charge.id);
  if (error) {
    console.error("[charges] cancel", error.message);
    return { error: "Não foi possível cancelar a cobrança." };
  }
  return { error: null };
}

// ---- helpers ----

async function logEvent(
  tenantId: string,
  documentId: string,
  type: string,
  summary: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("events").insert({
    tenant_id: tenantId,
    type,
    document_id: documentId,
    summary,
    metadata,
  });
  if (error) console.error("[charges] event", type, error.message);
}

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[charges] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

function isPast(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}
// Moeda BR: "1000", "1.000", "1.000,00", "1000,00", "10,50".
function toNumber(v: string): number {
  let s = String(v ?? "").trim();
  if (s === "") return 0;
  const negative = s.startsWith("-");
  s = s.replace(/[^\d.,]/g, "");
  if (s === "") return 0;
  const dots = (s.match(/\./g) || []).length;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (dots > 1) s = s.replace(/\./g, "");
  else if (dots === 1 && (s.split(".")[1] ?? "").length === 3) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}
