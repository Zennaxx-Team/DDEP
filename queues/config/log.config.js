module.exports = {
  // Queue names
  name_save: 'logs-save-prd',
  name_complate: 'logs-complete-prd',
  name_alert_save: 'logs-alert-save-prd',
  name_alert_complate: 'logs-alert-complete-prd',
  name_diff_save: 'logs-diff-save-prd',
  name_diff_complate: 'logs-diff-complete-prd',

  // Batching configuration
  batchSize: 50,
  batchTimeout: 8000, // milliseconds

  // Worker concurrency settings
  singleWorkerConcurrency: 50,
  batchWorkerConcurrency: 5,

  // Job cleanup settings
  removeOnCompleteBatch: { count: 100 },
  removeOnFailBatch: { count: 100 },
  removeOnCompleteSingle: { count: 1000 },
  removeOnFailSingle: { count: 1000 },

  // Retry and backoff settings
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3000
  },

  // Queue rate limiter
  limiter: {
    max: 500,
    duration: 100
  },
};
