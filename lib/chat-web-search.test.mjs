import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addChatWebSearchContext,
  getChatImageSearchQuery,
  getChatWebSearchQuery,
  parseDuckDuckGoImages,
  parseDuckDuckGoResults,
  searchChatImages,
  searchChatWeb,
  shouldSearchChatImages,
  shouldSearchChatWeb,
} from './chat-web-search.mjs';

test('automatically searches informational questions, but not website data or learning turns', () => {
  assert.equal(shouldSearchChatWeb('Siapa penemu internet?'), true);
  assert.equal(shouldSearchChatWeb('jelaskan cara kerja fiber optik'), true);
  assert.equal(shouldSearchChatWeb('Gimana tagihan bulan ini?', true), false);
  assert.equal(shouldSearchChatWeb('Apa arti istilah ini?', false, true), false);
  assert.equal(shouldSearchChatWeb('Carikan gambar'), false);
  assert.equal(shouldSearchChatWeb('Makasih ya'), false);
});

test('searches for images only when the request names both an image and a topic', () => {
  assert.equal(shouldSearchChatImages('Carikan gambar landing page di Pinterest'), true);
  assert.equal(shouldSearchChatImages('Carikan gambar'), false);
  assert.equal(shouldSearchChatImages('Carikan referensi design'), false);
  assert.equal(shouldSearchChatImages('Carikan gambar yang bagus'), false);
  assert.equal(shouldSearchChatImages('Foto pelanggan yang belum bayar', true), false);
  assert.equal(shouldSearchChatImages('Carikan gambar landing page', false, true), false);
  assert.equal(getChatImageSearchQuery('Carikan referensi design landing page di Pinterest'), 'referensi design landing page Pinterest');
  assert.equal(shouldSearchChatImages('Carikan referensi design landing page di Pinterest berikan gambarnya'), true);
  assert.equal(getChatImageSearchQuery('Carikan referensi design landing page di Pinterest berikan gambarnya'), 'referensi design landing page Pinterest');
});

test('parses safe web results and ignores invalid destinations', () => {
  const html = `
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnews&amp;rut=abc">News &amp; updates</a>
    <div class="result__snippet">A current <b>summary</b> for readers.</div>
    <a class="result__a" href="javascript:alert(1)">Unsafe</a>
    <div class="result__snippet">Ignore this result.</div>
    <a class="result__a" href="//duckduckgo.com/l/?uddg=http%3A%2F%2Fexample.net&amp;rut=def">HTTP only</a>
    <div class="result__snippet">Ignore this too.</div>`;

  assert.deepEqual(parseDuckDuckGoResults(html), [{
    title: 'News & updates',
    snippet: 'A current summary for readers.',
    url: 'https://example.com/news',
  }]);
});

test('parses image results only from the trusted thumbnail host and HTTPS source links', () => {
  assert.deepEqual(parseDuckDuckGoImages({
    results: [
      {
        title: 'Landing page reference',
        thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.image',
        url: 'https://www.pinterest.com/pin/123/',
      },
      {
        title: 'Untrusted thumbnail',
        thumbnail: 'https://example.com/image.jpg',
        url: 'https://example.com/',
      },
      {
        title: 'Unsafe source',
        thumbnail: 'https://tse2.mm.bing.net/th/id/OIP.other',
        url: 'http://example.com/',
      },
    ],
  }), [{
    title: 'Landing page reference',
    thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.image',
    url: 'https://www.pinterest.com/pin/123/',
  }]);
  assert.throws(() => parseDuckDuckGoImages({ results: 'invalid' }), /Format hasil pencarian gambar/);
});

test('extracts the latest user query for each supported provider format', () => {
  assert.equal(getChatWebSearchQuery('custom', {
    messages: [{ role: 'user', content: 'search current Jakarta weather' }],
  }), 'search current Jakarta weather');
  assert.equal(getChatWebSearchQuery('gemini', {
    contents: [{ role: 'user', parts: [{ text: 'latest weather' }] }],
  }), 'latest weather');
  assert.equal(getChatWebSearchQuery('codex', {
    input: 'Alfii:\nhello\n\nPengguna:\nlatest weather',
  }), 'latest weather');
});

test('adds external results to each provider system prompt without replacing user messages', () => {
  const results = [{
    title: 'Current report',
    snippet: 'A concise summary.',
    url: 'https://example.com/report',
  }];
  const request = {
    model: 'test',
    messages: [
      { role: 'system', content: 'Be factual.' },
      { role: 'user', content: 'What happened today?' },
    ],
  };
  const updated = addChatWebSearchContext('custom', request, results);

  assert.match(updated.messages[0].content, /HASIL PENCARIAN WEB/);
  assert.equal(updated.messages[1].content, 'What happened today?');
  assert.equal(request.messages[0].content, 'Be factual.');

  const withImages = addChatWebSearchContext('custom', request, [], [{
    title: 'Landing page reference',
    thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.image',
    url: 'https://www.pinterest.com/pin/123/',
  }]);
  assert.match(withImages.messages[0].content, /HASIL GAMBAR/);
  assert.match(withImages.messages[0].content, /https:\/\/www\.pinterest\.com\/pin\/123/);

  const anthropic = addChatWebSearchContext('anthropic', {
    system: 'Be factual.',
    messages: [{ role: 'user', content: 'What happened today?' }],
  }, results);
  assert.match(anthropic.system, /HASIL PENCARIAN WEB/);

  const gemini = addChatWebSearchContext('gemini', {
    systemInstruction: { parts: [{ text: 'Be factual.' }] },
    contents: [{ role: 'user', parts: [{ text: 'What happened today?' }] }],
  }, results);
  assert.match(gemini.systemInstruction.parts[1].text, /HASIL PENCARIAN WEB/);

  const codex = addChatWebSearchContext('codex', {
    instructions: 'Be factual.',
    input: 'Pengguna:\nWhat happened today?',
  }, results);
  assert.match(codex.instructions, /HASIL PENCARIAN WEB/);
});

test('searches only the fixed HTTPS search endpoint and rejects redirects', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://html.duckduckgo.com');
    assert.equal(url.searchParams.get('q'), 'weather Jakarta');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return new Response(`
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fweather">Weather</a>
      <div class="result__snippet">Forecast details.</div>`,
    { headers: { 'Content-Type': 'text/html' } });
  };
  try {
    assert.deepEqual(await searchChatWeb('weather Jakarta'), [{
      title: 'Weather',
      snippet: 'Forecast details.',
      url: 'https://example.com/weather',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('searches images through DuckDuckGo and returns validated thumbnails with attribution links', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    requests.push(url);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    if (url.pathname === '/') {
      assert.equal(url.origin, 'https://duckduckgo.com');
      assert.equal(url.searchParams.get('q'), 'landing page');
      return new Response('<script>var vqd="image-token";</script>');
    }
    assert.equal(url.pathname, '/i.js');
    assert.equal(url.searchParams.get('vqd'), 'image-token');
    return new Response(JSON.stringify({
      results: [{
        title: 'Landing page reference',
        thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.image',
        url: 'https://www.pinterest.com/pin/123/',
      }],
    }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    assert.deepEqual(await searchChatImages('landing page'), [{
      title: 'Landing page reference',
      thumbnail: 'https://tse1.mm.bing.net/th/id/OIP.image',
      url: 'https://www.pinterest.com/pin/123/',
    }]);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
