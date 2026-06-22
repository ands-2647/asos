-- 022_onboarding.sql
-- Etapa 2 (Onboarding): marca de conclusão do onboarding por tenant.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Nota: a escrita já está coberta pelas políticas FOR ALL existentes
-- (tenants_isolation e tenant_settings_isolation), ambas escopadas por
-- public.tenant_id(). Por isso esta migration só adiciona a coluna.

alter table public.tenant_settings
  add column if not exists onboarded_at timestamptz;
