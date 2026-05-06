-- db/2026-05-06_ajustes_cuota.sql
-- Override del monto adeudado por par (socio_id, mes) con glosa obligatoria.
-- Ejecutar en SQL Editor de Supabase manualmente.

create table if not exists public.ajustes_cuota (
  id          uuid primary key default gen_random_uuid(),
  socio_id    uuid not null references public.socios(id) on delete cascade,
  mes         date not null,
  monto       numeric(10,2) not null check (monto >= 0),
  glosa       text not null check (length(trim(glosa)) > 0),
  creado_en   timestamptz not null default now(),
  creado_por  text not null,
  unique (socio_id, mes)
);

create index if not exists ajustes_cuota_socio_idx
  on public.ajustes_cuota(socio_id);

alter table public.ajustes_cuota enable row level security;

-- Policies abiertas en línea con `movimientos`/`cuotas_config`/`socios`:
-- el control de acceso real lo hace el middleware + getSession() en /api/*.
-- Sin estas policies, las queries via anon key fallan (RLS bloquea por defecto).
create policy public_read_ajustes   on public.ajustes_cuota for select using (true);
create policy public_insert_ajustes on public.ajustes_cuota for insert with check (true);
create policy public_update_ajustes on public.ajustes_cuota for update using (true);
create policy public_delete_ajustes on public.ajustes_cuota for delete using (true);
