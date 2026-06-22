-- Hardening dos objetos da Etapa 20 (não toca em funções/fluxos pré-existentes).

-- 1) search_path fixo em plan_label (limpa o lint function_search_path_mutable).
create or replace function public.plan_label(p text)
returns text language sql immutable set search_path to '' as $$
  select case p
    when 'trial' then 'Trial'
    when 'premium' then 'Mensal'
    when 'full_access' then 'Vitalício'
    else coalesce(p, '—') end;
$$;

-- 2) As RPCs administrativas nunca devem ser chamadas por usuários anônimos.
--    O guard is_platform_admin() já barra, mas removemos o EXECUTE do anon por segurança.
revoke execute on function public.admin_list_tenants() from anon;
revoke execute on function public.admin_get_tenant(uuid) from anon;
revoke execute on function public.admin_set_status(uuid, text, text) from anon;
revoke execute on function public.admin_update_company(uuid, text, text, text, text, text, text, text, text) from anon;
revoke execute on function public.admin_set_plan(uuid, text, numeric, date, date) from anon;
revoke execute on function public.admin_enter_tenant(uuid) from anon;
revoke execute on function public.admin_metrics() from anon;
revoke execute on function public.admin_list_invoices() from anon;
revoke execute on function public.admin_create_invoice(uuid, text, numeric, date) from anon;
revoke execute on function public.admin_set_invoice_status(uuid, text) from anon;
revoke execute on function public.admin_list_audit(integer) from anon;
