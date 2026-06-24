// src/shared/settings/settings.ts
// Configurações da empresa (tenants + tenant_settings). Fica FORA das telas.
// Usa apenas colunas existentes. Logo no bucket existente "attachments"
// (path <tenant_id>/logo/<uuid>.<ext>, coberto pela policy de Storage por tenant).
// RLS: tenants_isolation / tenant_settings_isolation por tenant_id().

import { supabase } from "../supabase";
import { compressImage } from "../attachments/imageCompression";

const BUCKET = "attachments";
const SIGNED_TTL = 60 * 60;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type CompanySettings = {
  name: string; // tenants.name
  cnpj: string;
  phone: string;
  whatsapp: string;
  address: string;
  pixKey: string;
  pixOwnerName: string;
  pixBank: string;
  defaultValidityDays: string;
  defaultObservation: string;
  logoPath: string | null; // tenant_settings.logo_url (caminho no Storage)
  logoUrl: string | null; // URL assinada para exibição
};

export type CompanyInput = {
  name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  address: string;
  pixKey: string;
  pixOwnerName: string;
  pixBank: string;
  defaultValidityDays: string;
  defaultObservation: string;
};

export async function loadCompanySettings(): Promise<{
  data: CompanySettings | null;
  error: string | null;
}> {
  const { data: tenant, error: tErr } = await supabase.from("tenants").select("name").single();
  if (tErr || !tenant) {
    console.error("[settings] tenant", tErr?.message);
    return { data: null, error: "Não foi possível carregar as configurações." };
  }
  const { data: s, error: sErr } = await supabase
    .from("tenant_settings")
    .select("cnpj, phone, whatsapp, address, pix_key, pix_owner_name, pix_bank, default_validity_days, default_observation, logo_url")
    .single();
  if (sErr) {
    console.error("[settings] settings", sErr.message);
    return { data: null, error: "Não foi possível carregar as configurações." };
  }

  const logoPath = s?.logo_url ?? null;
  return {
    data: {
      name: tenant.name ?? "",
      cnpj: s?.cnpj ?? "",
      phone: s?.phone ?? "",
      whatsapp: s?.whatsapp ?? "",
      address: s?.address ?? "",
      pixKey: s?.pix_key ?? "",
      pixOwnerName: s?.pix_owner_name ?? "",
      pixBank: s?.pix_bank ?? "",
      defaultValidityDays:
        s?.default_validity_days != null ? String(s.default_validity_days) : "",
      defaultObservation: s?.default_observation ?? "",
      logoPath,
      logoUrl: logoPath ? await signedUrl(logoPath) : null,
    },
    error: null,
  };
}

export async function saveCompanySettings(input: CompanyInput): Promise<{ error: string | null }> {
  if (!input.name.trim()) return { error: "Informe o nome da empresa." };

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const upTenant = await supabase.from("tenants").update({ name: input.name.trim() }).eq("id", tenantId);
  if (upTenant.error) {
    console.error("[settings] save tenant", upTenant.error.message);
    return { error: "Não foi possível salvar as configurações." };
  }

  const upSettings = await supabase
    .from("tenant_settings")
    .update({
      cnpj: emptyToNull(input.cnpj),
      phone: emptyToNull(input.phone),
      whatsapp: emptyToNull(input.whatsapp),
      address: emptyToNull(input.address),
      pix_key: emptyToNull(input.pixKey),
      pix_owner_name: emptyToNull(input.pixOwnerName),
      pix_bank: emptyToNull(input.pixBank),
      default_validity_days: parseIntOrNull(input.defaultValidityDays),
      default_observation: emptyToNull(input.defaultObservation),
    })
    .eq("tenant_id", tenantId);
  if (upSettings.error) {
    console.error("[settings] save settings", upSettings.error.message);
    return { error: "Não foi possível salvar as configurações." };
  }

  return { error: null };
}

// Faz upload (com compressão) e troca a logo: grava o novo caminho e remove o anterior.
export async function uploadLogo(
  file: File,
  previousPath: string | null
): Promise<{ url: string | null; error: string | null }> {
  // Aceita qualquer imagem: a compressão (canvas) reencoda para WEBP/JPEG antes do upload,
  // então fotos do iPhone (HEIC) também passam quando o navegador consegue decodificá-las.
  if (file.type && !file.type.startsWith("image/")) {
    return { url: null, error: "Selecione um arquivo de imagem (JPG, PNG, WEBP ou foto do celular)." };
  }
  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { url: null, error: tErr ?? "Tenant não encontrado." };

  let blob: Blob;
  let ext: string;
  let type: string;
  try {
    const out = await compressImage(file, LOGO_MAX_BYTES);
    blob = out.blob;
    ext = out.ext;
    type = out.type;
  } catch (e) {
    console.error("[settings] compress", e);
    return { url: null, error: "Não foi possível processar esta imagem. Tente uma foto JPG ou PNG." };
  }

  const path = `${tenantId}/logo/${cryptoRandom()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (up.error) {
    console.error("[settings] logo upload", up.error.message);
    return { url: null, error: "Falha ao enviar a logo." };
  }

  const upd = await supabase
    .from("tenant_settings")
    .update({ logo_url: path })
    .eq("tenant_id", tenantId);
  if (upd.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("[settings] logo persist", upd.error.message);
    return { url: null, error: "Falha ao salvar a logo." };
  }

  // remove o arquivo anterior (troca), se houver
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  return { url: await signedUrl(path), error: null };
}

export async function removeLogo(previousPath: string | null): Promise<{ error: string | null }> {
  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const upd = await supabase.from("tenant_settings").update({ logo_url: null }).eq("tenant_id", tenantId);
  if (upd.error) {
    console.error("[settings] logo remove persist", upd.error.message);
    return { error: "Não foi possível remover a logo." };
  }
  if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);
  return { error: null };
}

// ---- helpers ----

async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) {
    console.error("[settings] signedUrl", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[settings] tenant id", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
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
function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
