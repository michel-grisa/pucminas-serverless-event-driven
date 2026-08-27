import { PubSub } from '@google-cloud/pubsub';
import { fileURLToPath } from 'url';

// Mapping tables for names
export const DAYS_MAP = {
  1: 'diabolic', 2: 'celestial', 3: 'shadowy', 4: 'radiant', 5: 'ferocious',
  6: 'mystic', 7: 'venomous', 8: 'golden', 9: 'eternal', 10: 'chaotic',
  11: 'cosmic', 12: 'silent', 13: 'haunted', 14: 'ancient', 15: 'swift',
  16: 'iron', 17: 'frost', 18: 'stormy', 19: 'emerald', 20: 'blazing',
  21: 'obsidian', 22: 'spectral', 23: 'thunderous', 24: 'whispering', 25: 'lunar',
  26: 'solar', 27: 'wild', 28: 'grim', 29: 'phantom', 30: 'cursed',
  31: 'immortal'
};

export const MONTHS_MAP = {
  1: 'phoenix', 2: 'griffin', 3: 'unicorn', 4: 'basilisk', 5: 'chimera',
  6: 'gorgon', 7: 'kraken', 8: 'dragon', 9: 'wyvern', 10: 'werewolf',
  11: 'vampire', 12: 'valkyrie'
};

/**
 * Validates if a day and month combination is valid.
 * @param {number} day 
 * @param {number} month 
 * @returns {boolean}
 */
export function isValidDate(day, month) {
  if (isNaN(day) || isNaN(month)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Days per month validation (using a non-leap-year or general leap year threshold of 29 for February)
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;

  return true;
}

/**
 * Resolves the day and month numbers to the corresponding names.
 * @param {number} day 
 * @param {number} month 
 * @returns {{ dayName: string, monthName: string, combinedName: string }}
 */
export function resolveNames(day, month) {
  const dayName = DAYS_MAP[day];
  const monthName = MONTHS_MAP[month];
  return {
    dayName,
    monthName,
    combinedName: `${dayName} ${monthName}`
  };
}

/**
 * Helper to parse parameters from diverse inputs.
 * Supports:
 * - Direct query params: day=XX, month=XX
 * - Combined date query param: date=DD/MM, date=DD-MM, date=YYYY-MM-DD
 * - If empty, uses current date
 */
export function parseParams(queryParams) {
  let day, month, source;

  if (queryParams && queryParams.date) {
    const dateStr = String(queryParams.date).trim();
    source = `date parameter (${dateStr})`;

    // Match DD/MM or DD-MM format (e.g. 01/08 or 01-08)
    const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
    } else {
      // Try parsing standard Date string
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        day = parsedDate.getDate();
        month = parsedDate.getMonth() + 1;
      }
    }
  } else if (queryParams && (queryParams.day || queryParams.month)) {
    day = queryParams.day ? parseInt(queryParams.day, 10) : undefined;
    month = queryParams.month ? parseInt(queryParams.month, 10) : undefined;
    source = 'explicit query parameters';
  }

  // Fallback to today's date if no date could be resolved
  if (day === undefined && month === undefined) {
    const today = new Date();
    day = today.getDate();
    month = today.getMonth() + 1;
    source = 'default (current date)';
  }

  return { day, month, source };
}

/**
 * Listens for incoming messages from Google Cloud Pub/Sub
 */
export function listenForMessages() {
  const pubSubClient = new PubSub();
  const subscriptionName = process.env.INPUT_SUBSCRIPTION || 'my-sub';
  const subscription = pubSubClient.subscription(subscriptionName);

  const messageHandler = async (message) => {
    console.log(`\n[Worker] Received message ID: ${message.id}`);
    try {
      const rawData = message.data.toString();
      console.log(`[Worker] Raw Data: ${rawData}`);

      let parsedData;
      try {
        parsedData = JSON.parse(rawData);
      } catch (e) {
        // Fallback if data is not JSON (try to parse directly as a date string)
        parsedData = { date: rawData };
      }

      const { day, month, source } = parseParams(parsedData);

      if (day === undefined || month === undefined || !isValidDate(day, month)) {
        console.error(`[Worker] Error: Invalid Date parameters`, { day, month, source });
      } else {
        const nameResult = resolveNames(day, month);
        console.log(`[Worker] Name Resolved: "${nameResult.combinedName.toUpperCase()}" (Day: ${day}, Month: ${month})`);
        console.log(`[Worker] Source: ${source}`);
      }
    } catch (err) {
      console.error(`[Worker] Unexpected processing error: ${err.message}`);
    }

    // Acknowledge the message so it's not redelivered
    message.ack();
  };

  const errorHandler = (error) => {
    console.error(`[Worker] Pub/Sub connection error: ${error.message}`);
  };

  subscription.on('message', messageHandler);
  subscription.on('error', errorHandler);

  console.log(`[Worker] Active and listening for messages on subscription: "${subscriptionName}"`);
}

// Start the listener if executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  listenForMessages();
}
