# Ajustes de cuota por socio + edición de `fecha_ingreso`

**Fecha:** 2026-05-06
**Estado:** Aprobado, pendiente de plan de implementación.
**Autor:** Carlos Mundaca (con Claude)

## 1. Objetivo

Permitir al tesorero **modificar el monto adeudado de un socio en un mes específico** con una glosa explicativa, y editar la **`fecha_ingreso`** de un socio desde la UI. Resuelve dos problemas reales del cálculo de morosidad observados en producción:

- **Patricio Lagos** — fundador del club que se cambió de ciudad y por acuerdo del directorio no debe los meses históricos. Hoy aparece como moroso de 21 meses ($147.000).
- **Juan Landaeta** — su `fecha_ingreso` está mal cargada; se integró al club con posterioridad y los meses anteriores no aplican. Hoy aparece como moroso de 12 meses ($84.000) que en realidad son N/A.

Otros casos contemplados que la feature debe soportar:
- **Lesión médica** que justifica no cobrar un período.
- **Becas parciales o totales** (ej. monto reducido al 50% durante un período).
- **Recargos puntuales** (ej. mes con monto mayor por algún acuerdo).

## 2. Casos fuera de alcance

- **Editar la cuota global del mes** (`cuotas_config.monto`) — eso es otro ítem del backlog y aplica a todos los socios.
- **Histórico de cambios** de un ajuste (audit log de quién cambió qué cuándo). YAGNI por ahora; basta `creado_en`/`creado_por` del registro vigente.
- **Aprobaciones / workflow multi-rol** — el tesorero crea/edita/elimina ajustes con la misma autoridad que registra movimientos.
- **Notificación automática al socio** cuando se crea un ajuste — es comunicación humana, no del sistema.

## 3. Decisiones de diseño tomadas

| Decisión                                       | Elegido                                                            | Por qué                                                          |
|------------------------------------------------|--------------------------------------------------------------------|------------------------------------------------------------------|
| Granularidad del ajuste                        | **Mes individual** + botón bulk para aplicar a un rango            | Edición fina por mes; bulk evita el costo del modelo "rango".    |
| Rango de montos permitidos                     | Cualquier valor `>= 0` (incluye $0 y montos sobre la cuota global) | Cubre exenciones, becas parciales y recargos sin features extra. |
| Glosa                                          | **Obligatoria**                                                    | Trazabilidad: nunca queda un ajuste sin razón documentada.       |
| Visibilidad de la glosa en `/mi/[rut]`         | **No se muestra al socio**, solo el badge "ajustado"               | Algunas glosas pueden ser sensibles (situación económica, etc.). |
| Eliminación de ajustes                         | **Siempre permitida** al admin                                     | El admin ya tiene control total; YAGNI políticas de cierre.      |
| Edición de `fecha_ingreso`                     | Desde `/socios/[id]` con confirmación (cambio sensible)            | Resuelve Juan sin tabla nueva.                                   |

## 4. Schema de base de datos

### 4.1 Nueva tabla `ajustes_cuota`

```sql
create table public.ajustes_cuota (
  id          uuid primary key default gen_random_uuid(),
  socio_id    uuid not null references public.socios(id) on delete cascade,
  mes         date not null,                            -- 'YYYY-MM-01'
  monto       numeric(10,0) not null check (monto >= 0),
  glosa       text not null check (length(trim(glosa)) > 0),
  creado_en   timestamptz not null default now(),
  creado_por  text not null,                            -- RUT del admin que crea/edita
  unique (socio_id, mes)
);

create index ajustes_cuota_socio_idx on public.ajustes_cuota(socio_id);
```

**Notas:**
- La `unique (socio_id, mes)` garantiza un único ajuste vigente por par socio-mes. Edición = upsert sobre la misma fila.
- `on delete cascade` desde `socios`: si se elimina un socio (operación rara), se limpian sus ajustes.
- `creado_por` = RUT del admin (no FK a `socios.id` para mantener consistencia con el patrón de `movimientos.creado_por`).

### 4.2 RLS y policies

Misma política que `movimientos`: la tabla queda con RLS habilitado y se accede vía la cookie de sesión que valida el middleware. No hay acceso directo desde el cliente; todo pasa por endpoints `/api/*`. Si se prefiere defensa en profundidad explícita, agregar policies que solo permitan operar a usuarios de Supabase con rol `service`; se decide en el plan de implementación.

### 4.3 Sin cambios en otras tablas

