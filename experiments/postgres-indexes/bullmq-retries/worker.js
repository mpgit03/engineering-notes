
const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
});

// Educational only: state disappears when this process restarts.
const processedBusinessKeys = new Set();
const attemptsSeen = new Map();

const worker = new Worker(
  "reliability-lab",
  async (job) => {
    const { businessKey, shouldFailFirstAttempt } = job.data;

    const attemptNumber = (attemptsSeen.get(job.id) || 0) + 1;
    attemptsSeen.set(job.id, attemptNumber);

    console.log(
      `Processing job=${job.id}, attempt=${attemptNumber}`
    );

    if (processedBusinessKeys.has(businessKey)) {
      console.log(`Duplicate detected: ${businessKey}`);

      return {
        status: "already-processed",
        businessKey,
      };
    }

    // Simulate a transient failure before the side effect.
    if (shouldFailFirstAttempt && attemptNumber === 1) {
      throw new Error("Simulated transient dependency failure");
    }

    // Simulated side effect, not a real database operation.
    processedBusinessKeys.add(businessKey);

    console.log(`Processed ${businessKey}`);

    return {
      status: "processed",
      businessKey,
    };
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("completed", (job, result) => {
  console.log(`Completed job=${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(
    `Failed attempt for job=${job?.id}: ${error.message}`
  );
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; closing worker`);

  await worker.close();
  await connection.quit();

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
