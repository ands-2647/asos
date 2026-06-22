-- 023_clients_contact_fields.sql
-- Etapa 4 (Cadastro de Clientes): campos opcionais de contato/identificação.
-- Idempotente. Não altera RLS nem o trigger de search_text/phone_normalized.

alter table public.clients
  add column if not exists email    text,
  add column if not exists cpf_cnpj text,
  add column if not exists notes    text;
