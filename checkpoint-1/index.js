import http from 'http';
import { URL } from 'url';

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

  if (queryParams.date) {
    const dateStr = queryParams.date.trim();
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
  } else if (queryParams.day || queryParams.month) {
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
 * Portability wrapper for standard HTTP handler (Vercel, Express, GCP Cloud Functions)
 */
export async function httpHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const queryParams = Object.fromEntries(reqUrl.searchParams.entries());

    const { day, month, source } = parseParams(queryParams);

    if (day === undefined || month === undefined || !isValidDate(day, month)) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'Invalid Date parameters. Please provide a valid day (1-31) and month (1-12) combination.',
        received: { day, month, source }
      }));
      return;
    }

    const nameResult = resolveNames(day, month);

    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      day,
      month,
      ...nameResult,
      resolvedAt: new Date().toISOString(),
      source
    }, null, 2));

  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }));
  }
}

/**
 * AWS Lambda specific handler
 */
export async function handler(event) {
  const queryParams = event.queryStringParameters || {};
  
  // Extract from body if POST
  let bodyParams = {};
  if (event.body) {
    try {
      bodyParams = JSON.parse(event.body);
    } catch (e) {
      // Ignore body parse errors, rely on query params
    }
  }

  const combinedParams = { ...queryParams, ...bodyParams };
  const { day, month, source } = parseParams(combinedParams);

  if (day === undefined || month === undefined || !isValidDate(day, month)) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Invalid Date parameters. Please provide a valid day (1-31) and month (1-12) combination.',
        received: { day, month, source }
      })
    };
  }

  const nameResult = resolveNames(day, month);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      day,
      month,
      ...nameResult,
      resolvedAt: new Date().toISOString(),
      source
    })
  };
}

// Start a local HTTP server if executed with '--server' or directly
if (process.argv.includes('--server') || import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3000;
  const server = http.createServer(httpHandler);
  server.listen(port, () => {
    console.log(`Serverless function simulator running at http://localhost:${port}/`);
    console.log(`Try accessing: http://localhost:${port}/?day=1&month=8`);
    console.log(`Or: http://localhost:${port}/?date=01/08`);
  });
}

// Default export for GCP / Vercel style serverless functions
export default httpHandler;
