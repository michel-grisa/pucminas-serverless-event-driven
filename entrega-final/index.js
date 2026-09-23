import http from 'http';
import { URL } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/movie';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';
const SERVICE_NAME = 'movie-ratings-function';

function logEvent(severity, event, fields = {}) {
  console.log(JSON.stringify({
    severity,
    message: event,
    event,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    ...fields
  }));
}

function elapsedMilliseconds(startTime) {
  return Number(process.hrtime.bigint() - startTime) / 1e6;
}

function getRequestId(req) {
  return req.headers['x-request-id'] || req.headers['x-cloud-trace-context']?.split('/')[0] || randomUUID();
}

function normalizeMovieTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildGeminiPrompt(movieTitle) {
  return [
    'Você é um cinéfilo que assiste a todos os tipos de filme e é capaz de entender os mais variados tipos de gostos de filmes.',
    `Baseado no título "${movieTitle}", indique outros 3 filmes com uma breve descrição em um parágrafo explicando por que cada um deve agradar quem está interessado no título buscado.`,
    'Seja responsável na sugestão, não use termos ofensivos e não sugira filmes impróprios para menores ou que contenham conteúdo claramente racista, misógino, homofóbico ou que enalteça qualquer outro tipo de preconceito de forma descarada.',
    'Não confunda com críticas excessivas que possam envolver esses temas; o que é aceitável.',
    'Responda em português e devolva apenas um JSON válido no formato {"recommendations":[{"title":"...","description":"..."},{"title":"...","description":"..."},{"title":"...","description":"..."}]}.'
  ].join('\n');
}

export function parseGeminiRecommendations(payload) {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  const rawText = parts.map((part) => part?.text ?? '').join('\n').trim();

  if (!rawText) {
    return [];
  }

  const cleanedText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed?.recommendations)) {
      return parsed.recommendations;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    const fallbackMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (fallbackMatch) {
      try {
        const parsed = JSON.parse(fallbackMatch[0]);
        if (Array.isArray(parsed?.recommendations)) {
          return parsed.recommendations;
        }
      } catch {
        return [];
      }
    }
  }

  return [];
}

