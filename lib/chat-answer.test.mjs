import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addChatKnowledgeToRequestBody,
  buildChatRequestBody,
  appendChatTablePageMetadata,
  getChatTablePageMetadata,
  getChatLearningAction,
  getPendingChatLearning,
  getVisibleChatAnswer,
  isChatTablePageMetadata,
  mergeChatKnowledgeSummary,
  selectRelevantChatKnowledge,
  CHAT_AI_PROVIDERS,
  CHAT_MONTHS,
  getChatCustomerAddressQualifierTerms,
  getChatContextTopics,
  getChatAPIErrorMessage,
  getChatCustomerDataReply,
  getChatBillingHistoryReply,
  getChatUnpaidMonthThreshold,
  getChatNoDataReply,
  getChatUnpaidBillingReply,
  getChatVisitedCustomerReply,
  getChatPackageDataReply,
  getChatNotesReply,
  getChatCompletionEndpoint,
  getChatStreamingEndpoint,
  isChatStreamingRejectionStatus,
  getChatModelsEndpoint,
  getChatModelIDs,
  getChatRequestHeaders,
  getChatResponseContent,
  readChatCompletionStream,
  getRecentChatHistory,
  getCloudflareAccountIDFromBaseURL,
  getCloudflareWorkersAIBaseURL,
  getChatNewCustomerPeriod,
  getChatNewCustomerFollowUpQuestion,
  getChatBillingFollowUpQuestion,
  getChatContextFollowUpQuestion,
  getChatGreetingReply,
  getChatProviderBaseURL,
  matchesChatCustomerNameQuery,
  matchesChatCustomerAddressQuery,
  requestsChatCustomerAddress,
  selectChatCustomerMatchIds,
  normalizeChatAIConfig,
  normalizeChatBaseURL,
  normalizeCloudflareAccountID,
  normalizeCloudflareWorkersAIBaseURL,
  isCloudflareAIModel,
  isCloudflareWorkersAIModel,
  DEFAULT_CHAT_AI_CONFIG,
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
  assert.equal(DEFAULT_CHAT_AI_CONFIG.baseURL, '');
  assert.equal(getChatProviderBaseURL('custom'), '');
  assert.equal(normalizeChatBaseURL('https://vikey.ai/v1/'), 'https://api.vikey.ai/v1');
  assert.equal(normalizeChatBaseURL('https://vikey.ai/v1'), 'https://api.vikey.ai/v1');
  assert.equal(normalizeChatBaseURL('http://localhost:3000/v1'), 'http://localhost:3000/v1');
  assert.equal(normalizeChatBaseURL('http://example.com/v1'), null);
  assert.equal(normalizeChatBaseURL('https://user:pass@example.com/v1'), null);
  assert.equal(normalizeChatBaseURL('https://example.com/v1?key=value'), null);
  assert.equal(getChatCompletionEndpoint('https://vikey.ai/v1'), 'https://api.vikey.ai/v1/chat/completions');
  assert.equal(getChatCompletionEndpoint('https://api.example.com/v1', 'custom'), 'https://api.example.com/v1/chat/completions');
  assert.equal(getChatStreamingEndpoint('https://api.example.com/v1', 'custom'), 'https://api.example.com/v1/chat/completions');
  assert.equal(getChatModelsEndpoint('https://api.vikey.ai/v1'), 'https://api.vikey.ai/v1/models');
});

test('rejects invalid or incomplete stored AI configuration', () => {
  assert.deepEqual(normalizeChatAIConfig({
    baseURL: 'https://vikey.ai/v1',
    apiKey: 'key-123',
    model: 'openai/gpt-6-luna',
  }), {
    provider: 'custom',
    baseURL: 'https://api.vikey.ai/v1',
    apiKey: 'key-123',
    model: 'openai/gpt-6-luna',
  });
  assert.equal(normalizeChatAIConfig({ baseURL: 'http://example.com', apiKey: 'x', model: 'test' }), null);
  assert.equal(normalizeChatAIConfig({ baseURL: '', apiKey: 'key-123', model: 'test' }), null);
  assert.equal(normalizeChatAIConfig({ apiKey: 'key-123', model: 'test' }), null);
  assert.equal(normalizeChatAIConfig({ baseURL: 'https://vikey.ai', apiKey: '', model: 'test' }), null);
  assert.equal(normalizeChatAIConfig({
    provider: 'invalid',
    baseURL: 'https://api.openai.com/v1',
    apiKey: 'key-123',
    model: 'gpt-test',
  }), null);
  assert.deepEqual(normalizeChatAIConfig({
    provider: 'openai',
    baseURL: 'https://attacker.example/v1',
    apiKey: 'key-123',
    model: 'gpt-test',
  }), {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: 'key-123',
    model: 'gpt-test',
  });
  const accountID = '1234567890abcdef1234567890abcdef';
  const cloudflareBaseURL = `https://api.cloudflare.com/client/v4/accounts/${accountID}/ai/v1`;
  assert.deepEqual(normalizeChatAIConfig({
    provider: 'cloudflare',
    baseURL: cloudflareBaseURL,
    apiKey: 'cloudflare-token',
    model: '@cf/meta/llama-3.1-8b-instruct',
  }), {
    provider: 'cloudflare',
    baseURL: cloudflareBaseURL,
    apiKey: 'cloudflare-token',
    model: '@cf/meta/llama-3.1-8b-instruct',
  });
  assert.deepEqual(normalizeChatAIConfig({
    provider: 'cloudflare',
    baseURL: cloudflareBaseURL,
    apiKey: 'cloudflare-token',
    model: 'google/gemini-4-argon',
  }), {
    provider: 'cloudflare',
    baseURL: cloudflareBaseURL,
    apiKey: 'cloudflare-token',
    model: 'google/gemini-4-argon',
  });
  assert.equal(normalizeChatAIConfig({
    provider: 'cloudflare',
    baseURL: 'https://api.cloudflare.com/client/v4/accounts/not-an-account/ai/v1',
    apiKey: 'cloudflare-token',
    model: '@cf/meta/llama-3.1-8b-instruct',
  }), null);
  assert.equal(normalizeChatAIConfig({
    provider: 'cloudflare',
    baseURL: cloudflareBaseURL,
    apiKey: 'cloudflare-token',
    model: 'invalid-model',
  }), null);
});

