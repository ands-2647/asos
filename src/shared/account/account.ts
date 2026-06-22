// src/shared/account/account.ts
// Status da conta (tenant) do usuário logado — usado pelo gate do app cliente.
// Lê via RPC my_account_status() (SECURITY DEFINER), sem alterar nada.

import { supabase } from "../supabase";

export type AccountStatus =
  | "pending"
  | "active"
  | "blocked"
  | "rejected"
  | "trial"
  | "expired";

// Status que liberam o uso normal do app.
const USABLE: AccountStatus[] = ["active", "trial"];

export function isUsableStatus(status: AccountStatus | null): boolean {
  return status != null && USABLE.includes(status);
}

export async function getMyAccountStatus(): Promise<AccountStatus | null> {
  const { data, error } = await supabase.rpc("my_account_status");
  if (error) {
    console.error("[account] my_account_status:", error.message);
    return null;
  }
  return (data as AccountStatus) ?? null;
}

export type BillingStatus = {
  status: AccountStatus;
  plan: string;
  plan_due_on: string | null;
  days_left: number | null;
};

export async function getMyBillingStatus(): Promise<BillingStatus | null> {
  const { data, error } = await supabase.rpc("my_billing_status");
  if (error) {
    console.error("[account] my_billing_status:", error.message);
    return null;
  }
  return (data as BillingStatus) ?? null;
}
