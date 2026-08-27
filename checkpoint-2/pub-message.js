import { PubSub } from '@google-cloud/pubsub';

const pubSubClient = new PubSub();

export async function publishMessage(topicNameOrId, data) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

  // Cache topic objects (publishers) and reuse them.
  const topic = pubSubClient.topic(topicNameOrId);

  try {
    const messageId = await topic.publishMessage({ data: dataBuffer });
    console.log(`[pub-message] Message ${messageId} published.`);
    return messageId;
  } catch (error) {
    console.error(`[pub-message] Received error while publishing: ${error.message}`);
    process.exitCode = 1;
  }
}

// Execution if run directly
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const topicNameOrId = process.env.OUTPUT_TOPIC || 'my-topic';
  const data = JSON.stringify({ date: '19/08' });
  console.log(`[pub-message] Executing direct publish to topic "${topicNameOrId}"...`);
  publishMessage(topicNameOrId, data);
}