function isWorkflowEnabled() {
  return String(process.env.USE_GCP_WORKFLOW || '').toLowerCase() === 'true';
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function parseMovieTitle(req, rawUrl) {
  const reqUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
  const queryParams = Object.fromEntries(reqUrl.searchParams.entries());

  return normalizeMovieTitle(
    queryParams.movie ||
    queryParams.title ||
    queryParams.name ||
    ''
  );
}

export async function getTmdbRating(movieTitle) {
  const startTime = process.hrtime.bigint();
  logEvent('INFO', 'external_api.started', { provider: 'tmdb' });
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    logEvent('WARNING', 'external_api.skipped', { provider: 'tmdb', reason: 'missing_api_key' });
    return {
      available: false,
      error: 'TMDB_API_KEY is not configured. Add it to the .env file.'
    };
  }

  const url = new URL(TMDB_BASE_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', movieTitle);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', '1');

  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    logEvent('ERROR', 'external_api.failed', {
      provider: 'tmdb',
      status_code: response.status,
      duration_ms: elapsedMilliseconds(startTime)
    });
    throw new Error(`TMDB API call failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const movie = payload.results?.[0];

  if (!movie) {
    logEvent('INFO', 'external_api.completed', {
      provider: 'tmdb',
      available: false,
      duration_ms: elapsedMilliseconds(startTime)
    });
    return {
      available: false,
      error: `No movie named "${movieTitle}" was found in TMDB.`
    };
  }

  logEvent('INFO', 'external_api.completed', {
    provider: 'tmdb',
    available: true,
    duration_ms: elapsedMilliseconds(startTime)
  });

  return {
    available: true,
    title: movie.title,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    overview: movie.overview,
    releaseDate: movie.release_date,
    originalTitle: movie.original_title
  };
}

export async function getOmdbRating(movieTitle) {
  const startTime = process.hrtime.bigint();
  logEvent('INFO', 'external_api.started', { provider: 'omdb' });
  const apiKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
    logEvent('WARNING', 'external_api.skipped', { provider: 'omdb', reason: 'missing_api_key' });
    return {
      available: false,
      error: 'OMDB_API_KEY is not configured. Add it to the .env file.'
    };
  }

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('t', movieTitle);

  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    logEvent('ERROR', 'external_api.failed', {
      provider: 'omdb',
      status_code: response.status,
      duration_ms: elapsedMilliseconds(startTime)
    });
    throw new Error(`OMDb API call failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();

  if (payload.Response === 'False') {
    logEvent('INFO', 'external_api.completed', {
      provider: 'omdb',
      available: false,
      duration_ms: elapsedMilliseconds(startTime)
    });
    return {
      available: false,
      error: payload.Error || `No movie named "${movieTitle}" was found in OMDb.`
    };
  }

  logEvent('INFO', 'external_api.completed', {
    provider: 'omdb',
    available: true,
    duration_ms: elapsedMilliseconds(startTime)
  });

  return {
    available: true,
    title: payload.Title,
    year: payload.Year,
    genre: payload.Genre,
    imdbRating: payload.imdbRating,
    imdbVotes: payload.imdbVotes,
    plot: payload.Plot
  };
}

export async function getGeminiRecommendations(movieTitle) {
  const startTime = process.hrtime.bigint();
  logEvent('INFO', 'external_api.started', { provider: 'gemini' });

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

  if (!apiKey) {
    logEvent('WARNING', 'external_api.skipped', { provider: 'gemini', reason: 'missing_api_key' });
    return {
      available: false,
      error: 'GEMINI_API_KEY is not configured. Add it to the .env file.'
    };
  }

  const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`);
  endpoint.searchParams.set('key', apiKey);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: buildGeminiPrompt(movieTitle) }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 300
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    logEvent('ERROR', 'external_api.failed', {
      provider: 'gemini',
      status_code: response.status,
      duration_ms: elapsedMilliseconds(startTime)
    });
    throw new Error(`Gemini API call failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const recommendations = parseGeminiRecommendations(payload);

  if (!recommendations.length) {
    logEvent('INFO', 'external_api.completed', {
      provider: 'gemini',
      available: false,
      duration_ms: elapsedMilliseconds(startTime)
    });
    return {
      available: false,
      error: 'Gemini did not return valid recommendations for the requested title.'
    };
  }

  logEvent('INFO', 'external_api.completed', {
    provider: 'gemini',
    available: true,
    duration_ms: elapsedMilliseconds(startTime)
  });

  return {
    available: true,
    model: modelName,
    recommendations
  };
}

export async function invokeGcpWorkflow(movieTitle) {
  const startTime = process.hrtime.bigint();
  logEvent('INFO', 'workflow.started');
  const workflowEndpoint = process.env.WORKFLOW_ENDPOINT;

  if (!workflowEndpoint) {
    logEvent('ERROR', 'workflow.failed', { reason: 'missing_endpoint' });
    throw new Error('WORKFLOW_ENDPOINT is not configured. Set it in the .env file to use GCP Workflows.');
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const executionUrl = workflowEndpoint;
  const executionResponse = await fetch(executionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      argument: JSON.stringify({ movieTitle })
    })
  });

  const executionPayload = await executionResponse.json();

  if (!executionResponse.ok) {
    const errorMessage = executionPayload?.error?.message || 'Unknown workflow error';
    logEvent('ERROR', 'workflow.failed', {
      status_code: executionResponse.status,
      duration_ms: elapsedMilliseconds(startTime)
    });
    throw new Error(`GCP Workflow invocation failed: ${errorMessage}`);
  }

  const executionName = executionPayload.name;
  const executionFetchUrl = `https://workflowexecutions.googleapis.com/v1/${executionName}`;

  for (let i = 0; i < 20; i += 1) {
    const pollResponse = await fetch(executionFetchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken.token}`
      }
    });

    if (!pollResponse.ok) {
      throw new Error(`Unable to poll workflow execution (${pollResponse.status})`);
    }

    const pollPayload = await pollResponse.json();

    if (pollPayload.state === 'SUCCEEDED') {
      const result = pollPayload.result ? JSON.parse(pollPayload.result) : {};
      logEvent('INFO', 'workflow.completed', {
        state: pollPayload.state,
        polls: i + 1,
        duration_ms: elapsedMilliseconds(startTime)
      });
      return {
        source: 'gcp-workflow',
        executionName,
        success: true,
        ...result
      };
    }

    if (pollPayload.state === 'FAILED' || pollPayload.state === 'CANCELLED') {
      const workflowError = pollPayload.error || {};
      const errorMessage = workflowError.message || workflowError.tags || JSON.stringify(workflowError) || 'Workflow execution failed.';
      logEvent('ERROR', 'workflow.failed', {
        state: pollPayload.state,
        polls: i + 1,
        workflow_error: errorMessage,
        duration_ms: elapsedMilliseconds(startTime)
      });
      throw new Error(`Workflow execution ${pollPayload.state.toLowerCase()}: ${errorMessage}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  logEvent('ERROR', 'workflow.failed', {
    reason: 'timeout',
    duration_ms: elapsedMilliseconds(startTime)
  });
  throw new Error('Workflow execution timed out.');
}

