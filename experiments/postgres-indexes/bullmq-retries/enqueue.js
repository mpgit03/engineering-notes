
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
});

async function main() {
  const queue = new Queue("reliability-lab", { connection });

  const job = await queue.add(
    "demo-task",
    {
      businessKey: "invoice:inv_demo_001",
      shouldFailFirstAttempt: true,
    },
    {
      jobId: "invoice-inv-demo-001",
      attempts: 4,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  console.log(`Enqueued job ${job.id}`);

  await queue.close();
  await connection.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
