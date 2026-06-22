// src/shared/admin/admin.ts
// Camada de dados do painel administrativo AS OS. Conversa SOMENTE com as RPCs
// SECURITY DEFINER (migration 028), todas protegidas por is_platform_admin() no banco.
// Nada aqui afrouxa o isolamento de tenant: o cruzamento entre empresas é feito no
// servidor, sob verificação de permissão.

import { supabase } from "../supabase";

export type TenantStatus = "pending" | "active" | "blocked" | "rejected" | "trial" | "expired";
export type PlanCode = "trial" | "premium" | "full_access";

export type AdminTenantRow = {
  tenant_id: string;
  name: string;
  status: TenantStatus;
  plan: PlanCode;
  plan_label: string;
  plan_amount: number;
  plan_started_on: string | null;
  plan_due_on: string | null;
  days_left: number | null;
  owner_name: string | null;
  owner_email: string | null;
  last_sign_in_at: string | null;
  clients_count: number;
  documents_count: number;
  created_at: string;
};

export type AdminTenantDetail = {
  tenant: {
    id: string;
    name: string;
    vertical: string | null;
    plan: PlanCode;
    plan_label: string;
    status: TenantStatus;
    plan_amount: number;
    plan_started_on: string | null;
    plan_due_on: string | null;
    days_left: number | null;
    created_at: string;
  };
  settings: {
    cnpj: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    pix_key: string | null;
    logo_url: string | null;
    default_observation: string | null;
  } | null;
  owner: { name: string | null; phone: string | null; email: string | null; last_sign_in_at: string | null };
  metrics: {
    clients: number;
    documents: number;
    budgets: number;
    service_orders: number;
    revenue_total: number;
    receivable: number;
  };
  recent_documents: Array<{
    id: string;
    kind: "budget" | "service_order";
    number: number | null;
    work_status: string;
    payment_status: string;
    total: number;
    created_at: string;
    client_name: string | null;
  }>;
  recent_clients: Array<{ id: string; name: string; phone: string | null; created_at: string }>;
};

export type AdminMetrics = {
  companies_total: number;
  active: number;
  trial: number;
  pending: number;
  expired: number;
  blocked: number;
  rejected: number;
  cancellations: number;
  overdue: number;
  due_soon: number;
  invoices_overdue: number;
  invoices_open_amount: number;
  mrr: number;
  annual: number;
};

export type AdminInvoice = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan: string | null;
  amount: number;
  due_date: string;
  status: "pago" | "pendente" | "vencido";
  effective_status: "pago" | "pendente" | "vencido";
  paid_on: string | null;
  created_at: string;
};

export type AdminAuditRow = {
  id: string;
  admin_email: string | null;
  action: string;
  tenant_id: string | null;
  tenant_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Result<T> = { data: T; error: string | null };

function fail(label: string, msg?: string): string {
  if (msg) console.error(`[admin] ${label}:`, msg);
  return "Não foi possível concluir a operação. Tente novamente.";
}

// ---- permissão ----

export async function amIPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) {
    console.error("[admin] is_platform_admin:", error.message);
    return false;
  }
  return data === true;
}

// ---- empresas ----

export async function listTenants(): Promise<Result<AdminTenantRow[]>> {
  const { data, error } = await supabase.rpc("admin_list_tenants");
  if (error) return { data: [], error: fail("list_tenants", error.message) };
  return { data: (data as AdminTenantRow[]) ?? [], error: null };
}

export async function getTenant(tenantId: string): Promise<Result<AdminTenantDetail | null>> {
  const { data, error } = await supabase.rpc("admin_get_tenant", { p_tenant_id: tenantId });
  if (error) return { data: null, error: fail("get_tenant", error.message) };
  return { data: data as AdminTenantDetail, error: null };
}

// Visão de suporte ("Entrar como cliente"): registra auditoria e devolve o detalhe.
export async function enterTenant(tenantId: string): Promise<Result<AdminTenantDetail | null>> {
  const { data, error } = await supabase.rpc("admin_enter_tenant", { p_tenant_id: tenantId });
  if (error) return { data: null, error: fail("enter_tenant", error.message) };
  return { data: data as AdminTenantDetail, error: null };
}

