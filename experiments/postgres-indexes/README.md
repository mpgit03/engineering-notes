
# PostgreSQL Index Experiments

Hands-on experiments for understanding B-tree indexes, selectivity, and PostgreSQL query plans.

## Requirements

- PostgreSQL 14+
- `psql` or another PostgreSQL client

## Run

Use a disposable development database because the script drops and recreates a table.

```bash
psql "$DATABASE_URL" -f setup_and_experiment.sql
```

## Experiments

1. Generate 200,000 synthetic orders.
2. Inspect query plans before adding indexes.
3. Add indexes on customer ID and status.
4. Compare query plans after indexing.
5. Test a composite index for filtering and sorting.

## What to inspect

Run `EXPLAIN (ANALYZE, BUFFERS)` and compare:

- Estimated rows versus actual rows.
- Sequential scans versus index scans.
- Buffer hits and reads.
- Rows removed by filters.
- Execution time.

A sequential scan is not necessarily bad. If a query returns a large fraction of a table, reading the table directly can be cheaper than following an index and fetching many rows.

## Important

Results depend on table size, data distribution, PostgreSQL statistics, cache state, and hardware. Record these conditions before drawing performance conclusions.

## References

- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
