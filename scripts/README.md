# Script de importación

Importa el historial desde tu planilla Excel a Supabase (ejecución única).

## Preparar la planilla

Guarda tu Excel como `scripts/planilla.xlsx` con estas hojas:

| Hoja | Columnas |
|------|----------|
| Socios | RUT \| Nombre \| Telefono \| FechaIngreso |
| Pagos | RUT \| Mes (YYYY-MM) \| Monto \| Glosa \| Fecha |
| Gastos | Fecha \| Monto \| Glosa |
| Ingresos | Fecha \| Monto \| Glosa |

- RUT: con o sin puntos, con o sin guión (se normaliza automáticamente)
- Mes: formato YYYY-MM (ej: 2024-08)
- Fecha: YYYY-MM-DD, DD-MM-YYYY o DD/MM/YYYY
- La fila 1 de cada hoja debe ser el encabezado

## Ejecutar

```bash
cd C:/Proyectos/club-cuotas/scripts
pip install -r requirements.txt
python import_planilla.py
```

El script salta duplicados automáticamente — puedes ejecutarlo más de una vez sin problema.
