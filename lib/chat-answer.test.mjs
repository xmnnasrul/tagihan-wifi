import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatRequestBody,
  getChatAPIErrorMessage,
  getChatCompletionEndpoint,
  getChatModelsEndpoint,
  getChatModelIDs,
  getChatResponseContent,
  normalizeChatAIConfig,
  normalizeChatBaseURL,
  parseChatArrearsCustomers,
} from './chat-answer.ts';

const customers = [
  {
    customerName: 'Siti',
    totalOutstanding: 150000,
    address: 'Alamat tidak boleh diteruskan',
    outstandingPeriods: [
      { month: 'Mei', year: 2026, outstandingAmount: 150000, status: 'Belum Bayar' },
    ],
  },
];

test('normalizes trusted HTTPS provider URLs and permits HTTP only on localhost', () => {
  assert.equal(normalizeChatBaseURL('https://vikey.ai/v1/'), 'https://api.vikey.ai/v1');
  assert.equal(normalizeChatBaseURL('https://vikey.ai/v1'), 'https://api.vikey.ai/v1');
  assert.equal(normalizeChatBaseURL('http://localhost:3000/v1'), 'http://localhost:3000/v1');
  assert.equal(normalizeChatBaseURL('http://example.com/v1'), null);
  assert.equal(normalizeChatBaseURL('https://user:pass@example.com/v1'), null);
  assert.equal(normalizeChatBaseURL('https://example.com/v1?key=value'), null);
  assert.equal(getChatCompletionEndpoint('https://vikey.ai/v1'), 'https://api.vikey.ai/v1/chat/completions');
  assert.equal(getChatModelsEndpoint('https://api.vikey.ai/v1'), 'https://api.vikey.ai/v1/models');
});

test('rejects invalid or incomplete stored AI configuration', () => {
  assert.deepEqual(normalizeChatAIConfig({
    baseURL: 'https://vikey.ai/v1',
    apiKey: 'key-123',
    model: 'openai/gpt-6-luna',
  }), {
    baseURL: 'https://api.vikey.ai/v1',
    apiKey: 'key-123',
    model: 'openai/gpt-6-luna',
  });
  assert.equal(normalizeChatAIConfig({ baseURL: 'http://example.com', apiKey: 'x', model: 'test' }), null);
  assert.equal(normalizeChatAIConfig({ baseURL: 'https://vikey.ai', apiKey: '', model: 'test' }), null);
});

test('validates the protected chat context before using it as model input', () => {
  assert.deepEqual(parseChatArrearsCustomers(customers), [{
    customerName: 'Siti',
    totalOutstanding: 150000,
    outstandingPeriods: [
      { month: 'Mei', year: 2026, outstandingAmount: 150000, status: 'Belum Bayar' },
    ],
  }]);
  assert.equal(parseChatArrearsCustomers([{ customerName: 'Siti', outstandingPeriods: [] }]), null);
});

test('builds a factual prompt without forwarding address or unrelated customer fields', () => {
  const request = buildChatRequestBody('openai/gpt-6-luna', 'Apa tagihan Siti?', customers);
  const messages = request.messages;
  const context = messages[1].content;

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Maaf, data tersebut tidak ditemukan dalam catatan tagihan/);
  assert.match(context, /Siti/);
  assert.match(context, /150000/);
  assert.doesNotMatch(context, /Alamat tidak boleh diteruskan/);
  assert.equal(request.temperature, 0.0);
  assert.equal(request.model, 'openai/gpt-6-luna');
});

test('reports provider errors and redacts API keys from details', () => {
  assert.match(getChatAPIErrorMessage(401), /API Key ditolak/);
  assert.match(getChatAPIErrorMessage(429), /Kuota/);
  const error = getChatAPIErrorMessage(400, { error: { message: 'Invalid key-123 model' } }, 'key-123');
  assert.match(error, /Invalid \[API Key disamarkan\] model/);
  assert.doesNotMatch(error, /key-123/);
  assert.equal(getChatResponseContent({ choices: [{ message: { content: '  Jawaban faktual.  ' } }] }), 'Jawaban faktual.');
  assert.equal(getChatResponseContent({ choices: [] }), null);
});

test('extracts unique model IDs from an OpenAI-compatible catalogue response', () => {
  assert.deepEqual(getChatModelIDs({
    data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-a' }, { name: 'missing id' }],
  }), ['model-a', 'model-b']);
  assert.deepEqual(getChatModelIDs({ data: 'invalid' }), []);
});
