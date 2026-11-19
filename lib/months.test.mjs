import test from 'node:test';
import assert from 'node:assert/strict';

import { MONTHS, MONTHS_SHORT, getMonthIndex, getMonthPeriodIndex } from './months.ts';

test('lists twelve months in order', () => {
  assert.equal(MONTHS.length, 12);
  assert.equal(MONTHS_SHORT.length, 12);
  assert.equal(MONTHS[0], 'Januari');
  assert.equal(MONTHS[11], 'Desember');
  assert.equal(MONTHS_SHORT[0], 'Jan');
  assert.equal(MONTHS_SHORT[11], 'Des');
});

test('resolves month indexes and rejects unknown names', () => {
  assert.equal(getMonthIndex('Januari'), 0);
  assert.equal(getMonthIndex('Desember'), 11);
  assert.equal(getMonthIndex('Jan'), -1);
});

test('builds consecutive period indexes', () => {
  assert.equal(getMonthPeriodIndex('Desember', 2025) + 1, getMonthPeriodIndex('Januari', 2026));
  assert.equal(getMonthPeriodIndex('Januari', 2026), 2026 * 12);
});