export async function setTenantStatus(
  tenantId: string,
  status: TenantStatus,
  action?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_status", {
    p_tenant_id: tenantId,
    p_status: status,
    p_action: action ?? null,
  });
  return { error: error ? fail("set_status", error.message) : null };
}

export type CompanyEdit = {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  whatsapp: string;
  pix: string;
  logoUrl: string;
  observation: string;
};

export async function updateCompany(tenantId: string, c: CompanyEdit): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_update_company", {
    p_tenant_id: tenantId,
    p_name: c.name,
    p_cnpj: c.cnpj,
    p_address: c.address,
    p_phone: c.phone,
    p_whatsapp: c.whatsapp,
    p_pix: c.pix,
    p_logo_url: c.logoUrl,
    p_observation: c.observation,
  });
  return { error: error ? fail("update_company", error.message) : null };
}

export async function setPlan(
  tenantId: string,
  plan: PlanCode,
  amount: number,
  startedOn: string | null,
  dueOn: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_plan", {
    p_tenant_id: tenantId,
    p_plan: plan,
    p_amount: amount,
    p_started_on: startedOn,
    p_due_on: dueOn,
  });
  return { error: error ? fail("set_plan", error.message) : null };
}

// ---- métricas ----

export async function getMetrics(): Promise<Result<AdminMetrics | null>> {
  const { data, error } = await supabase.rpc("admin_metrics");
  if (error) return { data: null, error: fail("metrics", error.message) };
  return { data: data as AdminMetrics, error: null };
}

// ---- suporte avançado / cobrança ----

// Edição de configurações no modo suporte (auditado no servidor).
export async function updateSettings(tenantId: string, validityDays: number | null): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_update_settings", {
    p_tenant_id: tenantId,
    p_validity_days: validityDays,
  });
  return { error: error ? fail("update_settings", error.message) : null };
}

// Disparo manual do ciclo de cobrança (o automático roda diariamente via pg_cron).
export async function runBillingCycle(): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_run_billing_cycle");
  if (error) return { data: null, error: fail("run_billing", error.message) };
  return { data, error: null };
}

// ---- cobranças ----

export async function listInvoices(): Promise<Result<AdminInvoice[]>> {
  const { data, error } = await supabase.rpc("admin_list_invoices");
  if (error) return { data: [], error: fail("list_invoices", error.message) };
  return { data: (data as AdminInvoice[]) ?? [], error: null };
}

export async function createInvoice(
  tenantId: string,
  plan: string,
  amount: number,
  dueDate: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_create_invoice", {
    p_tenant_id: tenantId,
    p_plan: plan,
    p_amount: amount,
    p_due_date: dueDate,
  });
  return { error: error ? fail("create_invoice", error.message) : null };
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: "pago" | "pendente" | "vencido"
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_invoice_status", {
    p_id: invoiceId,
    p_status: status,
  });
  return { error: error ? fail("set_invoice_status", error.message) : null };
}

// ---- auditoria ----

export async function listAudit(limit = 200): Promise<Result<AdminAuditRow[]>> {
  const { data, error } = await supabase.rpc("admin_list_audit", { p_limit: limit });
  if (error) return { data: [], error: fail("list_audit", error.message) };
  return { data: (data as AdminAuditRow[]) ?? [], error: null };
}

// ---- helpers de UI ----

export function formatBRL(value: number): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function statusLabel(s: TenantStatus): string {
  switch (s) {
    case "pending": return "Aguardando";
    case "active": return "Ativa";
    case "blocked": return "Bloqueada";
    case "rejected": return "Rejeitada";
    case "trial": return "Trial";
    case "expired": return "Vencida";
  }
}

export const PLAN_LABELS: Record<PlanCode, string> = {
  trial: "Trial",
  premium: "Mensal",
  full_access: "Vitalício",
};