test('provides provider-specific model catalogues, endpoints, and authentication headers', () => {
  assert.deepEqual(CHAT_AI_PROVIDERS.map(({ id }) => id), [
    'custom', 'openai', 'codex', 'openrouter', 'gemini', 'anthropic', 'cloudflare',
  ]);
  assert.equal(getChatModelsEndpoint('https://ignored.example/v1', 'openai'), 'https://api.openai.com/v1/models');
  assert.equal(getChatCompletionEndpoint('https://ignored.example/v1', 'codex'), 'https://api.openai.com/v1/responses');
  assert.equal(
    getChatCompletionEndpoint('https://ignored.example/v1', 'gemini', 'gemini-2.5-flash'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  );
  assert.equal(
    getChatStreamingEndpoint('https://ignored.example/v1', 'gemini', 'gemini-2.5-flash'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
  );
  assert.equal(isChatStreamingRejectionStatus(400), true);
  assert.equal(isChatStreamingRejectionStatus(404), true);
  assert.equal(isChatStreamingRejectionStatus(429), false);
  assert.equal(isChatStreamingRejectionStatus(503), false);
  assert.equal(getChatCompletionEndpoint('https://ignored.example/v1', 'anthropic'), 'https://api.anthropic.com/v1/messages');
  const cloudflareAccountID = '1234567890abcdef1234567890abcdef';
  const cloudflareBaseURL = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountID}/ai/v1`;
  assert.equal(normalizeCloudflareAccountID(` ${cloudflareAccountID.toUpperCase()} `), cloudflareAccountID);
  assert.equal(normalizeCloudflareAccountID('invalid'), null);
  assert.equal(getCloudflareWorkersAIBaseURL(cloudflareAccountID), cloudflareBaseURL);
  assert.equal(getCloudflareAccountIDFromBaseURL(`${cloudflareBaseURL}/`), cloudflareAccountID);
  assert.equal(normalizeCloudflareWorkersAIBaseURL(`${cloudflareBaseURL}/`), cloudflareBaseURL);
  assert.equal(getChatCompletionEndpoint(cloudflareBaseURL, 'cloudflare'), `${cloudflareBaseURL}/chat/completions`);
  assert.equal(isCloudflareWorkersAIModel('@cf/meta/llama-3.1-8b-instruct'), true);
  assert.equal(isCloudflareWorkersAIModel('openai/gpt-4.1'), false);
  assert.equal(isCloudflareAIModel('@cf/meta/llama-3.1-8b-instruct'), true);
  assert.equal(isCloudflareAIModel('google/gemini-4-argon'), true);
  assert.equal(isCloudflareAIModel('invalid-model'), false);
  assert.deepEqual(getChatModelIDs({
    data: [{ id: 'gpt-4.1' }, { id: 'gpt-5.3-codex' }, { id: 'codex-mini-latest' }],
  }, 'codex'), ['gpt-5.3-codex', 'codex-mini-latest']);
  assert.deepEqual(getChatModelIDs({
    models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
    ],
  }, 'gemini'), ['gemini-2.5-flash']);
  assert.deepEqual(getChatRequestHeaders('gemini', 'gemini-key'), { 'x-goog-api-key': 'gemini-key' });
  assert.deepEqual(getChatRequestHeaders('anthropic', 'anthropic-key'), {
    'x-api-key': 'anthropic-key',
    'anthropic-version': '2023-06-01',
  });
  assert.deepEqual(getChatRequestHeaders('openai', 'openai-key'), { Authorization: 'Bearer openai-key' });
  assert.deepEqual(getChatRequestHeaders('cloudflare', 'cloudflare-token', '@cf/meta/llama-3.1-8b-instruct'), {
    Authorization: 'Bearer cloudflare-token',
    'cf-aig-gateway-id': 'default',
  });
  assert.deepEqual(getChatRequestHeaders('cloudflare', 'cloudflare-token', 'google/gemini-4-argon'), {
    Authorization: 'Bearer cloudflare-token',
  });
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
  assert.match(messages[0].content, /Nama Anda Alfii,/);
  assert.match(messages[0].content, /teman ngobrol yang akrab dan hangat, bukan asisten formal atau customer service/);
  assert.match(messages[0].content, /Jangan memakai kata pembuka yang sama di balasan berturut-turut/);
  assert.match(messages[0].content, /sesuaikan panjang, pilihan kata, dan bentuk jawaban dengan kebutuhan pengguna/);
  assert.match(messages[0].content, /bahasa obrolan sehari-hari ala Gen Z/);
  assert.match(messages[0].content, /Hindari bahasa baku atau kaku/);
  assert.match(messages[0].content, /"Lo" dan "gweh" boleh dipakai sesekali, bukan di setiap kalimat/);
  assert.match(messages[0].content, /selingi dengan ungkapan gaul lain seperti "nggak", "sih", "kok", atau "banget"/);
  assert.match(messages[0].content, /Jangan pernah menggunakan emoji atau emotikon/);
  assert.match(messages[0].content, /tanggapi keluhan atau emosi dengan empati yang wajar dan singkat/);
  assert.match(messages[0].content, /tanggapi dulu cerita atau perasaan pengguna seperti teman/);
  assert.match(messages[0].content, /jangan menutup jawaban dengan pertanyaan atau tawaran bantuan secara otomatis/);
  assert.match(messages[0].content, /Jangan sering bertanya balik/);
  assert.match(messages[0].content, /cukup tanggapi dengan natural tanpa wajib balik bertanya/);
  assert.match(messages[0].content, /jangan terus-terusan menggoda atau memaksakan kedekatan/);
  assert.match(messages[0].content, /hindari rayuan atau lelucon yang meremehkan masalah/);
  assert.match(messages[0].content, /jangan menebak atau menyebut pelanggan lain/);
  assert.match(messages[0].content, /Jika record pelanggan atau tagihan memiliki matchedByAddress: true, berarti kata tambahan pada pertanyaan cocok dengan alamat pelanggan/);
  assert.match(messages[0].content, /tampilkan alamat hanya jika tercantum di DATA dan memang diminta/);
  assert.match(messages[0].content, /Jika tidak ada kecocokan nama maupun penanda matchedByAddress yang sesuai/);
  assert.match(messages[0].content, /blok berpoin dengan label Nama, Status, dan Paket/);
  assert.match(messages[0].content, /sertakan alamat atau nomor kontak hanya jika pengguna memintanya/);
  assert.match(messages[0].content, /Tanggapi obrolan umum/);
  assert.match(messages[0].content, /hanya berdasarkan DATA yang diberikan/);
  assert.match(messages[0].content, /Jangan pernah menebak fakta/);
  assert.match(messages[0].content, /Jika hasil berisi beberapa baris data, utamakan tabel Markdown ringkas/);
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

test('uses recent conversation history for follow-up questions across providers', () => {
  const history = [
    { role: 'user', content: 'Gimana kabarmu?' },
    { role: 'assistant', content: 'Aku baik, makasih. Kamu gimana?' },
  ];
  const openAIRequest = buildChatRequestBody('model-a', 'Aku juga baik', null, 'custom', history);

  assert.deepEqual(openAIRequest.messages.slice(1), [
    ...history,
    { role: 'user', content: 'Pertanyaan admin:\nAku juga baik' },
  ]);
  const geminiRequest = buildChatRequestBody('gemini-test', 'Aku juga baik', null, 'gemini', history);
  assert.deepEqual(geminiRequest.contents.map(({ role }) => role), ['user', 'model', 'user']);
  const anthropicRequest = buildChatRequestBody('claude-test', 'Aku juga baik', null, 'anthropic', history);
  assert.deepEqual(anthropicRequest.messages.map(({ role }) => role), ['user', 'assistant', 'user']);
  const codexRequest = buildChatRequestBody('codex-test', 'Aku juga baik', null, 'codex', history);
  assert.match(codexRequest.input, /Pengguna:\nGimana kabarmu\?/);
  assert.match(codexRequest.input, /Alfii:\nAku baik, makasih\. Kamu gimana\?/);
});

test('adds only admin-curated notes as reference data across AI providers', () => {
  const knowledge = [
    'Generate Month berjalan sekali per bulan untuk setiap akun admin.',
    'Gunakan format Rupiah untuk nominal pembayaran.',
  ];
  const customRequest = buildChatRequestBody('model-a', 'Jelaskan Generate Month', null);
  const customWithKnowledge = addChatKnowledgeToRequestBody('custom', customRequest, knowledge);
  const customMessages = customWithKnowledge.messages;
  assert.match(customMessages.at(-1).content, /PENGETAHUAN STABIL YANG DISETUJUI ADMIN/);
  assert.match(customMessages.at(-1).content, /Generate Month berjalan sekali per bulan/);
  assert.doesNotMatch(customMessages.at(-1).content, /format Rupiah/);
  assert.match(customMessages.at(-1).content, /Pertanyaan admin:\nJelaskan Generate Month/);
  assert.doesNotMatch(customMessages[0].content, /Generate Month berjalan sekali per bulan/);
  assert.doesNotMatch(customRequest.messages.at(-1).content, /PENGETAHUAN STABIL/);

  const geminiRequest = buildChatRequestBody('gemini-test', 'Jelaskan Generate Month', null, 'gemini');
  const geminiWithKnowledge = addChatKnowledgeToRequestBody('gemini', geminiRequest, knowledge);
  assert.match(geminiWithKnowledge.contents.at(-1).parts[0].text, /PENGETAHUAN STABIL/);
  const anthropicRequest = buildChatRequestBody('claude-test', 'Jelaskan Generate Month', null, 'anthropic');
  const anthropicWithKnowledge = addChatKnowledgeToRequestBody('anthropic', anthropicRequest, knowledge);
  assert.match(anthropicWithKnowledge.messages.at(-1).content, /PENGETAHUAN STABIL/);
  const codexRequest = buildChatRequestBody('codex-test', 'Jelaskan Generate Month', null, 'codex');
  const codexWithKnowledge = addChatKnowledgeToRequestBody('codex', codexRequest, knowledge);
  assert.match(codexWithKnowledge.input, /PENGETAHUAN STABIL/);

  assert.equal(addChatKnowledgeToRequestBody('custom', customRequest, [' ', '']).messages, customRequest.messages);
  assert.throws(() => addChatKnowledgeToRequestBody('custom', null, knowledge), /Format permintaan AI tidak valid/);
});

test('selects only relevant chat memories and enforces item and character limits', () => {
  const memories = [
    'Generate Month membuat tagihan sekali per akun dan periode.',
    'Gunakan istilah titip merah untuk pelanggan yang minta dihubungi kembali.',
    'Gunakan format Rupiah untuk pembayaran.',
  ];
  assert.deepEqual(
    selectRelevantChatKnowledge('Jelaskan Generate Month', memories),
    [memories[0]],
  );
  assert.deepEqual(
    selectRelevantChatKnowledge('Apa arti titip merah?', memories),
    [memories[1]],
  );
  assert.deepEqual(
    selectRelevantChatKnowledge('Halo, apa kabar?', memories),
    [],
  );
  assert.equal(selectRelevantChatKnowledge('Generate Month', memories, 1).length, 1);
  const longMemories = Array.from({ length: 4 }, () =>
    `Generate Month ${'panduan '.repeat(95)}`);
  const limitedRequest = addChatKnowledgeToRequestBody(
    'custom',
    buildChatRequestBody('model-a', 'Jelaskan Generate Month', null),
    longMemories,
  );
  assert.equal((limitedRequest.messages.at(-1).content.match(/^- /gmu) || []).length, 1);
});

test('merges memory into a clear per-term summary and selects relevant summary lines', () => {
  const summary = mergeChatKnowledgeSummary(
    ['Generate Month: proses membuat tagihan bulanan.\nTitip merah: hubungi pelanggan kembali.'],
    ' generate month : proses hanya sekali per akun dan periode. ',
    200,
  );
  assert.equal(
    summary,
    'generate month: proses hanya sekali per akun dan periode.\nTitip merah: hubungi pelanggan kembali.',
  );
  assert.deepEqual(
    selectRelevantChatKnowledge('Apa arti titip merah?', [summary]),
    ['Titip merah: hubungi pelanggan kembali.'],
  );
  assert.equal(mergeChatKnowledgeSummary([], 'Istilah baru: penjelasan', 10), null);
});

test('parses hidden clarification and learning markers without showing them in chat', () => {
  const clarification = 'Maksudnya apa?<!--REXXAA_MEMORY:{"action":"clarify","term":"titip merah","question":"Apa arti titip merah?"}-->';
  assert.deepEqual(getChatLearningAction(clarification), {
    action: 'clarify',
    term: 'titip merah',
    question: 'Apa arti titip merah?',
  });
  assert.deepEqual(getPendingChatLearning(clarification, 'Titip merah artinya pelanggan minta ditelepon lagi.'), {
    term: 'titip merah',
    question: 'Apa arti titip merah?',
  });
  assert.equal(getPendingChatLearning(clarification, 'Pelanggan yang di arsip siapa saja?'), null);
  assert.equal(getVisibleChatAnswer(clarification), 'Maksudnya apa?');
  assert.equal(getVisibleChatAnswer(`${clarification.slice(0, -3)}`), 'Maksudnya apa?');

  const learned = 'Oke, aku paham dan akan mengingatnya.<!--REXXAA_MEMORY:{"action":"learn","content":"Titip merah berarti pelanggan meminta admin menghubungi kembali nanti."}-->';
  assert.deepEqual(getChatLearningAction(learned), {
    action: 'learn',
    content: 'Titip merah berarti pelanggan meminta admin menghubungi kembali nanti.',
  });
  assert.equal(getVisibleChatAnswer(learned), 'Oke, aku paham dan akan mengingatnya.');
  assert.equal(getChatLearningAction('Biasa saja.'), null);
  assert.equal(getChatLearningAction('<!--REXXAA_MEMORY:{"action":"learn","content":""}-->'), null);
});

test('passes clarification context only for the pending admin reply', () => {
  const request = buildChatRequestBody(
    'model-a',
    'Maksudnya pelanggan belum mau ditagih sekarang.',
    null,
    'custom',
    [{ role: 'assistant', content: 'Apa arti istilah itu?' }],
    { term: 'titip merah', question: 'Apa arti titip merah?' },
  );
  assert.match(request.messages.at(-1).content, /KONTEKS KLARIFIKASI INTERNAL/);
  assert.match(request.messages.at(-1).content, /titip merah/);
  assert.match(request.messages.at(-1).content, /Maksudnya pelanggan belum mau ditagih sekarang/);
});

test('limits conversation context to recent messages and drops orphaned assistant history', () => {
  const history = [
    { role: 'user', content: 'Pertanyaan lama' },
    { role: 'assistant', content: 'Jawaban lama' },
    ...Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Pesan terbaru ${index}`,
    })),
  ];
  const recent = getRecentChatHistory(history);
  assert.equal(recent.length, 8);
  assert.equal(recent[0].content, 'Pesan terbaru 0');
  assert.equal(recent.at(-1).content, 'Pesan terbaru 7');
  assert.deepEqual(getRecentChatHistory([{ role: 'assistant', content: 'Jawaban tanpa pertanyaan' }]), []);

  const longHistory = Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(2500),
  }));
  const boundedHistory = getRecentChatHistory(longHistory);
  assert.ok(boundedHistory.reduce((total, message) => total + message.content.length, 0) <= 6000);
});

