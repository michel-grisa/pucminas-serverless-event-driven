import { PubSub } from '@google-cloud/pubsub';

const pubSubClient = new PubSub();

export function listenForMessages(subscriptionNameOrId, timeout = 60) {
  // References an existing subscription; if you are unsure if the
  // subscription will exist, try the optimisticSubscribe sample.
  const subscription = pubSubClient.subscription(subscriptionNameOrId);

  // Create an event handler to handle messages
  let messageCount = 0;
  const messageHandler = message => {
    console.log(`[read-message] Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);
    console.log(`\tAttributes: ${JSON.stringify(message.attributes)}`);
    messageCount += 1;

    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  console.log(`[read-message] Listening for messages on "${subscriptionNameOrId}" for ${timeout}s...`);

  // Wait a while for the subscription to run. (Part of the sample only.)
  setTimeout(() => {
    subscription.removeListener('message', messageHandler);
    console.log(`[read-message] Stopped listening. ${messageCount} message(s) received.`);
  }, timeout * 1000);
}

// Execution if run directly
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const subscriptionNameOrId = process.env.INPUT_SUBSCRIPTION || 'my-sub';
  listenForMessages(subscriptionNameOrId);
}
