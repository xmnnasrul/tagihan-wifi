import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatRequestBody,
  getChatCustomerAddressQualifierTerms,
  getChatContextTopics,
  getChatAPIErrorMessage,
  getChatCompletionEndpoint,
  getChatModelsEndpoint,
  getChatModelIDs,
  getChatResponseContent,
  matchesChatCustomerNameQuery,
  matchesChatCustomerAddressQuery,
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
  const request = buildChatRequestBody('openai/gpt-6-luna', 'Apa tagihan Siti?', [{
    customerName: 'Siti',
    totalOutstanding: 150000,
    outstandingPeriods: [{ month: 'Mei', year: 2026, outstandingAmount: 150000, status: 'Belum Bayar' }],
  }]);
  const messages = request.messages;
  const context = messages[1].content;

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Nama Anda Rexxa, AI dengan persona perempuan dewasa Gen Z/);
  assert.match(messages[0].content, /centil dan genit yang lebih terasa/);
  assert.match(messages[0].content, /godaan playful, pujian manis/);
  assert.match(messages[0].content, /Tetap non-eksplisit/);
  assert.match(messages[0].content, /hindari rayuan atau lelucon yang meremehkan masalah/);
  assert.match(messages[0].content, /matchedByAddress.*tampilkan alamat hanya jika tercantum di DATA/);
  assert.match(messages[0].content, /blok berpoin dengan label Nama, Status, Alamat, dan Paket/);
  assert.match(messages[0].content, /Tanggapi obrolan umum/);
  assert.match(messages[0].content, /hanya berdasarkan DATA yang diberikan/);
  assert.match(messages[0].content, /Jangan mengaku telah menambah, mengubah, atau menghapus data/);
  assert.match(messages[0].content, /Jika data yang diperlukan tidak tersedia/);
  assert.match(context, /Siti/);
  assert.match(context, /150000/);
  assert.doesNotMatch(context, /Alamat tidak boleh diteruskan/);
  assert.equal(request.temperature, 0.0);
  assert.equal(request.max_tokens, 512);
  assert.equal(request.model, 'openai/gpt-6-luna');
  for (const key of ['tools', 'tool_choice', 'functions', 'function_call']) {
    assert.equal(Object.hasOwn(request, key), false, `AI request must not include ${key}`);
  }
});

test('selects only the relevant website data topics and avoids loading data for help or general chat', () => {
  assert.deepEqual(getChatContextTopics('Halo, apa kabar?'), []);
  assert.deepEqual(getChatContextTopics('Bagaimana cara menambah pelanggan?'), []);
  assert.deepEqual(getChatContextTopics('Cari pelanggan Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Carikan data Siti Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Cariin data Rina Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tolong cek data Siti Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tolong cek info Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Berapa tagihan dan pembayaran Siti?'), ['billing', 'reports']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum membayar tagihannya?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Siapa yang masih nyicil?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Siapa yang masih punya utang?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Bagaimana status pembayaran Siti?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Berapa uang masuk bulan ini?'), ['reports']);
  assert.deepEqual(getChatContextTopics('Berapa uang yang sudah masuk bulan ini?'), ['reports']);
  assert.deepEqual(getChatContextTopics('Cari pelanggan Siti di arsip'), ['customers', 'archive']);
  assert.deepEqual(getChatContextTopics('Cari pelanggan yang sudah stop langganan'), ['customers', 'archive']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum dikunjungi kolektor?'), ['collection']);
  assert.deepEqual(getChatContextTopics('Siapa yang harus nagih pelanggan ini?'), ['customers', 'collection']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum didatangi?'), ['collection']);
  assert.deepEqual(getChatContextTopics('Data pelanggan yang tidak aktif'), ['customers', 'archive']);
});

test('uses an extra name-search term to filter by address without exposing the address', () => {
  assert.deepEqual(getChatCustomerAddressQualifierTerms('Carikan data Siti Brajan', 'Siti'), ['brajan']);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti Brajan', 'Siti', 'Jl. Brajan'), true);
  assert.equal(matchesChatCustomerAddressQuery('Cariin data Rina Brajan', 'Rina', 'Jl. Brajan'), true);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti Brajan', 'Siti', 'Jl. Cempaka'), false);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti', 'Siti', 'Jl. Brajan'), false);
  assert.equal(matchesChatCustomerNameQuery('Cariin data Rina Brajan', 'Rina Amelia'), true);
  assert.equal(matchesChatCustomerNameQuery('Cariin data Rina Brajan', 'Dina Amelia'), false);
});

test('builds a low-context request for general chat and includes context only when supplied', () => {
  const generalRequest = buildChatRequestBody('model-a', 'Halo, apa kabar?', null);
  assert.equal(generalRequest.messages[1].content, 'Pertanyaan admin:\nHalo, apa kabar?');
  assert.doesNotMatch(JSON.stringify(generalRequest.messages), /Siti|Budi Santoso|Catatan tunggakan/);

  const contextRequest = buildChatRequestBody('model-a', 'Berapa tagihan Siti?', { billings: [{ customerName: 'Siti' }] });
  assert.match(contextRequest.messages[1].content, /Siti/);
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
