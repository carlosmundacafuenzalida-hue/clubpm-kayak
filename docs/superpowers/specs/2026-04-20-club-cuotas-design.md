# Club Cuotas — Diseño de la Aplicación

**Fecha:** 2026-04-20  
**Stack:** Next.js + Supabase + Vercel  
**Scope:** Club de 27 socios, datos desde agosto 2024

---

## Resumen

Web app de control de pago de cuotas para club pequeño. El tesorero administra socios, pagos, gastos e ingresos. Los socios consultan su estado ingresando su RUT.

---

## Arquitectura

```
Supabase (PostgreSQL + Storage)
        ↕ API (supabase-js)
Next.js App (Vercel)
    ├── /login          → Socio ingresa su RUT
    ├── /socio          → Vista del socio (solo lectura)
    └── /admin          → Panel del tesorero (protegido)
```

**Despliegue:**
- Supabase: plan gratuito (500MB DB, 1GB storage)
- Vercel: deploy desde GitHub, URL pública tipo `cuotas-club.vercel.app`
- Variables de entorno: `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Vercel

---

## Modelo de datos

### `socios`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| rut | text | RUT normalizado (sin puntos, con guión) |
| nombre | text | Nombre completo |
| telefono | text | Número WhatsApp (569XXXXXXXX) |
| fecha_ingreso | date | Fecha de ingreso al club |
| activo | boolean | Para dar de baja sin borrar historial |
| es_admin | boolean | true solo para el tesorero |
| pin_hash | text | Hash del PIN numérico (solo si es_admin = true) |

### `cuotas_config`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| mes | date | Primer día del mes (ej: 2024-08-01) |
| monto | numeric | Monto esperado ese mes |

### `movimientos`
Tabla unificada para pagos, ingresos extra y gastos.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| tipo | enum | `pago_cuota` / `ingreso_extra` / `gasto` |
| fecha_registro | date | Fecha del movimiento (libre, no forzada a hoy) |
| socio_id | uuid FK | Solo para `pago_cuota` |
| mes_cuota | date | Solo para `pago_cuota` (mes que cubre) |
| monto | numeric | Monto del movimiento |
| glosa | text | Descripción libre del movimiento |
| comprobante_url | text | URL firmada en Supabase Storage (opcional) |
| creado_en | timestamptz | Timestamp de inserción (auditoría) |
| creado_por | text | RUT del tesorero que registró |

---

## Autenticación y roles

### Socios
- Ingresan solo con RUT (normalizado automáticamente al escribir)
- El sistema busca el RUT en tabla `socios` — si no existe: "RUT no registrado, contacta al tesorero"
- Sesión de solo lectura, no pueden modificar nada

### Tesorero
- Ingresa con RUT + PIN numérico (almacenado como hash en tabla `socios` con flag `es_admin`)
- Acceso completo al panel `/admin`

---

## Vistas

### `/login`
- Campo RUT con normalización automática (acepta con/sin puntos y guión)
- Botón "Entrar"
- Detección automática de rol: si es admin → redirige a `/admin`, si es socio → `/socio`

### `/socio`
- Semáforo de estado: ✅ Al día / ⚠️ Deuda parcial / 🔴 Moroso
- Total adeudado destacado
- Tabla mes a mes (agosto 2024 → mes actual):
  - Mes | Monto esperado | Pagado | Estado | Glosa | Comprobante
- Botón para ver comprobante de cada pago (abre URL firmada)

### `/admin` — Dashboard
- Resumen del mes: recaudado vs esperado, % de socios al día
- Total morosos con monto acumulado
- Últimos movimientos registrados

### `/admin/socios`
- Lista de socios con estado (al día / moroso)
- Agregar / editar socio (nombre, RUT, teléfono, fecha ingreso)
- Ver historial completo de un socio
- Botón WhatsApp: genera link `https://wa.me/569XXXXXXXX?text=...` con mensaje predefinido incluyendo meses adeudados y monto total

