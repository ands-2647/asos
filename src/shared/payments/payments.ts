// src/shared/payments/payments.ts
// Pagamentos de um documento. Fica FORA das telas.
// O app só insere a linha em payments — o trigger recalc_payment_status() recalcula
// documents.payment_status (paid/partial) e gera o evento 'payment_registered'.
// RLS: payments_isolation por tenant_id().
//
// Método: a coluna aceita 'dinheiro' | 'pix' | 'cartao' | 'outro'. "Transferência" é
// exibida na UI mas gravada como 'outro' (decisão do produto, sem migration).

import { supabase } from "../supabase";

export type PaymentRow = {
  id: string;
  amount: number;
  method: string; // valor do banco
  paidOn: string; // 'YYYY-MM-DD'
  createdAt: string;
};

export type PaymentInput = {
  amount: string;
  method: string; // já no valor do banco
  paidOn: string;
};

export type FinancialSummary = {
  total: number;
  received: number;
  balance: number;
  status: string; // payment_status do banco
};

// Opções para o formulário. value = valor gravado no banco.
export const PAYMENT_METHOD_OPTIONS: { label: string; value: string }[] = [
  { label: "Dinheiro", value: "dinheiro" },
  { label: "PIX", value: "pix" },
  { label: "Cartão", value: "cartao" },
  { label: "Transferência", value: "outro" },
  { label: "Outros", value: "outro" },
];

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao: "Cartão",
  outro: "Outros",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  uncharged: "Em aberto",
  receivable: "A receber",
  partial: "Parcial",
  paid: "Pago",
};

export function methodLabel(value: string): string {
  return METHOD_LABEL[value] ?? value;
}
export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export async function listPayments(
  documentId: string
): Promise<{ data: PaymentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, method, paid_on, created_at")
    .eq("document_id", documentId)
    .order("paid_on", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[payments] list", error.message);
    return { data: [], error: "Não foi possível carregar os pagamentos." };
  }
  const rows: PaymentRow[] = (data ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    method: p.method,
    paidOn: p.paid_on,
    createdAt: p.created_at,
  }));
  return { data: rows, error: null };
}

export async function getFinancialSummary(
  documentId: string
): Promise<{ data: FinancialSummary | null; error: string | null }> {
  const { data: doc, error: dErr } = await supabase
    .from("documents")
    .select("total, payment_status")
    .eq("id", documentId)
    .single();
  if (dErr || !doc) {
    console.error("[payments] summary doc", dErr?.message);
    return { data: null, error: "Não foi possível carregar o financeiro." };
  }

  const { data: pays, error: pErr } = await supabase
    .from("payments")
    .select("amount")
    .eq("document_id", documentId);
  if (pErr) {
    console.error("[payments] summary pays", pErr.message);
    return { data: null, error: "Não foi possível carregar o financeiro." };
  }

  const total = Number(doc.total ?? 0);
  const received = (pays ?? []).reduce((acc: number, p: any) => acc + Number(p.amount ?? 0), 0);
  const balance = round2(Math.max(total - received, 0));

  return {
    data: { total, received: round2(received), balance, status: doc.payment_status },
    error: null,
  };
}

export async function addPayment(
  documentId: string,
  input: PaymentInput
): Promise<{ error: string | null }> {
  const amount = toNumber(input.amount);
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };
  if (!input.paidOn) return { error: "Informe a data do pagamento." };
  if (!input.method) return { error: "Selecione o método de pagamento." };

  // Não permitir receber acima do saldo em aberto (evita financeiro inconsistente).
  const { data: sum } = await getFinancialSummary(documentId);
  if (sum && amount > sum.balance + 0.005) {
    return {
      error: `O valor é maior que o saldo em aberto (${formatBRL(sum.balance)}).`,
    };
  }

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const { error } = await supabase.from("payments").insert({
    tenant_id: tenantId,
    document_id: documentId,
    amount,
    method: input.method,
    paid_on: input.paidOn,
  });

  if (error) {
    console.error("[payments] insert", error.message);
    return { error: "Não foi possível registrar o pagamento." };
  }
  return { error: null };
}

// ---- helpers ----

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[payments] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

// Padrão brasileiro de moeda: "1000", "1.000", "1.000,00", "1000,00", "10,50", "10.50".
function toNumber(v: string): number {
  let s = String(v ?? "").trim();
  if (s === "") return 0;
  const negative = s.startsWith("-");
  s = s.replace(/[^\d.,]/g, "");
  if (s === "") return 0;
  const dots = (s.match(/\./g) || []).length;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (dots > 1) {
    s = s.replace(/\./g, "");
  } else if (dots === 1) {
    const after = s.split(".")[1] ?? "";
    if (after.length === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function formatBRL(value: number): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
