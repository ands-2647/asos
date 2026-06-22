-- Fase 4 (aviso visual no app cliente) + Fase 5 (dashboard) + Fase 6 (edição no suporte).

-- 1) Status de cobrança do próprio tenant (banner de aviso no app cliente).
create or replace function public.my_billing_status()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'status', t.status,
    'plan', t.plan,
    'plan_due_on', t.plan_due_on,
    'days_left', case when t.plan_due_on is not null then (t.plan_due_on - current_date) else null end
  )
  from public.tenants t where t.id = public.tenant_id();
$$;

-- 2) Métricas admin: + inadimplência e vencimentos próximos (Fase 5).
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
    'overdue', count(*) filter (where status in ('expired','blocked')),
    'due_soon', count(*) filter (where status in ('active','trial') and plan_due_on is not null and plan_due_on between current_date and current_date + 7),
    'mrr', coalesce(sum(plan_amount) filter (where plan = 'premium' and status in ('active','trial')), 0),
    'annual', coalesce(sum(plan_amount) filter (where plan = 'premium' and status in ('active','trial')), 0) * 12
  ) into v from public.tenants;
  v := v || jsonb_build_object(
    'invoices_overdue', (select count(*) from public.platform_invoices where status='pendente' and due_date < current_date),
    'invoices_open_amount', (select coalesce(sum(amount),0) from public.platform_invoices where status='pendente')
  );
  return v;
end; $$;

-- 3) Edição de configurações no modo suporte (Fase 6). Auditado.
create or replace function public.admin_update_settings(p_tenant_id uuid, p_validity_days int)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tenant_settings
    set default_validity_days = p_validity_days, updated_at = now()
  where tenant_id = p_tenant_id;
  if not found then raise exception 'tenant settings not found'; end if;
  insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
  values (auth.uid(), 'update_settings', p_tenant_id, jsonb_build_object('default_validity_days', p_validity_days));
end; $$;

revoke execute on function public.admin_update_settings(uuid, int) from anon;
