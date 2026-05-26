const { Queue } = require('bullmq');
const Redis = require('ioredis');
const mailQueueConfig = require('./email.config');
const logQueueConfig = require('./log.config');
const Config = require('../../config');

// Build Redis options dynamically
const redisOptions = {
  host: Config.ioRedisHost || 'localhost', // Fallback to localhost
  port: Config.ioRedisPort || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 10000, // 10s timeout

  retryStrategy: (times) => {
    if (times >= 10) return null; // stop retrying after 10 attempts
    return Math.min(times * 2000, 10000); // wait 2s, 4s, up to max 10s
  },
};

// Only add password if it's provided
if (Config.ioRedisPass) {
  redisOptions.password = Config.ioRedisPass;
}

const connection = new Redis(redisOptions);

connection.on('connect', () => console.log('Redis connected!'));
connection.on('error', (err) => console.error('Redis error:', err));

const mailQueue = new Queue(mailQueueConfig.name, { connection });
const mailActionQueue = new Queue(mailQueueConfig.name_action_mail, { connection });
const mailAlertQueue = new Queue(mailQueueConfig.name_alert_mail, { connection })
const failuresmailQueue = new Queue(mailQueueConfig.resend_name, { connection });
const logQueueCon = new Queue(logQueueConfig.name_save, { connection });
const batchQueueCon = new Queue(`${logQueueConfig.name_complate}`, { connection });
const logUpdateQueue = new Queue(mailQueueConfig.name_mail_log_update, { connection });

const logAlertQueueCon = new Queue(logQueueConfig.name_alert_save, { connection });
const batchAlertQueueCon = new Queue(`${logQueueConfig.name_alert_complate}`, { connection });
const logHistoryUpdateQueue = new Queue(mailQueueConfig.name_mail_history_log_update, { connection });

const logDiffQueueCon = new Queue(logQueueConfig.name_diff_save, { connection });
const batchDiffQueueCon = new Queue(`${logQueueConfig.name_diff_complate}`, { connection });

module.exports = {
  mailQueue,
  mailActionQueue,
  mailAlertQueue,
  failuresmailQueue,
  logQueueCon,
  connection,
  logUpdateQueue,
  batchQueueCon,
  logAlertQueueCon,
  batchAlertQueueCon,
  logHistoryUpdateQueue,
  logDiffQueueCon,
  batchDiffQueueCon
};
