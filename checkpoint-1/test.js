import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, resolveNames, parseParams, DAYS_MAP, MONTHS_MAP } from './index.js';

test('Date validation works correctly', () => {
  // Valid cases
  assert.equal(isValidDate(1, 8), true, '01/08 should be valid');
  assert.equal(isValidDate(31, 12), true, '31/12 should be valid');
  assert.equal(isValidDate(29, 2), true, '29/02 should be allowed as a leap year limit');

  // Invalid cases
  assert.equal(isValidDate(32, 8), false, 'Day > 31 should be invalid');
  assert.equal(isValidDate(0, 8), false, 'Day < 1 should be invalid');
  assert.equal(isValidDate(15, 13), false, 'Month > 12 should be invalid');
  assert.equal(isValidDate(15, 0), false, 'Month < 1 should be invalid');
  assert.equal(isValidDate(31, 4), false, 'April has only 30 days');
  assert.equal(isValidDate(30, 2), false, 'February cannot have 30 days');
  assert.equal(isValidDate(NaN, 8), false, 'NaN day is invalid');
});

test('Name resolution works correctly', () => {
  const result = resolveNames(1, 8);
  assert.equal(result.dayName, 'diabolic', 'Day 1 should map to diabolic');
  assert.equal(result.monthName, 'dragon', 'Month 8 should map to dragon');
  assert.equal(result.combinedName, 'diabolic dragon', 'Combined name should be correct');
});

test('Parameter parsing works with individual day and month', () => {
  const result = parseParams({ day: '1', month: '8' });
  assert.equal(result.day, 1);
  assert.equal(result.month, 8);
  assert.equal(result.source, 'explicit query parameters');
});

test('Parameter parsing works with combined date formats', () => {
  // DD/MM format
  const resultSlash = parseParams({ date: '01/08' });
  assert.equal(resultSlash.day, 1);
  assert.equal(resultSlash.month, 8);

  // DD-MM format
  const resultDash = parseParams({ date: '15-12' });
  assert.equal(resultDash.day, 15);
  assert.equal(resultDash.month, 12);

  // DD/MM/YYYY format
  const resultYear = parseParams({ date: '31/10/2026' });
  assert.equal(resultYear.day, 31);
  assert.equal(resultYear.month, 10);
});

test('Parameter parsing falls back to current date if empty', () => {
  const result = parseParams({});
  const now = new Date();
  assert.equal(result.day, now.getDate());
  assert.equal(result.month, now.getMonth() + 1);
  assert.equal(result.source, 'default (current date)');
});
