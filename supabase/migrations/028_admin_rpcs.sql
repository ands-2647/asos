-- Etapa 20 — RPCs administrativas. Todas SECURITY DEFINER + guard is_platform_admin().
-- O acesso cruzado entre tenants existe SOMENTE aqui (controlado), sem mexer nas
-- políticas *_isolation. Cliente comum nunca alcança dados de outro tenant.

create or replace function public.plan_label(p text)
returns text language sql immutable as $$
  select case p
    when 'trial' then 'Trial'
    when 'premium' then 'Mensal'
    when 'full_access' then 'Vitalício'
    else coalesce(p, '—') end;
$$;

-- Status da conta do usuário logado (gate do app cliente).
create or replace function public.my_account_status()
returns text language sql stable security definer set search_path to 'public' as $$
  select status from public.tenants where id = public.tenant_id();
$$;

-- Lista de empresas (painel admin).
create or replace function public.admin_list_tenants()
returns table (
  tenant_id uuid, name text, status text, plan text, plan_label text,
  plan_amount numeric, plan_started_on date, plan_due_on date, days_left int,
  owner_name text, owner_email text, last_sign_in_at timestamptz,
  clients_count bigint, documents_count bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select t.id, t.name, t.status, t.plan, public.plan_label(t.plan),
         t.plan_amount, t.plan_started_on, t.plan_due_on,
         case when t.plan_due_on is not null then (t.plan_due_on - current_date) else null end,
         ow.name, au.email::text, au.last_sign_in_at,
         (select count(*) from public.clients c where c.tenant_id = t.id and c.archived_at is null),
         (select count(*) from public.documents d where d.tenant_id = t.id and d.archived_at is null),
         t.created_at
  from public.tenants t
  left join lateral (
    select u.id, u.name, u.phone from public.users u
    where u.tenant_id = t.id and u.role = 'administrator'
    order by u.created_at limit 1
  ) ow on true
  left join auth.users au on au.id = ow.id
  order by t.created_at desc;
end; $$;

-- Detalhe completo de uma empresa (detalhe/editar + visão de suporte).
create or replace function public.admin_get_tenant(p_tenant_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'tenant', to_jsonb(t.*) || jsonb_build_object('plan_label', public.plan_label(t.plan),
              'days_left', case when t.plan_due_on is not null then (t.plan_due_on - current_date) else null end),
    'settings', to_jsonb(s.*),
    'owner', jsonb_build_object('name', ow.name, 'phone', ow.phone, 'email', au.email, 'last_sign_in_at', au.last_sign_in_at),
    'metrics', jsonb_build_object(
      'clients', (select count(*) from public.clients c where c.tenant_id = t.id and c.archived_at is null),
      'documents', (select count(*) from public.documents d where d.tenant_id = t.id and d.archived_at is null),
      'budgets', (select count(*) from public.documents d where d.tenant_id = t.id and d.kind = 'budget' and d.archived_at is null),
      'service_orders', (select count(*) from public.documents d where d.tenant_id = t.id and d.kind = 'service_order' and d.archived_at is null),
      'revenue_total', (select coalesce(sum(p.amount), 0) from public.payments p join public.documents d on d.id = p.document_id where d.tenant_id = t.id and d.archived_at is null),
      'receivable', (select coalesce(sum(c.amount), 0) from public.charges c where c.tenant_id = t.id and c.status = 'pending')
    ),
    'recent_documents', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select d.id, d.kind, d.number, d.work_status, d.payment_status, d.total, d.created_at,
               cl.name as client_name
        from public.documents d left join public.clients cl on cl.id = d.client_id
        where d.tenant_id = t.id and d.archived_at is null
        order by d.created_at desc limit 20
      ) x),
    'recent_clients', (
      select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) from (
        select c.id, c.name, c.phone, c.created_at
        from public.clients c where c.tenant_id = t.id and c.archived_at is null
        order by c.created_at desc limit 20
      ) y)
  )
  into v
  from public.tenants t
  left join public.tenant_settings s on s.tenant_id = t.id
  left join lateral (
    select u.id, u.name, u.phone from public.users u
    where u.tenant_id = t.id and u.role = 'administrator'
    order by u.created_at limit 1
  ) ow on true
  left join auth.users au on au.id = ow.id
  where t.id = p_tenant_id;

  if v is null then raise exception 'tenant not found'; end if;
  return v;
end; $$;

create or replace function public.admin_set_status(p_tenant_id uuid, p_status text, p_action text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('pending','active','blocked','rejected','trial','expired') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.tenants set status = p_status where id = p_tenant_id;
  if not found then raise exception 'tenant not found'; end if;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), coalesce(p_action, 'set_status'), p_tenant_id, jsonb_build_object('status', p_status));
