-- Agenda o ciclo de cobrança no próprio Postgres (pg_cron) — sem cron externo pago.
create extension if not exists pg_cron;

-- Remove agendamento anterior (idempotente) e cria o diário às 06:00 UTC (~03:00 BRT).
select cron.unschedule('as-os-billing-daily')
where exists (select 1 from cron.job where jobname = 'as-os-billing-daily');

select cron.schedule('as-os-billing-daily', '0 6 * * *', $$select public.run_billing_cycle();$$);
