-- 026_hardening.sql
-- Etapa 15 (Auditoria/Hardening). Apenas fortalece o que existe — sem novas features.
--
-- 1) Restringe EXECUTE de funções SECURITY DEFINER expostas via /rest/v1/rpc:
--    - cleanup_expired_attachments deve ser chamada SOMENTE pela Edge Function (service_role);
--    - funções de gatilho não devem ser chamáveis por clientes (gatilhos rodam como owner,
--      então revogar não afeta os triggers).
--    Mantidas intactas: tenant_id() (usada pelo RLS) e next_document_number() (chamada pelo app).
revoke execute on function public.cleanup_expired_attachments() from public;
grant execute on function public.cleanup_expired_attachments() to service_role;

revoke execute on function public.on_document_created() from public;
revoke execute on function public.on_document_status_changed() from public;
revoke execute on function public.recalc_payment_status() from public;

-- 2) Índices de cobertura para FKs usadas em joins frequentes do app.
create index if not exists idx_documents_client on public.documents (client_id);
create index if not exists idx_charges_document on public.charges (document_id);
create index if not exists idx_notifications_document on public.notifications (document_id);
