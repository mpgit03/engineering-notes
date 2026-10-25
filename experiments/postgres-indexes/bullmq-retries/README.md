
# BullMQ Retry and Idempotency Lab

A runnable experiment demonstrating background job retries, exponential backoff, and duplicate-processing considerations.

## Requirements

- Node.js 20+
- Docker and Docker Compose

## Start Redis

```bash
docker compose up -d redis
```

## Install dependencies

```bash
npm install
```

## Start the worker

In terminal 1:

```bash
npm run worker
```

## Enqueue a job

In terminal 2:

```bash
npm run enqueue
```

The job intentionally fails on its first attempt. BullMQ retries it with exponential backoff, and the later attempt succeeds.

## Concepts demonstrated

- Bounded retry attempts.
- Exponential backoff.
- Stable job IDs.
- Worker processing and failure events.
- Why retries require idempotent side effects.

## Important limitation

The worker uses an in-memory `Set` only to demonstrate duplicate detection. It does not survive a process restart and is not production-safe.

Production systems need durable idempotency storage and coordination between deduplication and the business mutation. For external APIs, use provider-supported idempotency keys when available.

A queue does not automatically guarantee exactly-once execution of external side effects.

## Cleanup

```bash
docker compose down
```

## References

- [BullMQ: Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ: Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [AWS: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
