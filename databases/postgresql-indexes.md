# PostgreSQL Indexes — Complete Revision Guide

> **Goal:** Understand how indexes work, choose the right index for a query, interpret PostgreSQL query plans, and reason about performance trade-offs.

## 1. Quick Revision

- An index is a separate data structure that helps PostgreSQL locate rows without scanning the entire table.
- PostgreSQL's default index type is **B-tree**.
- An index can speed up reads but adds storage, write overhead, and maintenance cost.
- An index is not guaranteed to be used; PostgreSQL's planner chooses the estimated cheapest plan.
- Composite indexes depend on column order.
- `EXPLAIN` shows the planned execution strategy; `EXPLAIN ANALYZE` executes the query and reports observed execution details.
- Indexes are most valuable when they substantially reduce the work required by a query.
- Measure using execution plans and buffer statistics, not just elapsed time.

### The core mental model

An index is an optimization for a particular *access pattern*, not a general-purpose speed boost.

Before adding an index, ask:

1. Which query is slow?
2. Which columns are used in filters, joins, and sorting?
3. How many rows match the conditions?
4. Does the chosen plan perform unnecessary scans or sorting?
5. Will the index's read benefit justify its write and storage costs?

---

## 2. What Is an Index?

Without a useful index, PostgreSQL may perform a sequential scan, examining table pages to find matching rows.

With a suitable index, PostgreSQL can locate matching entries more directly and retrieve the corresponding table rows.

Conceptually:

```text
Without an index
Query → Scan table pages → Filter rows → Return results

With an index
Query → Search index → Locate matching rows → Fetch table rows
```

An index does not normally replace the table. It is a separate structure containing indexed values and references to the corresponding table rows.

### Why not index every column?

Every additional index has costs:

- Additional disk storage.
- More work during inserts, updates, and deletes.
- Additional maintenance during vacuuming and index operations.
- More choices for the query planner.
- Potentially redundant structures that provide little additional value.

**Rule:** Add indexes to support important query patterns, then validate their usefulness.

---

## 3. How B-tree Indexes Work

B-tree is PostgreSQL's default index type and is suitable for many common comparisons.

Typical supported operations include:

```sql
WHERE customer_id = 42
WHERE total >= 100
WHERE created_at BETWEEN ... AND ...
ORDER BY created_at DESC
```

A B-tree maintains keys in sorted order and organizes them into pages. Searching traverses the tree to find the relevant key range rather than scanning every index entry.

### When B-tree is useful

- Equality comparisons: `=`
- Range comparisons: `<`, `<=`, `>`, `>=`
- Ordered results: `ORDER BY`
- Prefix matching for some anchored patterns, depending on collation and operator class
- Enforcing uniqueness through a unique index

### Important distinction

An index lookup can still require table access. An index-only scan is possible when the index contains the required values and PostgreSQL can establish tuple visibility without visiting the heap for every row.

Do not assume that using an index means zero table-page reads.

---

## 4. PostgreSQL Index Types

| Type | Typical use | Key consideration |
|---|---|---|
| B-tree | Equality, ranges, sorting | General-purpose default |
| Hash | Equality comparisons | No range ordering |
| GIN | Composite values such as arrays, `jsonb`, and full-text search | Useful for membership and containment queries |
| GiST | Geometric data, ranges, and extensible search strategies | Behavior depends on the operator class |
| SP-GiST | Partitioned search structures, such as certain spatial or prefix-search problems | Depends on data shape and operator class |
| BRIN | Very large tables whose physical row order correlates with a column | Small index, but usually less precise than B-tree |

### Examples

B-tree:

```sql
CREATE INDEX idx_orders_customer_id
ON orders (customer_id);
```

GIN for JSONB containment:

```sql
CREATE INDEX idx_products_attributes
ON products USING GIN (attributes);

SELECT *
FROM products
WHERE attributes @> '{"color": "blue"}';
```

BRIN for a large, physically time-correlated table:

```sql
CREATE INDEX idx_events_created_at
ON events USING BRIN (created_at);
```

**Important:** Index suitability depends on the operators used, the operator class, data distribution, and workload. Do not choose an index type solely from the column's data type.

---

## 5. Single-Column Indexes

Example query:

```sql
SELECT *
FROM orders
WHERE customer_id = 4242;
```

A matching index:

```sql
CREATE INDEX idx_orders_customer_id
ON orders (customer_id);
```

This can reduce the number of table rows PostgreSQL must inspect when only a small fraction match.

### Selectivity

Selectivity describes how narrowly a condition identifies rows.

- High selectivity: relatively few rows match.
- Low selectivity: many rows match.

A condition matching 20 out of 200,000 rows is highly selective. A condition matching 180,000 out of 200,000 rows is not.

An index is often more useful for selective conditions, although the best plan depends on row width, cache state, physical layout, and other costs.

### Low-selectivity columns

A standalone index on a boolean or a status column may not help when a query returns most of the table.

However, such columns can still be useful in a composite or partial index when the full query pattern makes the index selective.

---

## 6. Composite Indexes

A composite index stores entries ordered by multiple columns.

```sql
CREATE INDEX idx_orders_customer_status_created
ON orders (customer_id, status, created_at DESC);
```

This index is designed for queries such as:

```sql
SELECT id, created_at
FROM orders
WHERE customer_id = 4242
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;
```

### Column order matters

For a B-tree index on `(customer_id, status, created_at)`:

- Queries filtering on `customer_id` can often use the leading portion of the index.
- Queries filtering on both `customer_id` and `status` can use both leading columns.
- A query filtering only on `status` generally cannot use the index as efficiently as an index beginning with `status`.
- The index may support ordering by `created_at` when the leading columns are appropriately constrained.

Modern PostgreSQL versions can sometimes use skip scans for certain non-leading-column conditions, but this is workload- and version-dependent. Do not rely on skip scans as a replacement for sensible index design.

### A practical design heuristic

For a common B-tree query, consider:

1. Equality conditions on leading columns.
2. Range conditions and their effect on later index columns.
3. Required ordering.
4. Whether `LIMIT` allows the index to stop early.
5. Other queries that can benefit from the same index.

This is a heuristic, not a universal rule. Validate with `EXPLAIN ANALYZE`.

### Covering indexes and `INCLUDE`

PostgreSQL supports non-key columns using `INCLUDE`:

```sql
CREATE INDEX idx_orders_customer_covering
ON orders (customer_id)
INCLUDE (status, created_at);
```

Included columns can make index-only scans possible for queries that need those values, but they do not participate in index ordering or search qualification like key columns do.

Index-only scans also depend on heap visibility information. They are not guaranteed to avoid all heap access.

---

## 7. Partial and Expression Indexes

### Partial indexes

A partial index contains only rows satisfying a predicate.

```sql
CREATE INDEX idx_open_orders_customer
ON orders (customer_id)
WHERE status = 'open';
```

This can be useful if queries frequently retrieve open orders and open orders form a relatively small portion of the table.

PostgreSQL must be able to establish that the query predicate implies the index predicate. Parameterized queries and generic plans can complicate this, so verify the actual plan.

### Expression indexes

An expression index stores the result of an expression:

```sql
CREATE INDEX idx_users_lower_email
ON users (lower(email));
```

A matching query:

```sql
SELECT *
FROM users
WHERE lower(email) = lower('Person@example.com');
```

An ordinary index on `email` is not necessarily sufficient for the `lower(email)` expression.

Expression indexes are useful when the same expression appears frequently in filters or ordering.

---

## 8. Understanding Query Plans

Use `EXPLAIN` to inspect the planned execution strategy:

```sql
EXPLAIN
SELECT *
FROM orders
WHERE customer_id = 4242;
```