`socios.fecha_ingreso` ya existe — se reutiliza con un nuevo endpoint PATCH.

## 5. Lógica de cálculo (`lib/movimientos.ts`)

### 5.1 Cambio de firma

```ts
export function calcularEstado(
  socio: Socio,
  movimientos: Movimiento[],
  cuotasConfig: CuotaConfig[],
  ajustes: AjusteCuota[],          // NUEVO parámetro
  mesReferencia: string = mesActual()
): { estado: EstadoSocio; mesesAdeudados: string[]; montoAdeudado: number }
```

`calcularDashboard` recibe también el array `ajustes` y lo propaga a cada llamada interna.

### 5.2 Comportamiento por mes esperado

Para cada mes en `mesesEsperados` (ya construido desde `socio.fecha_ingreso` hasta `mesReferencia`):

1. Buscar `ajuste = ajustes.find(a => a.socio_id === socio.id && a.mes === mes)`.
2. Determinar el **monto que el socio debe ese mes**:
   - Si `ajuste && ajuste.monto === 0` → el mes **se omite** del cálculo (no es deuda ni cuenta como esperado).
   - Si `ajuste && ajuste.monto > 0` → monto del mes = `ajuste.monto`.
   - Sin ajuste → monto del mes = `cuotasConfig[mes].monto` (igual que hoy).
3. Si el mes no fue omitido y no está en `mesesPagados`, agregarlo a `mesesAdeudados` con el monto correspondiente.

`montoAdeudado` total = suma de los montos por mes adeudado.

### 5.3 Tipo nuevo

```ts
export type AjusteCuota = {
  id: string;
  socio_id: string;
  mes: string;          // 'YYYY-MM-01'
  monto: number;
  glosa: string;
  creado_en: string;
  creado_por: string;
};
```

Va en `lib/supabase.ts` junto a los otros tipos.

## 6. API endpoints

### 6.1 `GET /api/ajustes?socio_id=<uuid>`
- Auth: sesión admin.
- Devuelve `AjusteCuota[]` ordenados por `mes` desc.

### 6.2 `POST /api/ajustes`
- Auth: sesión admin.
- Body: `{ socio_id, mes, monto, glosa }`.
  - `mes` formato `'YYYY-MM-01'`.
  - `monto >= 0`.
  - `glosa` no vacía.
- Comportamiento: **upsert** sobre `(socio_id, mes)`. Si ya existe ajuste para ese par, los campos `monto`, `glosa`, `creado_en` y `creado_por` se **sobrescriben** con los valores nuevos (no se mantiene historial de versiones — ver §2 fuera de alcance). Devuelve la fila resultante.

### 6.3 `POST /api/ajustes/bulk`
- Auth: sesión admin.
- Body: `{ socio_id, mes_desde, mes_hasta, monto, glosa }`.
- Crea N filas (una por mes en el rango inclusivo `[mes_desde, mes_hasta]`), todas con el mismo monto y glosa. Upsert si ya existe alguna.
- `mes_hasta` puede ser un mes futuro arbitrario para casos de exención prolongada (ej: hasta `2030-12-01` cubre el escenario "Patricio sigue afuera por años"). No hay máximo definido por el sistema.
- Resuelve el caso Patricio en una sola llamada: `mes_desde=2024-08-01`, `mes_hasta=2026-04-01` (o más adelante si se quiere cubrir el futuro), `monto=0`, `glosa="se cambió de ciudad post-fundación"`.

### 6.4 `DELETE /api/ajustes?id=<uuid>`
- Auth: sesión admin.
- Elimina el ajuste; el cálculo vuelve al monto global automáticamente.

### 6.5 `PATCH /api/socios/[id]`
- Auth: sesión admin.
- Body parcial: campos editables del socio. Para esta feature: `fecha_ingreso`.
- Validación: `fecha_ingreso` debe ser fecha válida y `<= today`.
- Si ya existe el endpoint, agregar `fecha_ingreso` al schema validado; si no, crearlo siguiendo el patrón de `/api/movimientos`.

### 6.6 Endpoints existentes que consumen ajustes

`GET /api/socios`, dashboard server component y `/api/cron/resumen-morosos` deben hacer un fetch adicional a `ajustes_cuota` y pasarlo a `calcularEstado` / `calcularDashboard`.

## 7. UI

### 7.1 `/socios/[id]` — detalle del socio

