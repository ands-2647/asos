-- 025_charges_note.sql
-- Etapa 10 (Cobranças): observação opcional na cobrança.
-- Idempotente. Não altera status, triggers ou RLS.

alter table public.charges
  add column if not exists note text;
