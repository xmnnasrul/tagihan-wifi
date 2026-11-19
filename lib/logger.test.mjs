import test from 'node:test';
import assert from 'node:assert/strict';

import { logError, setErrorSink } from './logger.ts';

function captureConsoleError(run) {
  const original = console.error;
  const output = [];
  console.error = (...args) => output.push(args);
  try {
    run();
  } finally {
    console.error = original;
  }
  return output;
}

test('forwards errors to the monitoring sink and console', () => {
  const entries = [];
  const output = captureConsoleError(() => {
    setErrorSink((entry) => entries.push(entry));
    try {
      logError('POST /api/example failed:', new Error('boom'));
    } finally {
      setErrorSink(null);
    }
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, 'error');
  assert.equal(entries[0].message, 'POST /api/example failed:');
  assert.equal(entries[0].error.message, 'boom');
  assert.match(entries[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(output.length, 1);
});

test('a failing sink never breaks the caller', () => {
  const output = captureConsoleError(() => {
    setErrorSink(() => {
      throw new Error('sink down');
    });
    try {
      assert.doesNotThrow(() => logError('GET /api/example failed:', new Error('real')));
    } finally {
      setErrorSink(null);
    }
  });

  assert.equal(output.length, 1);
});
