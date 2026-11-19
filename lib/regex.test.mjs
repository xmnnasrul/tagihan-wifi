import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeRegex } from './regex.ts';

test('escapes every regex metacharacter', () => {
  const raw = 'a.*b(c)[d]{e}+f|g?h^i$j\\k';
  const matcher = new RegExp(`^${escapeRegex(raw)}$`);

  assert.equal(matcher.test(raw), true);
  assert.equal(matcher.test('aXXb'), false);
});

test('leaves plain text unchanged', () => {
  assert.equal(escapeRegex('Budi Santoso'), 'Budi Santoso');
  assert.equal(escapeRegex('Jl. Merdeka No. 10'), 'Jl\\. Merdeka No\\. 10');
});
