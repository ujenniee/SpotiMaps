const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getGenreColor } = require('../src/theme.ts');

test('genre colors include red Rap while preserving existing genre colors', () => {
  assert.equal(getGenreColor('Rap'), '#E53935');
  assert.equal(getGenreColor('Hip Hop'), '#4CAF6A');
  assert.equal(getGenreColor('R&B'), '#6C63E0');
  assert.equal(getGenreColor('Jazz'), '#4A90E2');
  assert.equal(getGenreColor(null), '#8E8E8E');
});
