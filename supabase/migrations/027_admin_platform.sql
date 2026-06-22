-- Etapa 20 — Camada de administração da plataforma AS OS.
-- NÃO altera RLS/fluxos das tabelas de negócio. Apenas adiciona:
--  * papel de administrador da PLATAFORMA (distinto do role administrator/employee do tenant)
--  * status do tenant + campos de plano/cobrança
--  * tabelas exclusivas do admin (cobranças da plataforma + auditoria administrativa)
-- O acesso cruzado entre tenants acontece SÓ via RPCs SECURITY DEFINER (028),
-- nunca afrouxando as políticas *_isolation existentes.

-- 1) Identidade do admin da plataforma (separada de users.role).
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

drop policy if exists platform_admins_admin_only on public.platform_admins;
create policy platform_admins_admin_only on public.platform_admins
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 2) Status + plano/cobrança no tenant. DEFAULT 'pending' (novos cadastros aguardam aprovação).
alter table public.tenants
  add column if not exists status text not null default 'pending'
    check (status in ('pending','active','blocked','rejected','trial','expired')),
  add column if not exists plan_started_on date,
  add column if not exists plan_due_on date,
  add column if not exists plan_amount numeric not null default 0;

-- Tenants já existentes ficam ativos (não travar quem já usa).
update public.tenants set status = 'active' where status = 'pending';

-- 3) Cobranças da plataforma (exclusivo do admin).
create table if not exists public.platform_invoices (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  plan       text,
  amount     numeric not null default 0,
  due_date   date not null,
  status     text not null default 'pendente' check (status in ('pago','pendente','vencido')),
  paid_on    date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_invoices enable row level security;
drop policy if exists platform_invoices_admin_only on public.platform_invoices;
create policy platform_invoices_admin_only on public.platform_invoices
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create index if not exists platform_invoices_tenant_idx on public.platform_invoices(tenant_id);

-- 4) Auditoria administrativa (exclusivo do admin).
create table if not exists public.admin_audit (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  tenant_id     uuid references public.tenants(id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
drop policy if exists admin_audit_admin_only on public.admin_audit;
create policy admin_audit_admin_only on public.admin_audit
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create index if not exists admin_audit_created_idx on public.admin_audit(created_at desc);

-- 5) Seed: andersoncs2647@gmail.com é a única admin da plataforma.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'andersoncs2647@gmail.com'
on conflict (user_id) do nothing;
