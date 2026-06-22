// src/shared/attachments/attachments.ts
// Anexos (fotos) de um documento. Fica FORA das telas.
// Storage: bucket privado 'attachments', caminho <tenant_id>/<document_id>/<uuid>.<ext>.
// RLS: attachments_isolation (tabela) + políticas de storage.objects por tenant.
// Regras: até 5 fotos por documento, até 2 MB por arquivo, JPG/PNG/WEBP, com compressão.

import { supabase } from "../supabase";
import { compressImage } from "./imageCompression";

export const MAX_PHOTOS = 5;
export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const BUCKET = "attachments";
const SIGNED_TTL = 60 * 60; // 1 hora

export type Photo = {
  id: string;
  storagePath: string;
  createdAt: string;
  url: string | null; // URL assinada para exibição
};

export async function listPhotos(
  documentId: string
): Promise<{ data: Photo[]; error: string | null }> {
  const { data, error } = await supabase
    .from("attachments")
    .select("id, storage_path, created_at")
    .eq("document_id", documentId)
    .eq("kind", "photo")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[attachments] list", error.message);
    return { data: [], error: "Não foi possível carregar as fotos." };
  }

  const rows = data ?? [];
  const photos: Photo[] = await Promise.all(
    rows.map(async (r: any) => ({
      id: r.id,
      storagePath: r.storage_path,
      createdAt: r.created_at,
      url: await signedUrl(r.storage_path),
    }))
  );
  return { data: photos, error: null };
}

export async function uploadPhoto(
  documentId: string,
  file: File,
  currentCount: number
): Promise<{ error: string | null }> {
  if (currentCount >= MAX_PHOTOS) {
    return { error: `Limite de ${MAX_PHOTOS} fotos por atendimento.` };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Formato não suportado. Use JPG, PNG ou WEBP." };
  }

  // Compressão antes do upload; valida o tamanho final.
  let blob: Blob;
  let ext: string;
  let type: string;
  try {
    const out = await compressImage(file, MAX_BYTES);
    blob = out.blob;
    ext = out.ext;
    type = out.type;
  } catch (e) {
    console.error("[attachments] compress", e);
    return { error: "Não foi possível processar a imagem." };
  }
  if (blob.size > MAX_BYTES) {
    return { error: "A imagem ficou acima de 2 MB mesmo após compressão." };
  }

  const { tenantId, error: tErr } = await currentTenantId();
  if (tErr || !tenantId) return { error: tErr ?? "Tenant não encontrado." };

  const path = `${tenantId}/${documentId}/${cryptoRandom()}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: type,
    upsert: false,
  });
  if (up.error) {
    console.error("[attachments] upload", up.error.message);
    return { error: "Falha ao enviar a foto." };
  }

  const ins = await supabase.from("attachments").insert({
    tenant_id: tenantId,
    kind: "photo",
    origin: "user",
    storage_path: path,
    document_id: documentId,
  });
  if (ins.error) {
    // compensa: remove o objeto enviado se o registro falhar
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("[attachments] insert", ins.error.message);
    return { error: "Falha ao registrar a foto." };
  }

  return { error: null };
}

export async function deletePhoto(photo: Photo): Promise<{ error: string | null }> {
  const rm = await supabase.storage.from(BUCKET).remove([photo.storagePath]);
  if (rm.error) {
    console.error("[attachments] remove", rm.error.message);
    return { error: "Não foi possível excluir a foto." };
  }
  const del = await supabase.from("attachments").delete().eq("id", photo.id);
  if (del.error) {
    console.error("[attachments] delete row", del.error.message);
    return { error: "Foto removida do armazenamento, mas houve erro ao atualizar." };
  }
  return { error: null };
}

async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) {
    console.error("[attachments] signedUrl", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

async function currentTenantId(): Promise<{ tenantId: string | null; error: string | null }> {
  const { data, error } = await supabase.from("tenants").select("id").single();
  if (error || !data) {
    console.error("[attachments] tenant", error?.message);
    return { tenantId: null, error: "Não foi possível identificar sua conta." };
  }
  return { tenantId: data.id as string, error: null };
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
