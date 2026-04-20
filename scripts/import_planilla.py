"""
Script de importación única desde planilla Excel a Supabase.

Estructura esperada del Excel (archivo: scripts/planilla.xlsx):
  - Hoja "Socios":   columnas RUT | Nombre | Telefono | FechaIngreso
  - Hoja "Pagos":    columnas RUT | Mes (YYYY-MM) | Monto | Glosa | Fecha
  - Hoja "Gastos":   columnas Fecha | Monto | Glosa
  - Hoja "Ingresos": columnas Fecha | Monto | Glosa

Uso:
  1. Copia tu planilla como scripts/planilla.xlsx
  2. cd scripts && pip install -r requirements.txt
  3. python import_planilla.py

El script valida duplicados antes de insertar y reporta cada fila procesada.
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import openpyxl

# Carga variables desde .env.local del proyecto
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
ADMIN_RUT    = os.environ.get('NEXT_PUBLIC_ADMIN_RUT', 'admin')
ARCHIVO      = os.path.join(os.path.dirname(__file__), 'planilla.xlsx')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def normalizar_rut(rut) -> str:
    """Normaliza RUT a formato 'XXXXXXXX-X' (sin puntos, con guión, minúscula)."""
    clean = str(rut).strip().replace('.', '').replace('-', '').lower()
    if len(clean) < 2:
        return clean
    return f"{clean[:-1]}-{clean[-1]}"


def parse_fecha(valor, fallback: str = None) -> str:
    """Convierte distintos formatos de fecha a string YYYY-MM-DD."""
    if valor is None:
        return fallback or datetime.today().strftime('%Y-%m-%d')
    if isinstance(valor, datetime):
        return valor.strftime('%Y-%m-%d')
    s = str(valor).strip()[:10]
    # Intenta YYYY-MM-DD
    try:
        datetime.strptime(s, '%Y-%m-%d')
        return s
    except ValueError:
        pass
    # Intenta DD-MM-YYYY o DD/MM/YYYY
    for fmt in ('%d-%m-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return fallback or datetime.today().strftime('%Y-%m-%d')


def importar_socios(ws):
    print("\n=== Importando socios ===")
    ok = skip = error = 0
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0]:
            continue
        rut, nombre, telefono, fecha_ingreso = (row + (None,) * 4)[:4]
        rut_norm = normalizar_rut(rut)
        nombre = str(nombre).strip() if nombre else ''
        if not nombre:
            print(f"  SKIP fila {i}: nombre vacío")
            skip += 1
            continue

        # Verificar duplicado
        existing = supabase.table('socios').select('id').eq('rut', rut_norm).execute()
        if existing.data:
            print(f"  SKIP {rut_norm} - {nombre} (ya existe)")
            skip += 1
            continue

        fecha = parse_fecha(fecha_ingreso, '2024-08-01')
        tel = str(telefono).strip() if telefono else None

        try:
            supabase.table('socios').insert({
                'rut': rut_norm,
                'nombre': nombre,
                'telefono': tel,
                'fecha_ingreso': fecha,
                'activo': True,
                'es_admin': False,
            }).execute()
            print(f"  OK  {rut_norm} - {nombre}")
            ok += 1
        except Exception as e:
            print(f"  ERR {rut_norm} - {nombre}: {e}")
            error += 1

    print(f"  Socios: {ok} insertados, {skip} saltados, {error} errores")


def importar_pagos(ws):
    print("\n=== Importando pagos ===")
    # Cargar mapa RUT → id
    socios_data = supabase.table('socios').select('id, rut').execute().data
    socios_map = {s['rut']: s['id'] for s in socios_data}

    ok = skip = error = 0
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0] or not row[2]:
            continue
        rut, mes, monto, glosa, fecha = (row + (None,) * 5)[:5]
        rut_norm = normalizar_rut(rut)
        socio_id = socios_map.get(rut_norm)
        if not socio_id:
            print(f"  WARN fila {i}: socio {rut_norm} no encontrado, saltando")
            skip += 1
            continue

        # Mes: acepta 'YYYY-MM', 'YYYY-MM-DD', o datetime
        mes_str = None
        if mes:
            if isinstance(mes, datetime):
                mes_str = mes.strftime('%Y-%m') + '-01'
            else:
                s = str(mes).strip()[:7]
                mes_str = s + '-01' if len(s) == 7 else None

        fecha_str = parse_fecha(fecha, mes_str or datetime.today().strftime('%Y-%m-%d'))
        glosa_str = str(glosa).strip() if glosa else 'Pago cuota'

        try:
            supabase.table('movimientos').insert({
                'tipo': 'pago_cuota',
                'fecha_registro': fecha_str,
                'socio_id': socio_id,
                'mes_cuota': mes_str,
                'monto': float(monto),
                'glosa': glosa_str,
                'creado_por': ADMIN_RUT,
            }).execute()
            print(f"  OK  {rut_norm} | mes {mes_str} | ${monto} | {glosa_str}")
            ok += 1
        except Exception as e:
            print(f"  ERR fila {i}: {e}")
            error += 1

    print(f"  Pagos: {ok} insertados, {skip} saltados, {error} errores")


def importar_movimientos(ws, tipo: str):
    label = {'gasto': 'gastos', 'ingreso_extra': 'ingresos extra'}[tipo]
    print(f"\n=== Importando {label} ===")
    ok = skip = error = 0
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[1]:  # monto vacío
            continue
        fecha, monto, glosa = (row + (None,) * 3)[:3]
        fecha_str = parse_fecha(fecha)
        glosa_str = str(glosa).strip() if glosa else tipo

        try:
            supabase.table('movimientos').insert({
                'tipo': tipo,
                'fecha_registro': fecha_str,
                'monto': float(monto),
                'glosa': glosa_str,
                'creado_por': ADMIN_RUT,
            }).execute()
            print(f"  OK  {fecha_str} | ${monto} | {glosa_str}")
            ok += 1
        except Exception as e:
            print(f"  ERR fila {i}: {e}")
            error += 1

    print(f"  {label.capitalize()}: {ok} insertados, {skip} saltados, {error} errores")


if __name__ == '__main__':
    if not os.path.exists(ARCHIVO):
        print(f"ERROR: No se encontró el archivo {ARCHIVO}")
        print("Copia tu planilla Excel como 'scripts/planilla.xlsx' y vuelve a ejecutar.")
        sys.exit(1)

    print(f"Cargando: {ARCHIVO}")
    wb = openpyxl.load_workbook(ARCHIVO, data_only=True)
    print(f"Hojas encontradas: {wb.sheetnames}")

    if 'Socios' in wb.sheetnames:
        importar_socios(wb['Socios'])
    else:
        print("\nATENCION: No se encontró hoja 'Socios'")

    if 'Pagos' in wb.sheetnames:
        importar_pagos(wb['Pagos'])
    else:
        print("\nATENCION: No se encontró hoja 'Pagos'")

    if 'Gastos' in wb.sheetnames:
        importar_movimientos(wb['Gastos'], 'gasto')
    else:
        print("\nATENCION: No se encontró hoja 'Gastos'")

    if 'Ingresos' in wb.sheetnames:
        importar_movimientos(wb['Ingresos'], 'ingreso_extra')
    else:
        print("\nATENCION: No se encontró hoja 'Ingresos'")

    print("\n✓ Importación completada.")
