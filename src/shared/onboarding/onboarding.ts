// src/shared/onboarding/onboarding.ts
// Lógica do onboarding (Etapa 2). Fica FORA das telas: a tela só chama estas funções.
// Escreve em tenants (name, vertical) e tenant_settings (contato/cobrança/padrões + onboarded_at).
// O RLS já limita tudo ao próprio tenant via public.tenant_id(); por isso não passamos
// tenant_id manualmente — o banco resolve sozinho.

import { supabase } from "../supabase";

// Formato usado pelo formulário (tudo string para casar com os inputs).
export type BusinessProfile = {
  name: string; // tenants.name (obrigatório)
  vertical: string; // tenants.vertical
  whatsapp: string;
  phone: string;
  address: string;
  cnpj: string;
  pixKey: string; // tenant_settings.pix_key
  defaultValidityDays: string; // tenant_settings.default_validity_days (inteiro como texto)
  defaultObservation: string; // tenant_settings.default_observation
};

export const emptyProfile: BusinessProfile = {
  name: "",
  vertical: "",
  whatsapp: "",
  phone: "",
  address: "",
  cnpj: "",
  pixKey: "",
  defaultValidityDays: "",
  defaultObservation: "",
};

// Carrega os dados atuais para pré-preencher o wizard (o nome vem do signup).
export async function loadBusinessProfile(): Promise<{
  data: BusinessProfile | null;
  error: string | null;
}> {
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("name, vertical")
    .single();
  if (tErr) return { data: null, error: friendly(tErr.message) };

  const { data: s, error: sErr } = await supabase
    .from("tenant_settings")
    .select(
      "whatsapp, phone, address, cnpj, pix_key, default_validity_days, default_observation"
    )
    .single();
  if (sErr) return { data: null, error: friendly(sErr.message) };

  return {
    data: {
      name: tenant?.name ?? "",
      vertical: tenant?.vertical ?? "",
      whatsapp: s?.whatsapp ?? "",
      phone: s?.phone ?? "",
      address: s?.address ?? "",
      cnpj: s?.cnpj ?? "",
      pixKey: s?.pix_key ?? "",
      defaultValidityDays:
        s?.default_validity_days != null ? String(s.default_validity_days) : "",
      defaultObservation: s?.default_observation ?? "",
    },
    error: null,
  };
}

// Salva o perfil do negócio e marca o onboarding como concluído (onboarded_at = agora).
export async function completeOnboarding(
  p: BusinessProfile
): Promise<{ error: string | null }> {
  if (!p.name.trim()) return { error: "Informe o nome do negócio." };

  // Descobre o id do próprio tenant (o RLS retorna apenas o do usuário logado).
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id")
    .single();
  if (tErr || !tenant) return { error: describeError(tErr) };

  const tenantId = tenant.id as string;

  // tenants: nome e ramo de atividade.
  // O ramo vem como rótulo em PT (ex.: "Oficina mecânica") da tela, mas a coluna
  // tenants.vertical só aceita os macro-segmentos do banco (ADR 0018). Mapeamos aqui
  // para um valor válido da constraint tenants_vertical_check; vazio continua null.
  const { error: upTenant } = await supabase
    .from("tenants")
    .update({ name: p.name.trim(), vertical: mapVertical(p.vertical) })
    .eq("id", tenantId);
  if (upTenant) return { error: describeError(upTenant) };

  // tenant_settings: contato, cobrança, padrões + marca de conclusão
  const { error: upSettings } = await supabase
    .from("tenant_settings")
    .update({
      whatsapp: emptyToNull(p.whatsapp),
      phone: emptyToNull(p.phone),
      address: emptyToNull(p.address),
      cnpj: emptyToNull(p.cnpj),
      pix_key: emptyToNull(p.pixKey),
      default_validity_days: parseIntOrNull(p.defaultValidityDays),
      default_observation: emptyToNull(p.defaultObservation),
      onboarded_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (upSettings) return { error: describeError(upSettings) };

  return { error: null };
}

// True se o tenant já concluiu o onboarding (usado pelo guard de rotas).
export async function isOnboarded(): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("onboarded_at")
    .single();
  if (error) return false; // sem linha/coluna ou sem permissão => trata como não concluído
  return !!data?.onboarded_at;
}

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function parseIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function friendly(msg?: string): string {
  if (msg) console.error("[onboarding]", msg);
  return "Não foi possível salvar agora. Verifique a conexão e tente de novo.";
}

// Valores aceitos pela constraint tenants_vertical_check (não alteramos o banco).
const VALID_VERTICALS = ["automotive_services", "technical_assistance"];

// Converte o rótulo do campo "Ramo de atividade" para um valor válido da constraint.
// - vazio -> null (mantém o comportamento atual)
// - valor já válido -> passa direto
// - qualquer rótulo do nicho (todos os oferecidos na tela são automotivos) -> automotive_services
function mapVertical(label: string): string | null {
  const t = (label ?? "").trim();
  if (t === "") return null;
  if (VALID_VERTICALS.includes(t)) return t;
  return "automotive_services";
}

// Mensagem de erro específica: separa falha de VALIDAÇÃO do banco (constraint) de falha
// de CONEXÃO. Antes, todo erro virava "Verifique a conexão" — o que era enganoso.
function describeError(err?: { code?: string; message?: string; details?: string } | null): string {
  if (err) console.error("[onboarding]", err.code, err.message, err.details);
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  if (code.startsWith("23") || /constraint|violates|invalid input|check/i.test(msg)) {
    return "Não foi possível concluir: confira os dados informados e tente de novo.";
  }
  return "Não foi possível salvar agora. Verifique a conexão e tente de novo.";
}
