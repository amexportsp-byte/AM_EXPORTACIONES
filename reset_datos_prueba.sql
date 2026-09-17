-- ============================================================
-- RESET DE DATOS DE PRUEBA — A&M Importaciones
-- Fecha: 2026-06-07
-- ============================================================
--
-- QUÉ HACE:
--   Elimina todos los datos de prueba ingresados en:
--     - Módulo Registro  (productos, stock, movimientos)
--     - Módulo Ventas    (ventas, comprobantes, pagos, pedidos, reclamos, clientes)
--     - Módulo Libro     (asientos, compras, gastos, inversiones, CxC, CxP)
--     - Tipo de cambio   (cotizaciones registradas)
--     - Logs y auditoría
--   Y reinicia todas las secuencias a 1.
--
-- QUÉ CONSERVA:
--   ✔ categories, subcategories, brands, suppliers
--   ✔ origins, colors, sizes, units
--   ✔ currencies, banks, payment_methods
--   ✔ accounting_plan
--   ✔ workers, worker_preferences, role_permissions, system_config
--
-- CÓMO USAR EN NEON:
--   Pega y ejecuta este script completo en el SQL Editor de Neon.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- 1. REINICIAR SECUENCIAS A 1
-- ──────────────────────────────────────────────────────────
ALTER SEQUENCE product_code_seq  RESTART WITH 1;
ALTER SEQUENCE invoice_fac_seq   RESTART WITH 1;
ALTER SEQUENCE invoice_bol_seq   RESTART WITH 1;
ALTER SEQUENCE invoice_nv_seq    RESTART WITH 1;
ALTER SEQUENCE complaint_seq     RESTART WITH 1;
ALTER SEQUENCE order_seq         RESTART WITH 1;
ALTER SEQUENCE report_seq        RESTART WITH 1;

-- ──────────────────────────────────────────────────────────
-- 2. MÓDULO LIBRO CONTABLE
--    journal_entries, purchases, expenses, investments,
--    accounts_receivable_extra, accounts_payable_extra
-- ──────────────────────────────────────────────────────────
TRUNCATE TABLE
    accounts_payable_extra,
    accounts_receivable_extra,
    investments,
    journal_entries,
    purchases,
    expenses
RESTART IDENTITY CASCADE;

-- ──────────────────────────────────────────────────────────
-- 3. TIPO DE CAMBIO (cotizaciones de prueba)
--    Se conservan currencies y banks (son configuración)
-- ──────────────────────────────────────────────────────────
TRUNCATE TABLE
    exchange_rates,
    exchange_observations
RESTART IDENTITY CASCADE;

-- ──────────────────────────────────────────────────────────
-- 4. MÓDULO VENTAS
--    Orden: primero tablas hijo, luego padre
-- ──────────────────────────────────────────────────────────
TRUNCATE TABLE
    complaint_audit_log,
    complaint_tracking,
    complaints,
    invoice_audit_log,
    sale_payments,
    sale_details,
    invoices,
    client_audit_log,
    order_tracking,
    order_details,
    orders,
    sales,
    client_accounts,
    clients
RESTART IDENTITY CASCADE;

-- ──────────────────────────────────────────────────────────
-- 5. MÓDULO REGISTRO (productos e inventario)
--    Se conservan categories, subcategories, brands,
--    suppliers, origins, colors, sizes, units
-- ──────────────────────────────────────────────────────────
TRUNCATE TABLE
    inventory_movements,
    product_code_history,
    products,
    product_infos
RESTART IDENTITY CASCADE;

-- ──────────────────────────────────────────────────────────
-- 6. LOGS, AUDITORÍA Y SESIONES DE PRUEBA
-- ──────────────────────────────────────────────────────────
TRUNCATE TABLE
    audit_logs,
    notifications,
    page_visits,
    attendance,
    attendance_access_log
RESTART IDENTITY CASCADE;

COMMIT;

-- ──────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar después del COMMIT para confirmar)
-- ──────────────────────────────────────────────────────────
SELECT 'products'             AS tabla, COUNT(*) AS filas FROM products
UNION ALL
SELECT 'sales',                          COUNT(*) FROM sales
UNION ALL
SELECT 'invoices',                       COUNT(*) FROM invoices
UNION ALL
SELECT 'clients',                        COUNT(*) FROM clients
UNION ALL
SELECT 'journal_entries',                COUNT(*) FROM journal_entries
UNION ALL
SELECT 'investments',                    COUNT(*) FROM investments
UNION ALL
SELECT 'accounts_receivable_extra',      COUNT(*) FROM accounts_receivable_extra
UNION ALL
SELECT 'accounts_payable_extra',         COUNT(*) FROM accounts_payable_extra
UNION ALL
SELECT '--- CONSERVADOS ---',           0
UNION ALL
SELECT 'categories',                     COUNT(*) FROM categories
UNION ALL
SELECT 'subcategories',                  COUNT(*) FROM subcategories
UNION ALL
SELECT 'brands',                         COUNT(*) FROM brands
UNION ALL
SELECT 'suppliers',                      COUNT(*) FROM suppliers
UNION ALL
SELECT 'workers',                        COUNT(*) FROM workers
ORDER BY tabla;