export async function buildMovieRatingsResponse(movieTitle) {
  const sanitizedTitle = normalizeMovieTitle(movieTitle);

  if (!sanitizedTitle) {
    return {
      success: false,
      error: 'movie title is required. Use ?movie=Inception or POST a JSON body with {"movie": "Inception"}.'
    };
  }

  if (isWorkflowEnabled()) {
    return invokeGcpWorkflow(sanitizedTitle);
  }

  return {
    success: false,
    error: 'GCP Workflow is not enabled. Set USE_GCP_WORKFLOW=true in the .env file to enable it.'
  };
}

export async function httpHandler(req, res) {
  const requestId = getRequestId(req);
  const startTime = process.hrtime.bigint();
  logEvent('INFO', 'request.started', { request_id: requestId, method: req.method });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    logEvent('INFO', 'request.completed', {
      request_id: requestId,
      method: req.method,
      status_code: 204,
      duration_ms: elapsedMilliseconds(startTime)
    });
    return;
  }

  try {
    let movieTitle = parseMovieTitle(req, req.url || '/');

    if (!movieTitle && (req.method === 'POST' || req.method === 'PUT')) {
      const body = await readRequestBody(req);
      if (body) {
        try {
          const payload = JSON.parse(body);
          movieTitle = normalizeMovieTitle(payload.movie || payload.title || payload.name || '');
        } catch {
          movieTitle = '';
        }
      }
    }

    const result = await buildMovieRatingsResponse(movieTitle);

    if (!result.success && result.error) {
      res.writeHead(400);
      res.end(JSON.stringify(result, null, 2));
      logEvent('WARNING', 'request.completed', {
        request_id: requestId,
        method: req.method,
        status_code: 400,
        duration_ms: elapsedMilliseconds(startTime)
      });
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
    logEvent('INFO', 'request.completed', {
      request_id: requestId,
      method: req.method,
      status_code: 200,
      source: result.source,
      duration_ms: elapsedMilliseconds(startTime)
    });
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({
      success: false,
      error: error.message,
      source: 'server'
    }, null, 2));
    logEvent('ERROR', 'request.failed', {
      request_id: requestId,
      method: req.method,
      status_code: 500,
      error_type: error.name,
      duration_ms: elapsedMilliseconds(startTime)
    });
  }
}

export async function handler(event) {
  const startTime = process.hrtime.bigint();
  const queryParams = event?.queryStringParameters || {};
  const bodyParams = event?.body ? JSON.parse(event.body) : {};
  const movieTitle = normalizeMovieTitle(
    queryParams.movie || queryParams.title || queryParams.name || bodyParams.movie || bodyParams.title || bodyParams.name || ''
  );

  const result = await buildMovieRatingsResponse(movieTitle);
  logEvent(result.success ? 'INFO' : 'WARNING', 'request.completed', {
    request_id: event?.requestContext?.requestId || randomUUID(),
    status_code: result.success ? 200 : 400,
    source: result.source,
    duration_ms: elapsedMilliseconds(startTime)
  });

  return {
    statusCode: result.success ? 200 : 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(result, null, 2)
  };
}

if (process.argv.includes('--server') || import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(httpHandler);
  server.listen(port, () => {
    logEvent('INFO', 'server.started', { port });
  });
}

export default httpHandler;
