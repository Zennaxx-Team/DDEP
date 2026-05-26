const { Worker, Queue } = require('bullmq');
const { connection } = require('../config/queuesConfigartion');
const logQueueConfig = require('../config/log.config');
const { bulkSaveHistory } = require('../../controllers/alert_history.controller');

const {
    limiter: LIMITER,
    batchSize: BATCH_SIZE,
    batchTimeout: BATCH_TIMEOUT,
    attempts: ATTEMPTS,
    backoff: BACKOFF,
    singleWorkerConcurrency,
    batchWorkerConcurrency,
    removeOnCompleteBatch,
    removeOnFailBatch,
    removeOnCompleteSingle,
    removeOnFailSingle
} = logQueueConfig;

// Create batch queue
const batchQueue = new Queue(`${logQueueConfig.name_alert_complate}`, { connection });

// Batch worker - processes batches of 50
const batchWorker = new Worker(`${logQueueConfig.name_alert_complate}`, async (job) => {
    const logs = job.data.logs;
    console.log(`Processing batch of ${logs.length} logs`);

    try {
        const result = await bulkSaveHistory(logs);
        if (result.status === 1) {
            console.log(`[BATCH] Successfully processed ${logs.length} logs`);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        console.error(`[BATCH] Processing failed: ${err.message}`);
        throw err;
    }
}, {
    connection,
    attempts: ATTEMPTS,
    backoff: BACKOFF,
    concurrency: batchWorkerConcurrency,
    removeOnComplete: removeOnCompleteBatch,
    removeOnFail: removeOnFailBatch
});

// Individual job worker - just returns the data (no processing)
const worker = new Worker(logQueueConfig.name_alert_save, async (job) => {
    return job.data; // Just return data, don't process
}, {
    connection,
    concurrency: singleWorkerConcurrency,
    removeOnComplete: removeOnCompleteSingle,
    removeOnFail: removeOnFailSingle,
    limiter: LIMITER
});

// Batch collection logic
let logBatch = [];
let batchTimer = null;

worker.on('completed', async (job, result) => {
    logBatch.push(result);

    // Create batch when full or start timer
    if (logBatch.length >= BATCH_SIZE) {
        await createBatch();
    } else if (!batchTimer) {
        batchTimer = setTimeout(createBatch, BATCH_TIMEOUT);
    }
});

async function createBatch() {
    if (logBatch.length === 0) return;

    const logsToProcess = [...logBatch];
    logBatch = [];

    if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
    }

    console.log(`Creating batch with ${logsToProcess.length} logs`);

    try {
        await batchQueue.add('process-batch', { logs: logsToProcess }, {
            removeOnComplete: removeOnCompleteBatch,
            removeOnFail: removeOnFailBatch,
            attempts: ATTEMPTS,
            backoff: BACKOFF
        });
    } catch (err) {
        console.error('Error creating batch:', err.message);
        // Re-add individual logs on batch creation failure
        const logQueue = new Queue(logQueueConfig.name_alert_save, { connection });
        for (const log of logsToProcess) {
            await logQueue.add('log', log, { removeOnComplete: true });
        }
    }
}

// Error handling
worker.on('error', (err) => console.error(`Worker Error: ${err.message}`));
batchWorker.on('error', (err) => console.error(`Batch Worker Error: ${err.message}`));

worker.on('failed', (job, err) => console.error(`Job failed: ${err.message}`));
batchWorker.on('failed', (job, err) => {
    console.error(`Batch failed: ${err.message}`);
    // Re-add individual logs when batch fails
    const logs = job.data.logs;
    const logQueue = new Queue(logQueueConfig.name_alert_save, { connection });
    logs.forEach(log => logQueue.add('log', log, { removeOnComplete: true }));
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');

    // Process remaining batch
    if (logBatch.length > 0) {
        console.log(`Processing final batch of ${logBatch.length} logs`);
        await createBatch();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await worker.close();
    await batchWorker.close();
    process.exit(0);
});