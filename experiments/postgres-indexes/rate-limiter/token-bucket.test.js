
const test = require("node:test");
const assert = require("node:assert/strict");

const { TokenBucketLimiter } = require("./token-bucket");

test("allows requests up to capacity, then rejects", () => {
  let now = 1000;

  const limiter = new TokenBucketLimiter({
    capacity: 3,
    refillPerSecond: 1,
    now: () => now,
  });

  assert.equal(limiter.consume("user-1").allowed, true);
  assert.equal(limiter.consume("user-1").allowed, true);
  assert.equal(limiter.consume("user-1").allowed, true);

  const rejected = limiter.consume("user-1");

  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfterMs, 1000);
});

test("refills tokens as time passes", () => {
  let now = 0;

  const limiter = new TokenBucketLimiter({
    capacity: 2,
    refillPerSecond: 2,
    now: () => now,
  });

  limiter.consume("user-1");
  limiter.consume("user-1");

  assert.equal(limiter.consume("user-1").allowed, false);

  now += 500;

  assert.equal(limiter.consume("user-1").allowed, true);
});

test("keeps buckets isolated by key", () => {
  let now = 0;

  const limiter = new TokenBucketLimiter({
    capacity: 1,
    refillPerSecond: 1,
    now: () => now,
  });

  assert.equal(limiter.consume("alice").allowed, true);
  assert.equal(limiter.consume("alice").allowed, false);
  assert.equal(limiter.consume("bob").allowed, true);
});

test("rejects invalid costs", () => {
  const limiter = new TokenBucketLimiter({
    capacity: 2,
    refillPerSecond: 1,
  });

  assert.throws(
    () => limiter.consume("user-1", 0),
    /cost/
  );
});

test("rejects costs greater than bucket capacity", () => {
  const limiter = new TokenBucketLimiter({
    capacity: 2,
    refillPerSecond: 1,
  });

  assert.throws(
    () => limiter.consume("user-1", 3),
    /capacity/
  );
});