end; $$;

create or replace function public.admin_update_company(
  p_tenant_id uuid, p_name text, p_cnpj text, p_address text, p_phone text,
  p_whatsapp text, p_pix text, p_logo_url text, p_observation text
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tenants set name = coalesce(nullif(trim(p_name), ''), name) where id = p_tenant_id;
  if not found then raise exception 'tenant not found'; end if;
  update public.tenant_settings set
    cnpj = nullif(trim(coalesce(p_cnpj, '')), ''),
    address = nullif(trim(coalesce(p_address, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    whatsapp = nullif(trim(coalesce(p_whatsapp, '')), ''),
    pix_key = nullif(trim(coalesce(p_pix, '')), ''),
    logo_url = coalesce(nullif(trim(coalesce(p_logo_url, '')), ''), logo_url),
    default_observation = nullif(trim(coalesce(p_observation, '')), ''),
    updated_at = now()
  where tenant_id = p_tenant_id;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'update_company', p_tenant_id, jsonb_build_object('name', p_name));
end; $$;

create or replace function public.admin_set_plan(
  p_tenant_id uuid, p_plan text, p_amount numeric, p_started_on date, p_due_on date
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_plan not in ('trial','premium','full_access') then raise exception 'invalid plan %', p_plan; end if;
  update public.tenants set
    plan = p_plan,
    plan_amount = coalesce(p_amount, 0),
    plan_started_on = p_started_on,
    plan_due_on = p_due_on
  where id = p_tenant_id;
  if not found then raise exception 'tenant not found'; end if;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'set_plan', p_tenant_id,
          jsonb_build_object('plan', p_plan, 'amount', p_amount, 'due_on', p_due_on));
end; $$;

-- "Entrar como cliente": registra auditoria e devolve o detalhe (visão de suporte).
create or replace function public.admin_enter_tenant(p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'enter_as_client', p_tenant_id, '{}'::jsonb);
  v := public.admin_get_tenant(p_tenant_id);
  return v;
end; $$;

create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'companies_total', count(*),
    'active', count(*) filter (where status = 'active'),
    'trial', count(*) filter (where status = 'trial'),
    'pending', count(*) filter (where status = 'pending'),
    'expired', count(*) filter (where status = 'expired'),
    'blocked', count(*) filter (where status = 'blocked'),
    'rejected', count(*) filter (where status = 'rejected'),
    'cancellations', count(*) filter (where status in ('blocked','rejected','expired')),
    'mrr', coalesce(sum(plan_amount) filter (where plan = 'premium' and status in ('active','trial')), 0),
    'annual', coalesce(sum(plan_amount) filter (where plan = 'premium' and status in ('active','trial')), 0) * 12
  ) into v from public.tenants;
  return v;
end; $$;

create or replace function public.admin_list_invoices()
returns table (
  id uuid, tenant_id uuid, tenant_name text, plan text, amount numeric,
  due_date date, status text, effective_status text, paid_on date, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select i.id, i.tenant_id, t.name, i.plan, i.amount, i.due_date, i.status,
         case when i.status = 'pendente' and i.due_date < current_date then 'vencido' else i.status end,
         i.paid_on, i.created_at
  from public.platform_invoices i
  join public.tenants t on t.id = i.tenant_id
  order by i.due_date desc, i.created_at desc;
end; $$;

create or replace function public.admin_create_invoice(
  p_tenant_id uuid, p_plan text, p_amount numeric, p_due_date date
) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.platform_invoices(tenant_id, plan, amount, due_date)
  values (p_tenant_id, p_plan, coalesce(p_amount, 0), p_due_date)
  returning id into v_id;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'create_invoice', p_tenant_id, jsonb_build_object('amount', p_amount, 'due_date', p_due_date));
  return v_id;
end; $$;

create or replace function public.admin_set_invoice_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('pago','pendente','vencido') then raise exception 'invalid status %', p_status; end if;
  update public.platform_invoices set
    status = p_status,
    paid_on = case when p_status = 'pago' then current_date else null end,
    updated_at = now()
  where id = p_id
  returning tenant_id into v_tenant;
  if not found then raise exception 'invoice not found'; end if;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'set_invoice_status', v_tenant, jsonb_build_object('status', p_status));
end; $$;

create or replace function public.admin_list_audit(p_limit int default 200)
returns table (
  id uuid, admin_email text, action text, tenant_id uuid, tenant_name text,
  metadata jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select a.id, au.email::text, a.action, a.tenant_id, t.name, a.metadata, a.created_at
  from public.admin_audit a
  left join auth.users au on au.id = a.admin_user_id
  left join public.tenants t on t.id = a.tenant_id
  order by a.created_at desc
  limit greatest(1, least(p_limit, 1000));
end; $$;