Use `EXPLAIN ANALYZE` to execute the statement and report observed execution details:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM orders
WHERE customer_id = 4242;
```

### Common plan nodes

**Seq Scan**

Reads the table sequentially and applies a filter. This is often appropriate when many rows must be returned.

**Index Scan**

Uses an index to find rows and accesses the table as needed.

**Index Only Scan**

Can return required values from the index when visibility information permits.

**Bitmap Index Scan + Bitmap Heap Scan**

Collects matching row locations from an index, then visits the corresponding heap pages. This can be efficient when multiple matching rows are spread across the table.

**Sort**

Sorts rows to satisfy ordering. Its presence may indicate that the chosen access path did not provide the required ordering.

**Nested Loop, Hash Join, Merge Join**

Different strategies for joining relations. Their suitability depends on cardinality, available ordering, memory, and other costs.

### Reading the timing fields

Example:

```text
Index Scan ...
  (cost=0.42..8.44 rows=10 width=32)
  (actual time=0.030..0.045 rows=10 loops=1)
```

- `cost`: estimated planner cost, not milliseconds.
- `rows`: estimated output row count.
- `width`: estimated average output row width in bytes.
- `actual time`: observed timing in milliseconds.
- `rows` in the actual section: observed output rows.
- `loops`: number of executions of the plan node.

When `loops` exceeds one, timing and row figures require careful interpretation; per-loop values are generally reported as averages.

### Buffers

With `EXPLAIN (ANALYZE, BUFFERS)`:

- `shared hit`: requested shared-buffer pages already found in PostgreSQL's buffer cache.
- `shared read`: shared-buffer pages that had to be read into the buffer cache. The operating system may still have cached the underlying data.
- `temp read` and `temp written`: temporary blocks used by operations such as sorts or hashes when relevant.

Buffer counts are useful for understanding page access. They are not simply counts of physical disk operations.

### Why estimated and actual rows matter

A large mismatch between estimated and actual row counts can lead to a poor plan choice.

Investigate:

- Whether statistics are current.
- Whether the data distribution is skewed.
- Whether correlated columns need extended statistics.
- Whether predicates or expressions make estimation difficult.

`ANALYZE` updates table statistics:

```sql
ANALYZE orders;
```

Do not create an index automatically whenever a query is slow. First identify the expensive operation and why it is expensive.

---

## 9. Hands-On Experiment: PostgreSQL Indexes

Experiment files:

- [`experiments/postgres-indexes/README.md`](../experiments/postgres-indexes/README.md)
- [`experiments/postgres-indexes/setup_and_experiment.sql`](../experiments/postgres-indexes/setup_and_experiment.sql)

The lab creates 200,000 rows, compares execution plans before and after indexes, and tests a composite index.

### Observed results

| Query | Before | After | Observation |
|---|---:|---:|---|
| `customer_id = 4242` | 13.444 ms | 0.198 ms | Changed from sequential scan to bitmap-based index access |
| `status = 'completed'` | 39.157 ms | 35.212 ms | Sequential scan remained the chosen plan |

The customer lookup returned 20 rows out of 200,000, while the status filter returned 180,000 rows.

The composite-index query used the index for filtering but still performed a sort in the observed plan.

These measurements are specific to one local run. Cache state, hardware, PostgreSQL version, and data distribution can change timings and plan choices.

### What this experiment proves

1. Indexes can dramatically reduce work for selective lookups.
2. PostgreSQL does not use an index simply because one exists.
3. The percentage of matching rows matters.
4. Composite indexes must be evaluated against the actual query pattern.
5. Query-plan structure provides more insight than timing alone.

### Follow-up query

Test the intended composite-index access pattern:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at
FROM index_lab_orders
WHERE customer_id = 4242
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;
```

Check whether the planner uses the composite index and whether a sort is still required.

---

## 10. Index Maintenance and Operations

### Inspect indexes

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Inspect index sizes

```sql
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Inspect index usage statistics

```sql
SELECT
    relname,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

