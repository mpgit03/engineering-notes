# Engineering Notes

A practical, continuously updated handbook of software engineering concepts, implementation details, and trade-offs.

The goal is to understand not only **what** a technology does, but **why** it behaves the way it does, when to use it, and what can go wrong in production.

## Topics

### Databases
- [PostgreSQL Indexes: B-tree, Selectivity, and Query Plans](databases/postgresql-indexes.md)
- [Transactions, MVCC, and Isolation Levels](databases/transactions-mvcc-isolation.md)

### Backend Engineering
- [Reliable Background Jobs: Retries, Backoff, and Idempotency](distributed-systems/reliable-background-jobs.md)

### System Design
- [Designing a Rate Limiter](system-design/rate-limiter.md)

## How these notes are written

Each note aims to include:
- The problem being solved
- A mental model and how the mechanism works
- A concrete example
- Trade-offs and failure scenarios
- Practical questions to investigate
- References to primary documentation

These notes are learning artifacts, not a substitute for official documentation. Examples should be tested in the target environment before being used in production.

## Suggested learning path

1. Understand index selection and query plans.
2. Learn transaction isolation and concurrency anomalies.
3. Design background jobs that tolerate retries and worker failures.
4. Explore rate limiting algorithms and their operational trade-offs.

## Contributing to your own understanding

When updating a note, prefer a small reproducible experiment over an unsupported claim. Record the database version, workload, assumptions, and limitations when discussing measurements.

## Disclaimer

This repository is educational. It does not claim that examples are production-ready without adaptation, security review, load testing, and operational monitoring.