test('selects only the relevant website data topics and avoids loading data for help or general chat', () => {
  assert.deepEqual(getChatContextTopics('Halo, apa kabar?'), []);
  assert.deepEqual(getChatContextTopics('Bagaimana cara menambah pelanggan?'), []);
  assert.deepEqual(getChatContextTopics('Cari pelanggan Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Cari Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Cari tahu tentang teknologi'), []);
  assert.deepEqual(getChatContextTopics('Carikan data Siti Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Cariin data Rina Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tolong carikn pelanggan Susi'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tolong cek data Siti Brajan'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tolong cek info Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Tampilkan daftar paket internet'), ['packages']);
  assert.deepEqual(getChatContextTopics('Berapa harga paket?'), ['packages']);
  assert.deepEqual(getChatContextTopics(getChatContextFollowUpQuestion('Paketnya apa?', [
    { role: 'user', content: 'Cari pelanggan Siti' },
  ])), ['customers']);
  assert.deepEqual(getChatContextTopics('Tampilkan catatan'), ['notes']);
  assert.deepEqual(getChatContextTopics('Cek di catatan ada apa aja'), ['notes']);
  assert.deepEqual(getChatContextTopics('Bagaimana cara menambah catatan?'), []);
  assert.deepEqual(getChatContextTopics('Berapa tagihan dan pembayaran Siti?'), ['billing', 'reports']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum membayar tagihannya?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Siapa yang masih nyicil?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Siapa yang masih punya utang?'), ['billing']);
  const longOverdueQuestion = 'Siapa pelanggan yang nunggak lebih dari 2 bulan';
  assert.deepEqual(getChatContextTopics(longOverdueQuestion), ['customers', 'billing']);
  assert.equal(getChatUnpaidMonthThreshold(longOverdueQuestion), 3);
  assert.equal(getChatUnpaidMonthThreshold('Pelanggan nunggak lebih dari dua bulan'), 3);
  assert.deepEqual(getChatCustomerAddressQualifierTerms(longOverdueQuestion, ''), []);
  assert.deepEqual(getChatContextTopics('Bagaimana status pembayaran Siti?'), ['billing']);
  assert.deepEqual(getChatContextTopics('Berapa uang masuk bulan ini?'), ['reports']);
  assert.deepEqual(getChatContextTopics('Berapa uang yang sudah masuk bulan ini?'), ['reports']);
  assert.deepEqual(getChatContextTopics('Cari pelanggan Siti di arsip'), ['customers', 'archive']);
  assert.deepEqual(getChatContextTopics('Cari pelanggan yang sudah stop langganan'), ['customers', 'archive']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum dikunjungi kolektor?'), ['collection']);
  assert.deepEqual(getChatContextTopics('Siapa yang harus nagih pelanggan ini?'), ['customers', 'collection']);
  assert.deepEqual(getChatContextTopics('Siapa yang belum didatangi?'), ['collection']);
  assert.deepEqual(getChatContextTopics('Pelanggan mana yang belum disamperin?'), ['customers', 'collection']);
  assert.deepEqual(getChatContextTopics('Pelanggan mana yang belum didatengin?'), ['customers', 'collection']);
  assert.deepEqual(getChatContextTopics('Tampilkan data pelanggan yang dikunjungi kemarin'), ['customers', 'collection']);
  assert.deepEqual(getChatContextTopics('Tolong tampilkan pelanggan Karangdukuh yang belum bayar bulan November'), ['customers', 'billing']);
  assert.deepEqual(getChatContextTopics('Tampilkan data pelanggan baru bulan ini'), ['customers']);
  assert.equal(getChatNewCustomerPeriod('Tampilkan data pelanggan baru bulan ini'), 'current');
  assert.equal(getChatNewCustomerPeriod('Tampilkan data pelanggan yang baru bulan ini'), 'current');
  assert.equal(getChatNewCustomerPeriod('Tampilkan data pelanggan baru bulan lalu'), 'previous');
  assert.equal(getChatNewCustomerPeriod('Tampilkan data pelanggan baru bulan kemarin'), 'previous');
  for (const month of CHAT_MONTHS) {
    assert.deepEqual(
      getChatNewCustomerPeriod(`Tampilkan data pelanggan baru bulan ${month}`),
      { month },
    );
  }
  assert.deepEqual(
    getChatNewCustomerPeriod('Tampilkan data pelanggan baru bulan November 2025'),
    { month: 'November', year: 2025 },
  );
  assert.equal(
    getChatNewCustomerFollowUpQuestion('Bulan lalu', 'Tampilkan data pelanggan baru bulan ini'),
    'Tampilkan data pelanggan baru bulan lalu',
  );
  assert.equal(
    getChatNewCustomerFollowUpQuestion('bulan lalu', 'tolong Carikan data pelanggan baru bulan ini'),
    'tolong Carikan data pelanggan baru bulan lalu',
  );
  assert.equal(
    getChatNewCustomerFollowUpQuestion('Bulan lalu', 'Tampilkan pelanggan baru di Karangdukuh'),
    'Tampilkan pelanggan baru di Karangdukuh bulan lalu',
  );
  assert.equal(getChatNewCustomerFollowUpQuestion('Bulan lalu', 'Berapa tagihan bulan ini?'), 'Bulan lalu');
  assert.equal(
    getChatNewCustomerFollowUpQuestion('Bulan lalu', 'Tampilkan data pelanggan baru bulan November 2025'),
    'Tampilkan data pelanggan baru bulan lalu',
  );
  assert.equal(getChatNewCustomerPeriod('Tampilkan semua pelanggan bulan ini'), null);
  assert.equal(
    getChatBillingFollowUpQuestion('Kalau bulan September', 'Siapa aja yang belum bayar bulan Oktober'),
    'Siapa aja yang belum bayar bulan September',
  );
  assert.equal(
    getChatContextFollowUpQuestion('Berapa tagihannya?', [
      { role: 'user', content: 'Cari data pelanggan Siti' },
      { role: 'assistant', content: 'Data pelanggan: Siti' },
    ]),
    'Cari data pelanggan Siti\nBerapa tagihannya?',
  );
  const billingHistoryFollowUp = getChatContextFollowUpQuestion('History tagihan', [
    { role: 'user', content: 'Tampilkan history Haryono Karangsuwung' },
    { role: 'assistant', content: 'Data pelanggan 1\nNama: Haryono' },
  ]);
  assert.equal(
    billingHistoryFollowUp,
    'Tampilkan history Haryono Karangsuwung\nHistory tagihan',
  );
  assert.deepEqual(getChatContextTopics(billingHistoryFollowUp), ['billing', 'customers']);
  assert.deepEqual(
    getChatCustomerAddressQualifierTerms(billingHistoryFollowUp, 'Haryono'),
    ['karangsuwung'],
  );
  assert.equal(
    getChatContextFollowUpQuestion('Paketnya apa?', [
      { role: 'user', content: 'Cari pelanggan Siti' },
      { role: 'assistant', content: 'Data pelanggan: Siti' },
      { role: 'user', content: 'Berapa tagihannya?' },
      { role: 'assistant', content: 'Tagihan bulan ini...' },
    ]),
    'Cari pelanggan Siti\nBerapa tagihannya?\nPaketnya apa?',
  );
  assert.equal(
    getChatContextFollowUpQuestion('Alamatnya di mana?', [
      { role: 'user', content: 'Tampilkan pelanggan Rina' },
      { role: 'assistant', content: 'Data pelanggan: Rina' },
    ]),
    'Tampilkan pelanggan Rina\nAlamatnya di mana?',
  );
  assert.equal(
    getChatContextFollowUpQuestion('Berapa tagihan bulan ini?', [
      { role: 'user', content: 'Cari data pelanggan Siti' },
      { role: 'assistant', content: 'Data pelanggan: Siti' },
    ]),
    'Berapa tagihan bulan ini?',
  );
  assert.equal(
    getChatContextFollowUpQuestion('Punya tunggakan bulan ini?', [
      { role: 'user', content: 'Cari pelanggan Siti' },
      { role: 'assistant', content: 'Data pelanggan: Siti' },
    ]),
    'Punya tunggakan bulan ini?',
  );
  assert.equal(
    getChatContextFollowUpQuestion('Berapa tagihannya?', [
      { role: 'user', content: 'Bagaimana cara melihat tagihan?' },
      { role: 'assistant', content: 'Buka menu Tagihan.' },
    ]),
    'Berapa tagihannya?',
  );
  assert.equal(
    getChatBillingFollowUpQuestion('September 2025', 'Siapa aja yang belum bayar bulan Oktober 2026'),
    'Siapa aja yang belum bayar bulan September 2025',
  );
  assert.equal(
    getChatBillingFollowUpQuestion('Kalau bulan September', 'Bagaimana cara melihat laporan?'),
    'Kalau bulan September',
  );
  assert.deepEqual(
    getChatContextTopics(getChatBillingFollowUpQuestion(
      'Kalau bulan September',
      'Siapa aja yang belum bayar bulan Oktober',
    )),
    ['billing'],
  );
  assert.deepEqual(getChatContextTopics('Tampilkan data pelanggan yang diarsipkan'), ['customers', 'archive']);
  assert.deepEqual(getChatContextTopics('Lihatin data Siti'), ['customers']);
  assert.deepEqual(getChatContextTopics('Siapa aja yang belum bayar bulan Oktober'), ['billing']);
  const unpaidCustomerQuestion = 'Cariin pelanggan yang belum bayar bulan Oktober dong';
  assert.deepEqual(getChatContextTopics(unpaidCustomerQuestion), ['customers', 'billing']);
  assert.deepEqual(getChatCustomerAddressQualifierTerms(unpaidCustomerQuestion, ''), []);
  assert.deepEqual(
    getChatCustomerAddressQualifierTerms('Siapa aja yang belum bayar bulan Oktober', ''),
    [],
  );
  assert.deepEqual(getChatContextTopics('Data pelanggan yang tidak aktif'), ['customers', 'archive']);
});

test('formats package and account note context only when those topics were requested', () => {
  const packageContext = {
    topics: ['packages'],
    data: {
      packages: [
        { name: 'Fiber 20', speed: '20 Mbps', price: 150000, description: 'Paket rumah' },
        { name: 'Fiber 50', speed: '50 Mbps', price: 250000, description: '' },
      ],
    },
  };
  assert.match(getChatPackageDataReply(packageContext), /Fiber 20/);
  assert.match(getChatPackageDataReply(packageContext), /Rp 150\.000/);
  assert.match(getChatPackageDataReply(packageContext), /Paket rumah/);
  assert.match(getChatPackageDataReply(packageContext), /\| No\. \| Paket \|/);
  assert.match(getChatPackageDataReply(packageContext), /\| 2 \| Fiber 50 \|/);
  assert.equal(getChatPackageDataReply({ ...packageContext, topics: ['customers'] }), null);

  const noteContext = {
    topics: ['notes'],
    data: {
      notes: [
        { text: 'Hubungi teknisi hari Senin', completed: false },
        { text: 'Cek router kantor', completed: true },
      ],
    },
  };
  assert.match(getChatNotesReply(noteContext), /Belum selesai/);
  assert.match(getChatNotesReply(noteContext), /Cek router kantor/);
  assert.match(getChatNotesReply(noteContext), /1\. \[Belum selesai\]/);
  assert.match(getChatNotesReply(noteContext), /2\. \[Selesai\]/);
  assert.equal(getChatNotesReply({ ...noteContext, topics: ['customers'] }), null);
});

test('uses an extra name-search term to filter by address without exposing the address', () => {
  assert.deepEqual(getChatCustomerAddressQualifierTerms('Carikan data Siti Brajan', 'Siti'), ['brajan']);
  assert.deepEqual(getChatCustomerAddressQualifierTerms('Utang Lusi Samiran berapa', 'Lusi'), ['samiran']);
  assert.equal(matchesChatCustomerNameQuery('Utang Lusi Samiran berapa', 'Lusi'), true);
  assert.equal(matchesChatCustomerAddressQuery('Utang Lusi Samiran berapa', 'Lusi', 'Desa Samiran'), true);
  assert.equal(matchesChatCustomerAddressQuery('Utang Lusi Samiran berapa', 'Lusi', 'Desa Cempaka'), false);
  assert.equal(requestsChatCustomerAddress('Utang Lusi Samiran berapa'), false);
  assert.equal(requestsChatCustomerAddress('Alamat Lusi di mana?'), true);
  assert.equal(requestsChatCustomerAddress('Kontak pelanggan Lusi'), true);
  const neighborhoodQuestion = 'Tolong tampilkan pelanggan Karangdukuh yg belum bayar bulan November';
  assert.deepEqual(getChatCustomerAddressQualifierTerms(neighborhoodQuestion, ''), ['karangdukuh']);
  assert.equal(matchesChatCustomerAddressQuery(neighborhoodQuestion, '', 'Desa Karangdukuh'), true);
  assert.equal(matchesChatCustomerAddressQuery(neighborhoodQuestion, '', 'Desa Cempaka'), false);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti Brajan', 'Siti', 'Jl. Brajan'), true);
  assert.equal(matchesChatCustomerAddressQuery('Cariin data Rina Brajan', 'Rina', 'Jl. Brajan'), true);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti Brajan', 'Siti', 'Jl. Cempaka'), false);
  assert.equal(matchesChatCustomerAddressQuery('Carikan data Siti', 'Siti', 'Jl. Brajan'), false);
  assert.equal(matchesChatCustomerNameQuery('Cariin data Rina Brajan', 'Rina Amelia'), true);
  assert.equal(matchesChatCustomerNameQuery('Cariin data Rina Brajan', 'Dina Amelia'), false);
});

test('requires a matching address when the query includes an address qualifier', () => {
  const nameMatches = ['rina-id'];
  assert.deepEqual(selectChatCustomerMatchIds(nameMatches, [], true), []);
  assert.deepEqual(selectChatCustomerMatchIds(nameMatches, ['rina-id'], true), ['rina-id']);
  assert.deepEqual(selectChatCustomerMatchIds(nameMatches, [], false), ['rina-id']);
});

test('returns a deterministic clarification instead of asking the model to guess missing customers', () => {
  assert.match(getChatNoDataReply({ notFound: 'customer' }), /belum menemukan pelanggan yang cocok/);
  assert.match(getChatNoDataReply({ notFound: 'new-customers', notFoundPeriod: 'bulan lalu' }), /Tidak ada pelanggan yang terdaftar pada bulan lalu/);
  assert.match(getChatNoDataReply({ notFound: 'new-customers', notFoundPeriod: 'November 2025' }), /pada November 2025/);
  assert.match(getChatNoDataReply({ notFound: 'visits-yesterday' }), /Tidak ada catatan kunjungan pelanggan untuk kemarin/);
  assert.match(getChatNoDataReply({ notFound: 'unpaid-billing' }), /Tidak ada tagihan dengan sisa pembayaran/);
  assert.match(getChatNoDataReply({ notFound: 'unpaid-threshold', minimumUnpaidMonths: 3 }), /menunggak 3 bulan atau lebih/);
  assert.equal(getChatNoDataReply({ data: { customers: [{ name: 'Siti' }] } }), null);
});

test('formats unpaid billing results only from the scoped website data', () => {
  const reply = getChatUnpaidBillingReply({
    topics: ['customers', 'billing'],
    data: {
      unpaidOnly: true,
      billings: [{
        customerName: 'Susi',
        address: 'Desa Karangdukuh',
        month: 'November',
        year: 2026,
        outstandingAmount: 125000,
      }],
    },
  });
  assert.equal(reply, 'Pelanggan dengan tagihan belum lunas\n\n1. Nama: Susi\nPeriode: November 2026\nAlamat: Desa Karangdukuh\nSisa tagihan: Rp 125.000');
  assert.equal(getChatUnpaidBillingReply({
    topics: ['customers', 'billing'],
    data: {
      unpaidOnly: true,
      report: {},
      billings: [{ customerName: 'Susi', month: 'November', year: 2026, outstandingAmount: 125000 }],
    },
  }), null);
  assert.equal(getChatUnpaidBillingReply({
    topics: ['billing'],
    data: {
      unpaidOnly: true,
      billings: [
        { customerName: 'Susi', month: 'Oktober', year: 2026, outstandingAmount: 125000 },
        { customerName: 'Lusi', month: 'November', year: 2026, outstandingAmount: 150000 },
      ],
    },
  }), 'Pelanggan dengan tagihan belum lunas\n\n| No. | Nama | Periode | Sisa tagihan |\n| --- | --- | --- | --- |\n| 1 | Susi | Oktober 2026 | Rp 125.000 |\n| 2 | Lusi | November 2026 | Rp 150.000 |');
  assert.equal(getChatUnpaidBillingReply({
    topics: ['customers', 'billing'],
    data: {
      unpaidOnly: true,
      minimumUnpaidMonths: 3,
      overdueCustomers: [
        { name: 'Siti', unpaidMonths: 4, totalOutstanding: 300000 },
        { name: 'Rina', unpaidMonths: 3, totalOutstanding: 225000 },
      ],
      billings: [],
    },
  }), 'Pelanggan menunggak 3 bulan atau lebih\n\n| No. | Nama | Bulan menunggak | Total tunggakan |\n| --- | --- | --- | --- |\n| 1 | Siti | 4 | Rp 300.000 |\n| 2 | Rina | 3 | Rp 225.000 |');
});

test('formats every billing month in payment history, including paid months', () => {
  const reply = getChatBillingHistoryReply({
    topics: ['customers', 'billing'],
    data: {
      billingHistory: true,
      unpaidOnly: false,
      billings: [
        {
          customerName: 'Haryono',
          month: 'Oktober',
          year: 2026,
          status: 'TF',
          packagePrice: 150000,
          totalDue: 150000,
          paidAmount: 150000,
          outstandingAmount: 0,
          note: 'Pembayaran lengkap',
          payments: [{
            amount: 150000,
            date: '2026-10-05T08:30:00.000Z',
            addedBy: 'Admin WiFi',
            status: 'Lunas',
            method: 'TF',
            note: 'Transfer bank',
          }],
        },
        {
          customerName: 'Haryono',
          month: 'September',
          year: 2026,
          status: 'Nyicil',
          packagePrice: 150000,
          totalDue: 150000,
          paidAmount: 50000,
          outstandingAmount: 100000,
          note: '',
          payments: [{
            amount: 50000,
            date: '2026-09-10T09:00:00.000Z',
            addedBy: 'Petugas',
            status: 'Nyicil',
            note: '',
            isSettlementAllocation: true,
          }],
        },
      ],
    },
  });
  assert.ok(reply?.startsWith('Riwayat Tagihan\n\n| No. | Bulan | Tahun | Status | Dibayar | Catatan |'));
  assert.ok(reply?.includes('| 1 | Oktober | 2026 | Transfer | Rp 150.000 | Pembayaran lengkap |'));
  assert.ok(reply?.includes('| 2 | September | 2026 | Nyicil | Rp 50.000 | - |'));
  assert.ok(reply?.includes('Detail pembayaran\n\n| Periode | Pembayaran | Tanggal dan petugas | Nominal | Catatan | Status |'));
  assert.ok(reply?.includes('| Oktober 2026 | Pembayaran ke-1 |'));
  assert.ok(reply?.includes('oleh Admin WiFi | Rp 150.000 | Transfer bank | Transfer |'));
  assert.ok(reply?.includes('| September 2026 | Alokasi tunggakan |'));
  const markdownTables = reply?.match(/\|[^\n]+\|\n\|[-| ]+\|\n(?:\|[^\n]+\|\n?)+/gu) || [];
  assert.equal(markdownTables.length, 2);
  for (const table of markdownTables) {
    const columnCount = table.split('\n')[0].split('|').length - 2;
    for (const row of table.trim().split('\n')) {
      assert.equal(row.split('|').length - 2, columnCount);
    }
  }
  assert.equal(getChatBillingHistoryReply({
    topics: ['billing'],
    data: { billingHistory: true, unpaidOnly: true, billings: [] },
  }), null);
});

test('formats customer lookup results consistently from database context', () => {
  const reply = getChatCustomerDataReply({
    topics: ['customers'],
    data: {
      customers: [{
        name: 'Susi',
        status: 'active',
        address: 'Brajan',
        package: { name: 'Paket 10 Mbps', speed: '10 Mbps', price: 150000 },
      }],
    },
  });
  assert.equal(reply, 'Data pelanggan 1\nNama: Susi\nStatus: Aktif\nAlamat: Brajan\nPaket: Paket 10 Mbps\nHarga: Rp 150.000/bulan');
  assert.equal(getChatCustomerDataReply({
    topics: ['customers'],
    data: {
      customers: [
        { name: 'Susi', status: 'active', address: 'Brajan' },
        { name: 'Lusi', status: 'inactive', address: 'Samiran' },
      ],
    },
  }), 'Data pelanggan\n\n| No. | Nama | Status | Alamat |\n| --- | --- | --- | --- |\n| 1 | Susi | Aktif | Brajan |\n| 2 | Lusi | Nonaktif | Samiran |');
  assert.equal(getChatCustomerDataReply({
    topics: ['customers', 'billing'],
    data: { customers: [{ name: 'Susi' }], billings: [] },
  }), null);
  assert.equal(getChatCustomerDataReply({
    topics: ['customers', 'archive'],
    data: {
      archivedCustomers: [{ name: 'Susi', status: 'inactive' }],
    },
  }), 'Data pelanggan arsip 1\nNama: Susi\nStatus: Nonaktif');
  assert.equal(getChatCustomerDataReply({
    topics: ['customers'],
    data: {
      newCustomersOnly: true,
      newCustomersPeriod: 'current',
      newCustomersPeriodLabel: 'bulan ini',
      customers: [{
        name: 'Rina',
        status: 'active',
        createdAt: '2026-11-02T18:00:00.000Z',
      }],
    },
  }), 'Pelanggan baru bulan ini 1\nNama: Rina\nStatus: Aktif\nTanggal daftar: 3/11/2026');
  assert.equal(getChatCustomerDataReply({
    topics: ['customers'],
    data: {
      newCustomersOnly: true,
      newCustomersPeriod: 'previous',
      newCustomersPeriodLabel: 'bulan lalu',
      customers: [{ name: 'Siti', status: 'active' }],
    },
  }), 'Pelanggan baru bulan lalu 1\nNama: Siti\nStatus: Aktif');
  assert.equal(getChatCustomerDataReply({
    topics: ['customers'],
    data: {
      newCustomersOnly: true,
      newCustomersPeriodLabel: 'November 2026',
      customers: [{ name: 'Siti', status: 'active' }],
    },
  }), 'Pelanggan baru November 2026 1\nNama: Siti\nStatus: Aktif');
});

test('formats yesterday visit results only from recorded visits', () => {
  const reply = getChatVisitedCustomerReply({
    topics: ['customers', 'collection'],
    data: {
      collection: {
        visitedYesterday: true,
        visits: [{
          customerName: 'Siti',
          address: 'Desa Karangdukuh',
          collector: 'andi',
          visitedAt: '2026-11-04T03:30:00.000Z',
        }],
      },
    },
  });
  assert.equal(reply, 'Pelanggan yang dikunjungi kemarin\n\n1. Nama: Siti\nAlamat: Desa Karangdukuh\nPetugas: andi\nWaktu kunjungan: 4/11/2026, 10.30.00');
  assert.equal(getChatVisitedCustomerReply({
    topics: ['collection'],
    data: {
      collection: {
        visitedYesterday: true,
        visits: [
          { customerName: 'Siti', collector: 'andi' },
          { customerName: 'Lusi', collector: 'budi' },
        ],
      },
    },
  }), 'Pelanggan yang dikunjungi kemarin\n\n| No. | Nama | Petugas |\n| --- | --- | --- |\n| 1 | Siti | andi |\n| 2 | Lusi | budi |');
  assert.equal(getChatVisitedCustomerReply({
    topics: ['customers', 'collection'],
    data: { collection: { visitedYesterday: true, visits: [] } },
  }), null);
});

test('builds a low-context request for general chat and includes context only when supplied', () => {
  const generalRequest = buildChatRequestBody('model-a', 'Halo, apa kabar?', null);
  assert.equal(generalRequest.messages[1].content, 'Pertanyaan admin:\nHalo, apa kabar?');
  assert.match(generalRequest.messages[0].content, /Jika pesan hanya sapaan.*balas sapaan itu dengan natural dan singkat/u);
  assert.match(generalRequest.messages[0].content, /Jangan menganggap sapaan sebagai permintaan bantuan/u);
  assert.doesNotMatch(JSON.stringify(generalRequest.messages), /Siti|Budi Santoso|Catatan tunggakan/);

  const contextRequest = buildChatRequestBody('model-a', 'Berapa tagihan Siti?', { billings: [{ customerName: 'Siti' }] });
  assert.match(contextRequest.messages[1].content, /Siti/);
});

test('replies naturally to standalone greetings without asking an unrelated question', () => {
  assert.equal(getChatGreetingReply('Haloo'), 'Haloo juga!');
  assert.equal(getChatGreetingReply('Haloooo!'), 'Haloo juga!');
  assert.equal(getChatGreetingReply('Hai Alfii'), 'Haloo juga!');
  assert.equal(getChatGreetingReply('Halo, apa kabar?'), null);
  assert.equal(getChatGreetingReply('Halo, siapa pelanggan yang nunggak?'), null);
});

test('stores table pagination metadata invisibly in chat history', () => {
  const metadata = {
    question: 'Tampilkan pelanggan Karangsuwung',
    source: 'customers',
    page: 2,
    pageSize: 20,
    hasNext: true,
  };
  const content = appendChatTablePageMetadata('Data pelanggan\n\n| No. | Nama |\n| --- | --- |\n| 1 | Siti |', metadata);
  assert.deepEqual(getChatTablePageMetadata(content), metadata);
  assert.equal(getVisibleChatAnswer(content), 'Data pelanggan\n\n| No. | Nama |\n| --- | --- |\n| 1 | Siti |');
  assert.equal(isChatTablePageMetadata({ ...metadata, pageSize: 10 }), false);
  assert.equal(getChatTablePageMetadata('Jawaban biasa'), null);
});

test('parses provider-specific stream chunks and emits text as it arrives', async () => {
  const encoder = new TextEncoder();
  const cases = [
    {
      provider: 'custom',
      payloads: [
        { choices: [{ delta: { content: 'Halo 👋🏻, 🇮🇩 1️⃣' } }] },
        { choices: [{ delta: { content: ' kamu' } }] },
      ],
      answer: 'Halo, 1 kamu',
    },
    {
      provider: 'codex',
      payloads: [{ type: 'response.output_text.delta', delta: 'Halo Codex' }],
      answer: 'Halo Codex',
    },
    {
      provider: 'gemini',
      payloads: [{ candidates: [{ content: { parts: [{ text: 'Halo Gemini' }] } }] }],
      answer: 'Halo Gemini',
    },
    {
      provider: 'anthropic',
      payloads: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Halo Anthropic' } }],
      answer: 'Halo Anthropic',
    },
  ];
  for (const { provider, payloads, answer: expectedAnswer } of cases) {
    const streamText = `${payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join('')}data: [DONE]\n\n`;
    const bytes = encoder.encode(streamText);
    const splitAt = Math.floor(bytes.length / 2);
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, splitAt));
        controller.enqueue(bytes.slice(splitAt));
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
    const received = [];
    const answer = await readChatCompletionStream(response, provider, 'test-key', (text) => received.push(text));

    assert.equal(answer, expectedAnswer);
    assert.equal(received.join(''), expectedAnswer);
  }
});

