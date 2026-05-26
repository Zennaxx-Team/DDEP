const {
  logUpdateQueue,
  logHistoryUpdateQueue
} = require('../config/queuesConfigartion');

async function updateLogDescription({ queueId, action, description }) {
  await logUpdateQueue.add(
    'deferred-log-update',
    { queueId, action, description },
    {
      delay: 1000,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

async function updateHistoryLogDescription({ queueId, action, description }) {
  await logHistoryUpdateQueue.add(
    'deferred-log-update',
    { queueId, action, description },
    {
      delay: 1000,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

module.exports = {
  updateLogDescription,
  updateHistoryLogDescription
};
