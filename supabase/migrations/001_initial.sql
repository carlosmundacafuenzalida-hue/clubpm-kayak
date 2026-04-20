-- supabase/migrations/001_initial.sql

create extension if not exists "pgcrypto";

-- Socios
create table socios (
  id          uuid primary key default gen_random_uuid(),
  rut         text unique not null,
  nombre      text not null,
  telefono    text,
  fecha_ingreso date not null,
  activo      boolean not null default true,
  es_admin    boolean not null default false,
  pin_hash    text
);

-- Configuración de cuotas por mes
create table cuotas_config (
  id     uuid primary key default gen_random_uuid(),
  mes    date unique not null,
  monto  numeric(10,2) not null
);

-- Tipo de movimiento
create type tipo_movimiento as enum ('pago_cuota', 'ingreso_extra', 'gasto');

-- Movimientos (pagos, ingresos, gastos)
create table movimientos (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_movimiento not null,
  fecha_registro  date not null,
  socio_id        uuid references socios(id),
  mes_cuota       date,
  monto           numeric(10,2) not null,
  glosa           text not null,
  comprobante_url text,
  creado_en       timestamptz not null default now(),
  creado_por      text not null
);

-- RLS policies
alter table socios enable row level security;
alter table cuotas_config enable row level security;
alter table movimientos enable row level security;

create policy "public_read_socios" on socios for select using (true);
create policy "public_read_cuotas" on cuotas_config for select using (true);
create policy "public_read_movimientos" on movimientos for select using (true);
create policy "public_insert_movimientos" on movimientos for insert with check (true);
create policy "public_update_movimientos" on movimientos for update using (true);
create policy "public_insert_socios" on socios for insert with check (true);
create policy "public_update_socios" on socios for update using (true);
create policy "public_insert_cuotas" on cuotas_config for insert with check (true);
create policy "public_update_cuotas" on cuotas_config for update using (true);
