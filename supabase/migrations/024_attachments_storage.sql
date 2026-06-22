-- 024_attachments_storage.sql
-- Etapa 8 (Anexos e Fotos): bucket de Storage + políticas por tenant + limpeza de retenção.
-- Idempotente.

-- 1) Bucket privado 'attachments' (2 MB, apenas imagens permitidas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Políticas de storage.objects escopadas por tenant.
--    Caminho do arquivo: <tenant_id>/<document_id>/<arquivo>. A 1ª pasta é o tenant.
drop policy if exists attachments_read_own on storage.objects;
create policy attachments_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.tenant_id()::text);

drop policy if exists attachments_insert_own on storage.objects;
create policy attachments_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.tenant_id()::text);

drop policy if exists attachments_delete_own on storage.objects;
create policy attachments_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.tenant_id()::text);

-- 3) Limpeza de retenção (15 dias). Não agendada — pode ser chamada por um job/Edge Function.
--    Apaga os REGISTROS expirados de attachments e RETORNA os storage_path
--    correspondentes, para que a remoção do arquivo físico seja feita via Storage API
--    (a deleção direta em storage.objects é bloqueada pelo trigger protect_objects_delete).
create or replace function public.cleanup_expired_attachments()
  returns text[]
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_paths text[];
begin
  with del as (
    delete from public.attachments
    where created_at < now() - interval '15 days'
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_paths from del;

  return v_paths;
end;
$$;
