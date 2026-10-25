
-- WARNING: This script drops and recreates index_lab_orders.
-- Run ONLY against a disposable development database.

DROP TABLE IF EXISTS index_lab_orders;

CREATE TABLE index_lab_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Generate deterministic synthetic data.
INSERT INTO index_lab_orders (
    customer_id,
    status,
    total_cents,
    created_at
)
SELECT
    (g % 10000)::INTEGER,
    CASE
        WHEN g % 100 = 0 THEN 'cancelled'
        WHEN g % 10 = 0 THEN 'pending'
        ELSE 'completed'
    END,
    500 + (g % 50000)::INTEGER,
    TIMESTAMPTZ '2025-01-01 00:00:00+00'
        + (g * INTERVAL '1 minute')
FROM generate_series(1, 200000) AS g;

ANALYZE index_lab_orders;

\echo '--- 1. Selective lookup BEFORE index ---'

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM index_lab_orders
WHERE customer_id = 4242;

\echo '--- 2. Broad filter BEFORE index ---'

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM index_lab_orders
WHERE status = 'completed';

-- Add individual indexes.
CREATE INDEX index_lab_orders_customer_id_idx
    ON index_lab_orders (customer_id);

CREATE INDEX index_lab_orders_status_idx
    ON index_lab_orders (status);

ANALYZE index_lab_orders;

\echo '--- 3. Selective lookup AFTER index ---'

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM index_lab_orders
WHERE customer_id = 4242;

\echo '--- 4. Broad filter AFTER index ---'

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM index_lab_orders
WHERE status = 'completed';

-- Composite index for filtering and ordering.
CREATE INDEX index_lab_orders_customer_status_created_idx
    ON index_lab_orders (
        customer_id,
        status,
        created_at DESC
    );

ANALYZE index_lab_orders;

\echo '--- 5. Composite index experiment ---'

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at, total_cents
FROM index_lab_orders
WHERE customer_id = 4242
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;

\echo '--- Index inventory ---'

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'index_lab_orders'
ORDER BY indexname;
