// src/shared/clients/clients.ts
// Lógica de clientes (Etapa 4). Fica FORA das telas: as telas só chamam estas funções.
// RLS (clients_isolation, FOR ALL via public.tenant_id()) limita tudo ao próprio tenant.
// O trigger trg_clients_search preenche phone_normalized, search_text e updated_at — o app
// só envia name/phone/email/cpf_cnpj/notes (e tenant_id no insert).
// Deduplicação por telefone: índice único uq_clients_tenant_phone (tenant_id, phone_normalized).

import { supabase } from "../supabase";

export type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type ClientInput = {
  name: string;
  phone: string;
  email: string;
  cpfCnpj: string;
  notes: string;
};

export const emptyClient: ClientInput = {
  name: "",
  phone: "",
  email: "",
  cpfCnpj: "",
  notes: "",
};

const SELECT_COLS = "id, name, phone, email, cpf_cnpj, notes, created_at, archived_at";

// Lista clientes. Por padrão só ativos; includeArchived inclui os arquivados.
export async function listClients(
  includeArchived = false
): Promise<{ data: ClientRow[]; error: string | null }> {
  let query = supabase.from("clients").select(SELECT_COLS);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("[clients] list", error.message);
    return { data: [], error: "Não foi possível carregar os clientes. Tente de novo." };
  }
  return { data: (data ?? []).map(mapRow), error: null };
}

// Arquivamento (soft) — nunca exclui. Restauração volta archived_at para null.
export async function archiveClient(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[clients] archive", error.message);
    return { error: "Não foi possível arquivar o cliente." };
  }
  return { error: null };
}

export async function restoreClient(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("clients").update({ archived_at: null }).eq("id", id);
  if (error) {
    console.error("[clients] restore", error.message);
    return { error: "Não foi possível restaurar o cliente." };
  }
  return { error: null };
}

// Carrega um cliente para edição.
export async function getClient(
  id: string
): Promise<{ data: ClientRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("clients")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (error) {
    console.error("[clients] get", error.message);
    return { data: null, error: "Cliente não encontrado." };
  }
  return { data: mapRow(data), error: null };
}

// Cria um cliente. Exige nome e telefone. Trata telefone duplicado.
export async function createClient(input: ClientInput): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const { error } = await supabase.from("clients").insert({
    tenant_id: tenantId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: emptyToNull(input.email),
    cpf_cnpj: emptyToNull(input.cpfCnpj),
    notes: emptyToNull(input.notes),
  });

  return { error: translateWriteError(error) };
}

// Atualiza um cliente existente. Mesmas regras de validação e dedupe.
export async function updateClient(
  id: string,
  input: ClientInput
): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: emptyToNull(input.email),
      cpf_cnpj: emptyToNull(input.cpfCnpj),
      notes: emptyToNull(input.notes),
    })
    .eq("id", id);

  return { error: translateWriteError(error) };
}

// ---- helpers (privados) ----

function validate(input: ClientInput): string | null {
  if (!input.name.trim()) return "Informe o nome do cliente.";
  if (!input.phone.trim()) return "Informe o telefone do cliente.";
  return null;
}

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[clients] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

function translateWriteError(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "Já existe um cliente com este telefone.";
  console.error("[clients] write", error.message);
  return "Não foi possível salvar o cliente. Tente de novo.";
}

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function mapRow(r: any): ClientRow {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    email: r.email ?? null,
    cpfCnpj: r.cpf_cnpj ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    archivedAt: r.archived_at ?? null,
  };
}
