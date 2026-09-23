import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMovieTitle, buildGeminiPrompt, parseGeminiRecommendations } from './index.js';

function createRequest() {
  return {
    headers: {
      host: 'localhost'
    }
  };
}

test('parseMovieTitle reads the movie query parameter', () => {
  const title = parseMovieTitle(createRequest(), '/?movie=Inception');

  assert.equal(title, 'Inception');
});

test('parseMovieTitle accepts title as an alternative parameter', () => {
  const title = parseMovieTitle(createRequest(), '/?title=The%20Matrix');

  assert.equal(title, 'The Matrix');
});

test('parseMovieTitle trims surrounding whitespace', () => {
  const title = parseMovieTitle(createRequest(), '/?name=%20Arrival%20');

  assert.equal(title, 'Arrival');
});

test('buildGeminiPrompt requests three responsible movie recommendations in Portuguese', () => {
  const prompt = buildGeminiPrompt('Inception');

  assert.match(prompt, /Inception/i);
  assert.match(prompt, /3/);
  assert.match(prompt, /cinéfilo|cinefilo/i);
  assert.match(prompt, /responsável|responsavel/i);
  assert.match(prompt, /português|portugues/i);
});

test('parseGeminiRecommendations extracts the recommendation list from Gemini JSON', () => {
  const recommendations = parseGeminiRecommendations({
    candidates: [{
      content: {
        parts: [{
          text: '```json\n{"recommendations":[{"title":"Arrival","description":"Uma viagem emocional..."},{"title":"Blade Runner 2049","description":"Um filme de ficção..."},{"title":"The Prestige","description":"Um thriller inteligente..."}]}\n```'
        }]
      }
    }]
  });

  assert.deepEqual(recommendations.length, 3);
  assert.deepEqual(recommendations[0].title, 'Arrival');
  assert.match(recommendations[1].description, /ficção|ficcao/i);
});
