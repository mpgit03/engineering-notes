
# Token Bucket Rate Limiter Lab

A small JavaScript implementation of the token bucket algorithm, with deterministic unit tests.

## Requirements

- Node.js 20+

## Run tests

From this directory:

```bash
node --test
```

## How it works

Each client has a bucket with a maximum capacity and a refill rate.

- A new bucket starts full.
- Tokens refill as time passes, up to the capacity.
- A request consumes tokens if enough are available.
- Otherwise, the request is rejected with an estimated retry delay.

An injected clock makes the behavior testable without waiting in real time.

## Limitations

This implementation stores buckets in process memory. State disappears on restart, and different server instances maintain independent limits.

A distributed limiter needs shared coordination and atomic updates. Redis with a carefully designed Lua script is one possible approach.

## Further reading

- [Redis: Rate limiter pattern](https://redis.io/docs/latest/develop/use/patterns/rate-limiter/)
- [RFC 6585: 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585)
