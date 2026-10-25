# PostgreSQL Indexes: B-tree, Selectivity, and Query Plans

## The problem

A database can find rows by scanning a table, but the work grows with the amount of data. Indexes provide an additional data structure that can help PostgreSQL locate matching rows without reading every table row.

An index is not automatically faster. It costs storage and adds work to inserts, updates, and deletes. PostgreSQL's planner estimates the cost of candidate plans and chooses what it expects to be cheapest.

## A useful mental model

A B-tree index keeps keys in sorted order and supports efficient searches, range scans, and ordered retrieval. Conceptually, it helps the database navigate toward matching keys instead of examining every row.

For a table such as:

```sql
CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    status      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

A query that filters by `customer_id` may benefit from the index:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM orders
WHERE customer_id = 42;
```

`EXPLAIN` shows the chosen plan. `ANALYZE` executes the query and reports observed execution statistics, so use care with statements that modify data.

## Why an index may not be used

A sequential scan can be cheaper when:
- The table is small.
- A large fraction of rows matches the predicate.
- Reading the table sequentially costs less than following index entries and fetching many scattered rows.
- The predicate or expression does not match the available index in a useful way.
- Statistics are stale or estimates are inaccurate.

Do not interpret `Seq Scan` as proof that PostgreSQL is broken. Compare estimates, actual row counts, buffer activity, and the real workload.

## Selectivity

Selectivity describes how much of a relation matches a condition. A predicate matching a tiny fraction of rows is often a stronger index candidate than one matching most rows.

For example, if `status = 'pending'` matches 1% of orders, an index may be useful. If it matches 90%, a sequential scan may be more economical. The outcome depends on row width, table layout, cache state, statistics, and query shape.

## Composite indexes and column order

Consider:

```sql
CREATE INDEX orders_customer_status_created_idx
ON orders (customer_id, status, created_at DESC);
```

This index is designed around queries that constrain `customer_id`, often also `status`, and may order by `created_at`. Column order matters: a multicolumn B-tree is most naturally useful when conditions constrain its leading columns. Validate the index against the actual query patterns rather than adding columns speculatively.

## Read plans methodically

For `EXPLAIN (ANALYZE, BUFFERS)`, inspect:
1. **Estimated rows vs. actual rows:** large differences can indicate estimation problems.
2. **Scan type:** sequential, index, or bitmap scan.
3. **Rows removed by filter:** may reveal work that did not contribute to the result.
4. **Buffers:** shared hits and reads help explain data access, though they are not a complete performance metric.
5. **Loops:** a node executed many times may dominate total work.
6. **Planning and execution time:** useful context, but don't compare timings without controlling the experiment.

`EXPLAIN ANALYZE` timings are observations from one execution, not a universal benchmark. Warm caches, concurrent traffic, and machine load affect results.

## Index costs and operational trade-offs

- Additional indexes consume disk and memory.
- Every relevant write may need to update indexes.
- Indexes can become less useful if query patterns change.
- Too many similar indexes complicate maintenance and can slow writes.
- A query that needs many table columns may still perform heap reads after using an index.

Create indexes to serve measured or well-understood query patterns. Recheck them as the application and data distribution evolve.

## Practical experiment

1. Create a table with a realistic number of rows.
2. Insert a repeatable dataset with a known distribution of `customer_id` and `status`.
3. Run representative queries with `EXPLAIN (ANALYZE, BUFFERS)` before adding an index.
4. Add one index and repeat the same query.
5. Compare plan shape, actual rows, buffers, and timings.
6. Repeat with a highly selective predicate and a low-selectivity predicate.
7. Record PostgreSQL version, data volume, hardware, and whether the cache was warm.

Avoid publishing benchmark conclusions without describing the test conditions.

## Takeaways

- An index is an optimization option, not a command to use a particular plan.
- Query selectivity, data distribution, and query shape matter.
- Read the complete plan; don't judge only by scan type.
- Measure representative workloads before adding indexes.

## References

- [PostgreSQL: Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL: Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
- [PostgreSQL: Planner Statistics](https://www.postgresql.org/docs/current/planner-stats.html)