test('reports provider errors and redacts API keys from details', () => {
  assert.match(getChatAPIErrorMessage(401), /API Key ditolak/);
  const planRestrictedModelError = getChatAPIErrorMessage(403, {
    error: {
      message: 'AiError: Model @cf/deepseek-ai/deepseek-v4.1-flash-1017 is not available on the Workers Free plan. Upgrade to access this model.',
    },
  }, undefined, 'cloudflare');
  assert.match(planRestrictedModelError, /tidak tersedia pada Workers Free plan/);
  assert.match(planRestrictedModelError, /Pilih model yang tersedia di paket gratis atau upgrade/);
  assert.doesNotMatch(planRestrictedModelError, /API Key Cloudflare ditolak/);
  assert.match(getChatAPIErrorMessage(402, undefined, undefined, 'cloudflare'), /billing atau pembayaran aktif/);
  assert.match(getChatAPIErrorMessage(429), /Kuota/);
  const capacityError = getChatAPIErrorMessage(429, {
    error: { message: 'service failure: endpoint deepseek-v4.1-flash-1017-basic all replicas at capacity' },
  });
  assert.match(capacityError, /semua replika model penuh/);
  assert.doesNotMatch(capacityError, /Kuota atau batas permintaan/);
  assert.match(getChatAPIErrorMessage(400, { error: { message: 'Invalid request.' } }), /menolak format permintaan/);
  assert.match(
    getChatAPIErrorMessage(400, { success: false, errors: [{ code: 1001, message: 'Model is not available.' }] }, undefined, 'cloudflare'),
    /Detail: Model is not available\./,
  );
  assert.match(
    getChatAPIErrorMessage(429, { message: 'InferX API quota exceeded', request_id: 'req_123' }),
    /Detail: InferX API quota exceeded \(request ID: req_123\)/,
  );
  assert.match(getChatAPIErrorMessage(429, 'rate limit exceeded'), /Detail: rate limit exceeded/);
  const error = getChatAPIErrorMessage(400, { error: { message: 'Invalid key-123 model' } }, 'key-123');
  assert.match(error, /Invalid \[API Key disamarkan\] model/);
  assert.doesNotMatch(error, /key-123/);
  assert.equal(getChatResponseContent({ choices: [{ message: { content: '  Jawaban faktual.  ' } }] }), 'Jawaban faktual.');
  assert.equal(getChatResponseContent({
    choices: [{ message: { content: 'Halo 👋🏻, 🇮🇩 1️⃣' } }],
  }), 'Halo, 1');
  assert.equal(getChatResponseContent({ choices: [] }), null);
});