Usage statistics are cumulative since the relevant statistics were reset and can be affected by workload, restarts, and monitoring windows. Low usage alone does not prove an index is unnecessary; it may support a rare but critical query or enforce a constraint.

### Create an index concurrently

For production tables where blocking writes for the duration of a normal index build is unacceptable:

```sql
CREATE INDEX CONCURRENTLY idx_orders_customer_id
ON orders (customer_id);
```

`CREATE INDEX CONCURRENTLY` has operational trade-offs and restrictions. It cannot run inside a transaction block and can take longer than a regular build.

### Remove an index

```sql
DROP INDEX idx_orders_customer_id;
```

Confirm dependencies and operational impact before removing a production index.

---

## 11. Common Mistakes

- Indexing every column without examining real queries.
- Assuming every index scan is faster than a sequential scan.
- Ignoring composite-index column order.
- Assuming an index always eliminates sorting.
- Measuring a query only once and treating the timing as universal.
- Confusing planner cost with milliseconds.
- Ignoring stale or inaccurate statistics.
- Creating redundant indexes that increase write cost.
- Forgetting that indexes consume storage and require maintenance.
- Running destructive experiment scripts against production databases.

**Safety:** The supplied lab drops and recreates `index_lab_orders`. Run it only in a disposable development database.

---

## 12. Interview Questions and Answers

### Q1. Why can a sequential scan be faster than an index scan?

When a query returns a large portion of a table, sequentially reading the table may cost less than following index entries and fetching many heap pages.

### Q2. Does creating an index guarantee its use?

No. PostgreSQL's planner compares estimated costs and chooses a plan. A sequential scan may be cheaper.

### Q3. Why does column order matter in a composite index?

A B-tree is ordered by its leading columns first. Leading-column conditions generally allow more effective navigation through the index.

### Q4. What is the difference between `EXPLAIN` and `EXPLAIN ANALYZE`?

`EXPLAIN` reports the plan without executing the query. `EXPLAIN ANALYZE` executes it and reports observed execution details.

### Q5. Why might an index improve reads but hurt writes?

PostgreSQL must maintain the index as rows are inserted, deleted, or updated. This adds work, storage, and potentially additional page modifications.

### Q6. What is a covering index?

An index that contains all the values needed by a query, potentially allowing an index-only scan. In PostgreSQL, `INCLUDE` can store non-key columns, but visibility checks can still require heap access.

### Q7. What is a partial index?

An index containing only rows that satisfy a predicate. It can reduce index size and maintenance work when queries repeatedly target that subset.

### Q8. Why might a composite index still be followed by a sort?

The planner may choose an access path that does not preserve the desired ordering, such as a bitmap heap scan.

### Q9. What should you do when estimated and actual row counts differ significantly?

Check statistics, data skew, predicate selectivity, and whether extended statistics or other query improvements are appropriate.

### Q10. How would you investigate a slow production query?

1. Capture the actual query and parameters.
2. Inspect `EXPLAIN (ANALYZE, BUFFERS)` where safe.
3. Find expensive scans, joins, sorts, or row-estimation errors.
4. Verify statistics and the query's access pattern.
5. Test a targeted change.
6. Compare execution plans, latency, buffer activity, and write overhead.

---

## 13. Final Revision Checklist

Before considering this topic revised, make sure you can explain:

- [ ] How a B-tree index helps locate rows.
- [ ] Why an index can be ignored by the planner.
- [ ] Selectivity and its relationship to scan choices.
- [ ] Composite-index ordering and leading columns.
- [ ] Partial, expression, covering, and specialized indexes.
- [ ] The difference between sequential, index, bitmap, and index-only scans.
- [ ] How to read costs, actual rows, timings, and buffers.
- [ ] How indexes affect write performance and storage.
- [ ] How to investigate a slow query systematically.
- [ ] What your own experiment demonstrated and what its limitations were.

## Further Reading

- [PostgreSQL: Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL: Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL: CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
