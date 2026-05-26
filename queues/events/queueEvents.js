const { QueueEvents, Job } = require('bullmq');

const mailQueueConfig = require('./../config/email.config');
const { updateLogDescription, updateHistoryLogDescription } = require('../helper/logHelpers');
const { createFailedMail, excuteEmailReturnUrl } = require('../../controllers/log_history.controller');
const { connection, mailAlertQueue, mailActionQueue, mailQueue } = require('../config/queuesConfigartion');
const { createFailedAlertMail, excuteAlertEmailReturnUrl } = require('../../controllers/alert_history.controller');

let queueEvents, queueEventsAction, queueEventsAlert;

async function setupQueueEvents() {

  /* ================= ERROR HANDLER ================= */
  const onError = (err) => {
    console.error('[QueueEvents Error]', err.message);
    setTimeout(setupQueueEvents, 5000);
  };

  /* ================= MAIL QUEUE ================= */
  queueEvents = new QueueEvents(mailQueueConfig.name, { connection });
  queueEvents.on('error', onError);

  queueEvents.on('waiting', async ({ jobId }) => handleWaiting(jobId, mailQueue, updateLogDescription));
  queueEvents.on('active', async ({ jobId }) => handleActive(jobId, mailQueue, updateLogDescription));
  queueEvents.on('progress', async ({ jobId }) => handleProgress(jobId, mailQueue, updateLogDescription));
  queueEvents.on('completed', async ({ jobId, returnvalue }) =>
    handleCompleted(jobId, returnvalue, mailQueue, updateLogDescription)
  );
  queueEvents.on('failed', async ({ jobId, failedReason }) =>
    handleFailed(jobId, failedReason, mailQueue, updateLogDescription, true)
  );

  /* ================= ACTION MAIL QUEUE ================= */
  queueEventsAction = new QueueEvents(mailQueueConfig.name_action_mail, { connection });
  queueEventsAction.on('error', onError);

  queueEventsAction.on('waiting', async ({ jobId }) => handleWaiting(jobId, mailActionQueue, updateLogDescription));
  queueEventsAction.on('active', async ({ jobId }) => handleActive(jobId, mailActionQueue, updateLogDescription));
  queueEventsAction.on('progress', async ({ jobId }) => handleProgress(jobId, mailActionQueue, updateLogDescription));
  queueEventsAction.on('completed', async ({ jobId, returnvalue }) =>
    handleCompleted(jobId, returnvalue, mailActionQueue, updateLogDescription)
  );
  queueEventsAction.on('failed', async ({ jobId, failedReason }) =>
    handleFailed(jobId, failedReason, mailActionQueue, updateLogDescription, true)
  );

  /* ================= ALERT QUEUE ================= */
  queueEventsAlert = new QueueEvents(mailQueueConfig.name_alert_mail, { connection });
  queueEventsAlert.on('error', onError);

  queueEventsAlert.on('waiting', async ({ jobId }) => handleWaiting(jobId, mailAlertQueue, updateHistoryLogDescription));
  queueEventsAlert.on('active', async ({ jobId }) => handleActive(jobId, mailAlertQueue, updateHistoryLogDescription));
  queueEventsAlert.on('progress', async ({ jobId }) => handleProgress(jobId, mailAlertQueue, updateHistoryLogDescription));
  queueEventsAlert.on('completed', async ({ jobId, returnvalue }) =>
    handleCompleted(jobId, returnvalue, mailAlertQueue, updateHistoryLogDescription)
  );
  queueEventsAlert.on('failed', async ({ jobId, failedReason }) =>
    handleFailedAlert(jobId, failedReason, mailAlertQueue, updateHistoryLogDescription, true)
  );

  await Promise.all([
    queueEvents.waitUntilReady(),
    queueEventsAction.waitUntilReady(),
    queueEventsAlert.waitUntilReady()
  ]);

  console.log('All QueueEvents Ready');
}

/* ================= COMMON HANDLERS ================= */

async function handleWaiting(jobId, queue, logFn) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend } = job.data;
  await logFn({ queueId, action: logDataConnect.action, description: 'Job is waiting in queue' });
  await logFn({ queueId, action: logDataSend.action, description: 'Job is waiting in queue' });
}

async function handleActive(jobId, queue, logFn) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend } = job.data;
  await logFn({ queueId, action: logDataConnect.action, description: 'Job is being processed' });
  await logFn({ queueId, action: logDataSend.action, description: 'Job is being processed' });
}

async function handleProgress(jobId, queue, logFn) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend } = job.data;
  await logFn({ queueId, action: logDataConnect.action, description: 'Job is being progressed' });
  await logFn({ queueId, action: logDataSend.action, description: 'Job is being progressed' });
}

async function handleCompleted(jobId, returnvalue, queue, logFn) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend } = job.data;
  await logFn({ queueId, action: logDataConnect.action, description: logDataConnect.description });
  await logFn({ queueId, action: logDataSend.action, description: returnvalue });
}

async function handleFailed(jobId, failedReason, queue, logFn, allowMail) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend, infoData } = job.data;

  if (allowMail) {
    await createFailedMail({ mailInfo: job.data, failedReason });
    if (infoData?.disbleFlag === 'off') {
      await excuteEmailReturnUrl(infoData);
    }
  }

  await logFn({ queueId, action: logDataConnect.action, description: `Failed: ${failedReason}` });
  await logFn({ queueId, action: logDataSend.action, description: `Failed: ${failedReason}` });
}

async function handleFailedAlert(jobId, failedReason, queue, logFn, allowMail) {
  const job = await Job.fromId(queue, jobId);
  if (!job) return;

  const { queueId, logDataConnect, logDataSend, infoData } = job.data;

  if (allowMail) {
    await createFailedAlertMail({ mailInfo: job.data, failedReason });
    if (infoData?.disbleFlag === 'off') {
      await excuteAlertEmailReturnUrl(infoData);
    }
  }

  await logFn({ queueId, action: logDataConnect.action, description: `Failed: ${failedReason}` });
  await logFn({ queueId, action: logDataSend.action, description: `Failed: ${failedReason}` });
}

module.exports = setupQueueEvents;
