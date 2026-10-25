
class TokenBucketLimiter {
  constructor({ capacity, refillPerSecond, now = () => Date.now() }) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new TypeError("capacity must be a positive number");
    }

    if (
      !Number.isFinite(refillPerSecond) ||
      refillPerSecond <= 0
    ) {
      throw new TypeError(
        "refillPerSecond must be a positive number"
      );
    }

    this.capacity = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.now = now;
    this.buckets = new Map();
  }

  consume(key, cost = 1) {
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new TypeError("cost must be a positive number");
    }

    if (cost > this.capacity) {
      throw new RangeError(
        "cost cannot exceed bucket capacity"
      );
    }

    const currentTime = this.now();

    const previous = this.buckets.get(key) || {
      tokens: this.capacity,
      updatedAt: currentTime,
    };

    const elapsedMs = Math.max(
      0,
      currentTime - previous.updatedAt
    );

    const replenished = Math.min(
      this.capacity,
      previous.tokens + elapsedMs * this.refillPerMs
    );

    const allowed = replenished >= cost;

    const tokens = allowed
      ? replenished - cost
      : replenished;

    this.buckets.set(key, {
      tokens,
      updatedAt: currentTime,
    });

    const retryAfterMs = allowed
      ? 0
      : Math.ceil(
          (cost - replenished) / this.refillPerMs
        );

    return {
      allowed,
      remaining: Math.floor(tokens),
      retryAfterMs,
    };
  }
}

module.exports = { TokenBucketLimiter };
