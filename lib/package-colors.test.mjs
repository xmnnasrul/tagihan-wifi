import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKAGE_COLOR_IDS,
  getPackageColorClasses,
  getPackageColorLabel,
  getPackageColorTextClass,
  isPackageColor,
} from './package-colors.mjs';

test('accepts only the preset package colors', () => {
  for (const color of PACKAGE_COLOR_IDS) {
    assert.equal(isPackageColor(color), true);
  }
  assert.equal(isPackageColor('cyan'), false);
  assert.equal(isPackageColor(''), false);
  assert.equal(isPackageColor(null), false);
});

test('returns a neutral pill for missing or unknown colors', () => {
  assert.match(getPackageColorClasses(undefined), /text-muted-foreground/);
  assert.match(getPackageColorClasses('not-a-color'), /text-muted-foreground/);
  assert.equal(getPackageColorLabel(undefined), 'Netral');
});

test('returns the themed pill and label for a valid color', () => {
  assert.match(getPackageColorClasses('blue'), /bg-sky-50/);
  assert.match(getPackageColorClasses('blue'), /dark:bg-sky-950\/40/);
  assert.equal(getPackageColorLabel('blue'), 'Biru');
});

test('returns a readable text-only class for a valid color', () => {
  assert.match(getPackageColorTextClass('blue'), /text-sky-700/);
  assert.match(getPackageColorTextClass('blue'), /dark:text-sky-300/);
  assert.match(getPackageColorTextClass(undefined), /text-muted-foreground/);
});
