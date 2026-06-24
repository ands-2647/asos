-- Campos opcionais do favorecido Pix (aparecem, de forma compacta, na cobrança via WhatsApp).
-- Aditivo e nullable: não altera RLS nem quebra nada existente.
alter table public.tenant_settings
  add column if not exists pix_owner_name text,
  add column if not exists pix_bank text;
