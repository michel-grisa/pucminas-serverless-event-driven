import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/movie';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

function normalizeMovieTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
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
    throw new Error(`TMDB API call failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const movie = payload.results?.[0];

  if (!movie) {
    return {
      available: false,
      error: `No movie named "${movieTitle}" was found in TMDB.`
    };
  }

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
  const apiKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
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
    throw new Error(`OMDb API call failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();

  if (payload.Response === 'False') {
    return {
      available: false,
      error: payload.Error || `No movie named "${movieTitle}" was found in OMDb.`
    };
  }

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

export async function invokeGcpWorkflow(movieTitle) {
  const workflowEndpoint = process.env.WORKFLOW_ENDPOINT;

  if (!workflowEndpoint) {
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
      return {
        source: 'gcp-workflow',
        executionName,
        success: true,
        ...result
      };
    }

    if (pollPayload.state === 'FAILED' || pollPayload.state === 'CANCELLED') {
      throw new Error(pollPayload.error?.message || 'Workflow execution failed.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

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

  const [tmdbResult, omdbResult] = await Promise.all([
    getTmdbRating(sanitizedTitle),
    getOmdbRating(sanitizedTitle)
  ]);

  return {
    success: true,
    movieTitle: sanitizedTitle,
    tmdb: tmdbResult,
    omdb: omdbResult,
    source: 'direct-api'
  };
}

export async function httpHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
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
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({
      success: false,
      error: error.message,
      source: 'server'
    }, null, 2));
  }
}

export async function handler(event) {
  const queryParams = event?.queryStringParameters || {};
  const bodyParams = event?.body ? JSON.parse(event.body) : {};
  const movieTitle = normalizeMovieTitle(
    queryParams.movie || queryParams.title || queryParams.name || bodyParams.movie || bodyParams.title || bodyParams.name || ''
  );

  const result = await buildMovieRatingsResponse(movieTitle);

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
    console.log(`Movie ratings server running at http://localhost:${port}`);
    console.log('Example: http://localhost:3000/?movie=Inception');
  });
}

export default httpHandler;