### `/admin/movimientos`
- Lista de todos los movimientos (filtrable por tipo, mes, socio)
- Formulario "Nuevo movimiento":
  - Tipo: Pago de cuota / Ingreso extra / Gasto
  - Fecha de registro (selector libre)
  - Socio (dropdown — solo para pagos)
  - Mes que cubre (selector mes/año — solo para pagos)
  - Monto
  - Glosa (texto libre, obligatorio)
  - Comprobante (archivo opcional, máx 5MB)
- Editar / anular movimiento (registro de auditoría: quién y cuándo)

### `/admin/reportes`
- Exportar a Excel: pagos por mes, morosos actuales, balance (ingresos - gastos)
- Filtros: rango de fechas, tipo de movimiento

### `/admin/configuracion`
- Definir monto de cuota por mes (permite montos distintos por mes)

---

## Módulo de registro manual de movimientos

Formulario único accesible desde el panel admin para registrar cualquier tipo de movimiento 1 a 1:

- **Pago de cuota:** vinculado a socio + mes específico, con glosa y comprobante opcional
- **Ingreso extra:** sin socio asociado, con fecha, monto y glosa obligatoria
- **Gasto:** sin socio asociado, con fecha, monto y glosa obligatoria

Todos los movimientos quedan en historial con fecha de registro visible, editable por el tesorero con log de auditoría.

---

## Flujos clave

### Login por RUT
1. Socio escribe RUT → se normaliza (elimina puntos, verifica guión y dígito verificador)
2. Consulta en `socios` → si no existe: error amigable
3. Si existe y `es_admin = true` → `/admin`, si no → `/socio`

### Registro de pago
1. Tesorero abre "Nuevo movimiento" → selecciona tipo "Pago de cuota"
2. Selecciona socio → sistema muestra automáticamente meses con deuda pendiente
3. Ingresa fecha, monto, glosa y comprobante (opcional)
4. Al guardar: estado del socio se recalcula en tiempo real

### Cálculo de estado del socio
- Por cada mes desde agosto 2024: suma pagos registrados para ese socio/mes
- Si suma ≥ monto configurado → pagado; si suma < monto → deuda parcial; si suma = 0 → impago
- Estado general: al día solo si todos los meses están pagados

### WhatsApp
- Botón en ficha del socio genera: `https://wa.me/569XXXXXXXX?text=Hola+[nombre],+tienes+[N]+meses+pendientes+por+$[monto_total].+Meses:+[lista].`
- Abre WhatsApp Web o móvil directamente, sin API externa ni costo

---

## Migración inicial de datos

- Script Python (`scripts/import_planilla.py`) que lee el Excel existente del tesorero
- Carga: socios, historial de pagos desde agosto 2024, gastos e ingresos registrados
- Se ejecuta una sola vez antes del lanzamiento
- El script valida duplicados y reporta inconsistencias antes de insertar

---

## Manejo de errores

| Caso | Comportamiento |
|---|---|
| RUT no registrado | Mensaje: "RUT no registrado, contacta al tesorero" |
| RUT duplicado al crear socio | Error inline en formulario |
| Pago duplicado (mismo socio + mes) | Advertencia visible, no bloqueo |
| Comprobante > 5MB | Error inline con límite informado |
| Sin conexión | Next.js muestra estado de error con retry |

---

## Fases de entrega

### Fase 1 — Core
- Modelo de datos en Supabase
- Login por RUT (socio y tesorero)
- Vista del socio (estado + tabla mes a mes)
- Registro manual de movimientos (pagos, ingresos, gastos)

### Fase 2 — Admin completo
- Dashboard con resumen
- Gestión de socios
- Reportes exportables a Excel
- Configuración de monto por mes

### Fase 3 — Integración y lanzamiento
- WhatsApp por link
- Script de importación desde planilla Excel
- Deploy en Vercel + dominio personalizado (opcional)