test('builds and parses Codex, Gemini, and Anthropic requests', () => {
  const codexRequest = buildChatRequestBody('gpt-5.3-codex', 'Halo', null, 'codex');
  assert.equal(codexRequest.model, 'gpt-5.3-codex');
  assert.equal(typeof codexRequest.instructions, 'string');
  assert.equal(typeof codexRequest.input, 'string');
  assert.equal(Object.hasOwn(codexRequest, 'temperature'), false);
  assert.equal(getChatResponseContent({
    output: [{ type: 'message', content: [{ type: 'output_text', text: ' Jawaban Codex ' }] }],
  }, 'codex'), 'Jawaban Codex');

  const geminiRequest = buildChatRequestBody('gemini-2.5-flash', 'Halo', null, 'gemini');
  assert.equal(geminiRequest.contents[0].role, 'user');
  assert.equal(typeof geminiRequest.systemInstruction.parts[0].text, 'string');
  assert.equal(getChatResponseContent({
    candidates: [{ content: { parts: [{ text: 'Jawaban Gemini' }] } }],
  }, 'gemini'), 'Jawaban Gemini');

  const anthropicRequest = buildChatRequestBody('claude-test', 'Halo', null, 'anthropic');
  assert.equal(anthropicRequest.messages[0].role, 'user');
  assert.equal(typeof anthropicRequest.system, 'string');
  assert.equal(getChatResponseContent({
    content: [{ type: 'text', text: 'Jawaban Anthropic' }],
  }, 'anthropic'), 'Jawaban Anthropic');
});

test('extracts unique model IDs from an OpenAI-compatible catalogue response', () => {
  assert.deepEqual(getChatModelIDs({
    data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-a' }, { name: 'missing id' }],
  }), ['model-a', 'model-b']);
  assert.deepEqual(getChatModelIDs({ data: 'invalid' }), []);
});
