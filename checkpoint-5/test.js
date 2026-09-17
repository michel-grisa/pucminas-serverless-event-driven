import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMovieTitle } from './index.js';

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
