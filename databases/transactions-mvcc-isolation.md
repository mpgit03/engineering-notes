# Transactions, MVCC, and Isolation Levels

## The problem

Applications often read and modify the same data concurrently. Without a clear concurrency model, one operation may observe inconsistent state or overwrite another operation's work.

A transaction groups database operations into a unit with defined commit and rollback behavior. Isolation controls what concurrent transactions can observe.

## ACID in brief

- **Atomicity:** a transaction's changes are committed as a unit or rolled back.
- **Consistency:** transactions should preserve database constraints and application invariants.
- **Isolation:** concurrent transactions are controlled according to the database's isolation rules.
- **Durability:** committed changes are intended to survive failures according to the database's durability configuration.

ACID does not mean every application-level invariant is automatically protected. Constraints, locking, isolation choices, and application logic still matter.

## MVCC mental model

PostgreSQL uses multiversion concurrency control (MVCC). Rather than making every reader wait for every writer, the database can expose a snapshot of row versions appropriate to a statement or transaction.

This improves concurrency, but it does not eliminate all contention. Writers can block one another, locks still matter, and long-running transactions can delay cleanup of old row versions.

## Isolation levels

The SQL standard describes common anomalies such as dirty reads, non-repeatable reads, and phantom reads. PostgreSQL's behavior differs from some other database systems, so consult its documentation instead of assuming every engine implements each level identically.

| Level | General idea | PostgreSQL behavior |
|---|---|---|
| Read Uncommitted | Allows the weakest isolation in the SQL model | Behaves as Read Committed |
| Read Committed | Each statement sees a snapshot as of that statement's start | Default isolation level |
| Repeatable Read | A transaction works from a stable snapshot | PostgreSQL prevents phantom reads at this level, but serialization anomalies can still occur |
| Serializable | Transactions behave as if executed in a serial order | PostgreSQL may abort a transaction to prevent a serialization anomaly; the application must retry safely |

## Example: a read-then-write race

Imagine two requests each read an account balance of 100 and independently decide whether a withdrawal of 80 is allowed. If both then write a new balance based on the old value, a naive implementation can violate the business rule.

Possible approaches include:
- An atomic conditional update.
- A row lock such as `SELECT ... FOR UPDATE`.
- A suitable transaction isolation level plus retry handling.
- A schema constraint where it can express the invariant.

For example, a conditional update can combine the check and mutation:

```sql
UPDATE accounts
SET balance = balance - 80
WHERE id = 123
  AND balance >= 80
RETURNING balance;
```

The application must check whether a row was returned. This example assumes the balance is stored in a numeric type and other business rules are handled appropriately.

## Serializable does not mean "no errors"

Serializable isolation can detect conflicts that make a serial execution impossible and abort one transaction. Applications must be prepared to retry the **whole transaction**, not just the final statement, when the database reports a serialization failure.

Retries should be bounded and should not repeat external side effects blindly. Sending an email or charging a payment inside a retryable transaction requires separate design.

## Locks and transaction duration

Long transactions can:
- Hold locks and increase contention.
- Keep old row versions relevant for longer.
- Increase the chance of deadlocks or timeouts.
- Make retries more expensive.

Keep transactions focused. Avoid waiting on user input or slow external services while holding a transaction open.

## Practical experiment

Using two database sessions:
1. Begin a transaction in each session.
2. Read and update the same logical record.
3. Repeat under Read Committed and Repeatable Read.
4. Try a Serializable transaction and observe possible serialization failures.
5. Record the exact statements, isolation setting, and PostgreSQL version.
6. Add retry logic in a small application and test that the invariant still holds.

Use a disposable database for experiments.

## Takeaways

- Transactions provide boundaries, but correct isolation depends on the invariant.
- MVCC allows concurrent readers and writers, but locks and contention still exist.
- Serializable transactions may abort and require safe retries.
- Database constraints and atomic statements are often simpler than application-only checks.

## References

- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL: MVCC Introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
