-- Etapa 21 / Fase 4 — Ciclo de cobrança automática (sem cron externo pago).
-- Roda diariamente via pg_cron (031). Tudo auditável e reversível pelo admin:
-- nada é apagado; reativar o plano (admin_set_plan/admin_set_status) volta o status para active.

create index if not exists admin_audit_tenant_idx on public.admin_audit(tenant_id);

-- Tolerância (dias) após o vencimento antes do bloqueio automático.
create or replace function public.billing_grace_days()
returns int language sql immutable set search_path to '' as $$ select 3 $$;

-- Cria notificação de conta sem duplicar (mesmo título nos últimos 2 dias).
create or replace function public._billing_notify(p_tenant uuid, p_title text, p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.notifications (tenant_id, type, title, action_label)
  select p_tenant, 'account', p_title, p_action
  where not exists (
    select 1 from public.notifications n
    where n.tenant_id = p_tenant and n.title = p_title and n.created_at > now() - interval '2 days'
  );
end; $$;

-- Motor do ciclo. Retorna um resumo (auditoria/teste).
create or replace function public.run_billing_cycle()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  v_grace int := public.billing_grace_days();
  v_warn7 int := 0; v_warn3 int := 0; v_expired int := 0; v_blocked int := 0;
  dd int;
begin
  for r in
    select id, status, plan_due_on
    from public.tenants
    where plan_due_on is not null and status in ('active','trial','expired')
  loop
    dd := r.plan_due_on - current_date;

    if r.status in ('active','trial') then
      if dd = 7 then
        perform public._billing_notify(r.id, 'Seu plano vence em 7 dias', 'Renovar');
        v_warn7 := v_warn7 + 1;
      elsif dd = 3 then
        perform public._billing_notify(r.id, 'Seu plano vence em 3 dias', 'Renovar');
        v_warn3 := v_warn3 + 1;
      end if;

      if dd <= 0 then
        update public.tenants set status = 'expired' where id = r.id;
        perform public._billing_notify(r.id, 'Seu plano venceu', 'Regularizar');
        insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
        values (null, 'auto_expire', r.id, jsonb_build_object('plan_due_on', r.plan_due_on));
        v_expired := v_expired + 1;
      end if;

    elsif r.status = 'expired' then
      if current_date > r.plan_due_on + v_grace then
        update public.tenants set status = 'blocked' where id = r.id;
        insert into public.admin_audit(admin_user_id, action, tenant_id, metadata)
        values (null, 'auto_block', r.id, jsonb_build_object('plan_due_on', r.plan_due_on, 'grace_days', v_grace));
        v_blocked := v_blocked + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ran_at', now(), 'warned_7d', v_warn7, 'warned_3d', v_warn3,
    'expired', v_expired, 'blocked', v_blocked, 'grace_days', v_grace
  );
end; $$;

-- Disparo manual pelo admin (testar/forçar). Guardado por is_platform_admin().
create or replace function public.admin_run_billing_cycle()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.run_billing_cycle();
end; $$;

revoke execute on function public.run_billing_cycle() from anon, authenticated;
revoke execute on function public._billing_notify(uuid, text, text) from anon, authenticated;
revoke execute on function public.admin_run_billing_cycle() from anon;