**Sección de datos del socio:**
- Junto a `fecha_ingreso`, botón "Editar" → input date → "Guardar". Modal de confirmación: "Cambiar la fecha de ingreso afecta el cálculo de morosidad histórico. ¿Continuar?".

**Tabla de historial mes-a-mes:**
- Cada fila tiene columna nueva "Ajuste". Si hay ajuste: badge 🔧 + tooltip con la glosa.
- Click en un mes (o en la columna ajuste) abre el modal **"Ajustar cuota de \<mes\> para \<nombre\>"**:
  - Input monto (default = cuota global del mes; placeholder = "0 para anular deuda").
  - Textarea glosa (obligatoria, min 5 chars).
  - Botones: **Guardar**, **Eliminar ajuste** (visible solo si ya existe), **Cancelar**.

**Botón "Aplicar a varios meses":**
- En la pantalla del socio, fuera de la tabla, botón "Crear ajuste para varios meses".
- Modal con: rango (mes desde / mes hasta), monto, glosa. Llama `POST /api/ajustes/bulk`.
- Resuelve el caso Patricio en pocos clicks.

### 7.2 `/mi/[rut]` — vista pública del socio

Los meses con ajuste se muestran con badge "ajustado" (sin la glosa). Si el ajuste tiene `monto === 0`, el mes ni aparece en la columna de pendientes; aparece como neutral en el calendario.

### 7.3 Dashboard `/dashboard`

Sin cambios en la UI. Los KPIs (morosos, total adeudado, etc.) cambian de forma natural porque `calcularDashboard` usa la lógica nueva.

## 8. Reportes y mensajes

- **Cron `/api/cron/resumen-morosos`** — sin cambios en `route.ts`. Como usa `calcularDashboard`, hereda automáticamente la nueva lógica. Solo hay que asegurar que carga `ajustes_cuota` antes de llamar a la función.
- **Excel de socios morosos** (`lib/excel.ts`) — idem, sin cambios estructurales si la lógica central queda fixed.
- **Excel de detalle por socio** — agregar columna "Ajuste" / "Glosa" para los meses con ajuste.

## 9. Tests

Nuevos casos en `lib/__tests__/movimientos.test.ts`:

1. **Ajuste $0 omite el mes** — socio activo, fecha_ingreso 2024-07-01, sin pagos, ajuste $0 en 2024-08-01, mes ref 2024-09-01. Espera: `mesesAdeudados = ['2024-07-01']`, no contiene 2024-08-01.
2. **Ajuste con monto positivo cambia el monto adeudado** — cuota global $7.000, ajuste $3.500 en jul-2024 (beca media). Mes aparece en `mesesAdeudados`, `montoAdeudado` incluye $3.500 (no $7.000).
3. **Ajuste + pago_cuota del mismo mes** — ajuste $3.500, pago_cuota del mes registrado. Mes saldado, no aparece en `mesesAdeudados`.
4. **Eliminar ajuste vuelve al monto global** — conceptualmente: dos cálculos consecutivos, el segundo sin la fila de ajuste, debe coincidir con el cálculo "vanilla".
5. **Caso Patricio** — fecha_ingreso 2024-08-01, sin pagos, 21 ajustes con monto $0 (uno por mes desde 2024-08 a 2026-04), mes ref 2026-05-01. Espera: `mesesAdeudados.length === 0`, `montoAdeudado === 0`, estado `pendiente` (mes en curso aún sin pagar).

## 10. Definición de "listo"

- Schema migrado en Supabase.
- Tipos en `lib/supabase.ts`.
- `calcularEstado` y `calcularDashboard` aceptan `ajustes` y honran la lógica.
- Endpoints `/api/ajustes` (GET/POST/DELETE), `/api/ajustes/bulk` (POST), `/api/socios/[id]` (PATCH con `fecha_ingreso`) implementados con auth.
- UI en `/socios/[id]` permite editar `fecha_ingreso` y crear/editar/eliminar ajustes individuales y por rango.
- `/mi/[rut]` refleja los meses ajustados sin exponer la glosa.
- Tests del punto 9 verdes.
- `npx tsc --noEmit && npm run build && npm test` verdes.
- Caso Patricio resuelto manualmente desde la UI: 1 bulk de ago-2024 a abr-2026 con monto 0 y glosa, queda con 0 morosos.
- Caso Juan resuelto editando su `fecha_ingreso` a su fecha real de integración.
- `PROGRESO.md` actualizado con un nuevo sprint cerrado.
