import test from 'node:test';
import assert from 'node:assert/strict';
import { isPositiveAmount, isValidOptionalPhoneNumber } from './form-validation.ts';

test('validates optional phone numbers in common Indonesian formats', () => {
  assert.equal(isValidOptionalPhoneNumber(''), true);
  assert.equal(isValidOptionalPhoneNumber('081234567890'), true);
  assert.equal(isValidOptionalPhoneNumber('+62 812-3456-7890'), true);
  assert.equal(isValidOptionalPhoneNumber('123'), false);
  assert.equal(isValidOptionalPhoneNumber('phone-number'), false);
});

test('accepts only positive finite payment and package amounts', () => {
  assert.equal(isPositiveAmount('150000'), true);
  assert.equal(isPositiveAmount(0), false);
  assert.equal(isPositiveAmount('-1'), false);
  assert.equal(isPositiveAmount('NaN'), false);
});
