module.exports = {
  name: 'mail-prd',
  name_action_mail: "mail-action-prd",
  name_alert_mail: "mail-alert-prd",
  name_mail_log_update: 'mail-logs-update',
  name_mail_history_log_update: 'mail-history-logs-update',
  resend_name: 'mail-resend',

  // Limit how often jobs are processed (rate limiting)
  limiter: {
    max: 1,         // max 1 job
    duration: 20000  // every 3 seconds
  },

  // How many jobs can be processed at once (parallelism)
  concurrency: 1,

  // Retry settings
  retryDelay: 20000, // 3 sec between retries
  attempts: 3,      // max 3 retries
};