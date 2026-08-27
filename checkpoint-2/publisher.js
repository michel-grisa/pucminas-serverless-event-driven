import { PubSub } from '@google-cloud/pubsub';
import { parseParams } from './index.js';

/**
 * Publishes a message to Google Cloud Pub/Sub
 */
async function publishMessage(topicNameOrId, data) {
  const pubSubClient = new PubSub();
  const dataBuffer = Buffer.from(JSON.stringify(data));

  const topic = pubSubClient.topic(topicNameOrId);

  try {
    const messageId = await topic.publishMessage({ data: dataBuffer });
    console.log(`[Publisher] Message successfully published with ID: ${messageId}`);
  } catch (error) {
    console.error(`[Publisher] Received error while publishing: ${error.message}`);
    process.exitCode = 1;
  }
}

// Extract CLI arguments
const args = process.argv.slice(2);
const queryParams = {};

args.forEach(arg => {
  if (arg.startsWith('--date=')) {
    queryParams.date = arg.split('=')[1];
  } else if (arg.startsWith('--day=')) {
    queryParams.day = arg.split('=')[1];
  } else if (arg.startsWith('--month=')) {
    queryParams.month = arg.split('=')[1];
  }
});

// Resolve parameters (day, month) and source
const parsedParams = parseParams(queryParams);
const topicName = process.env.OUTPUT_TOPIC || 'my-topic';

console.log(`[Publisher] Preparing message for topic "${topicName}":`);
console.log(`[Publisher] Raw CLI Arguments:`, args);
console.log(`[Publisher] Resolved Data:`, parsedParams);

publishMessage(topicName, parsedParams);
