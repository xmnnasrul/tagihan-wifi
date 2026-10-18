const { createServer } = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
const publishSecret = process.env.SOCKET_PUBLISH_SECRET;
const allowedOrigins = new Set(
  (process.env.APP_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (!allowedOrigins.size) {
  console.error('APP_ORIGIN wajib diisi');
  process.exit(1);
}

if (!jwtSecret) {
  console.error('JWT_SECRET wajib diisi');
  process.exit(1);
}

if (!publishSecret) {
  console.error('SOCKET_PUBLISH_SECRET wajib diisi');
  process.exit(1);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function hasValidPublishSecret(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;

  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(publishSecret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw Object.assign(new Error('Body terlalu besar'), { status: 413 });
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isAdminChatUpdatePayload(userIds) {
  return Array.isArray(userIds) && userIds.length > 0 && userIds.length <= 100 &&
    userIds.every((userId) => typeof userId === 'string' && /^[a-f\d]{24}$/i.test(userId)) &&
    new Set(userIds).size === userIds.length;
}

const httpServer = createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    response.end('ok');
    return;
  }

  if (request.method === 'POST' && request.url === '/internal/chat-events') {
    if (!hasValidPublishSecret(request.headers.authorization)) {
      sendJson(response, 401, { error: 'Tidak diizinkan' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : 400;
      sendJson(response, status, { error: 'Body event tidak valid' });
      return;
    }

    if (body?.event !== 'admin-chat.updated' || !isAdminChatUpdatePayload(body.userIds)) {
      sendJson(response, 400, { error: 'Event tidak valid' });
      return;
    }

    io.to(body.userIds.map((userId) => `admin:${userId}`)).emit('admin-chat:updated');
    sendJson(response, 202, { accepted: true });
    return;
  }

  response.writeHead(404);
  response.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: [...allowedOrigins],
    methods: ['GET', 'POST'],
  },
  allowRequest: (request, callback) => {
    callback(null, allowedOrigins.has(request.headers.origin));
  },
});

io.use((socket, next) => {
  const ticket = socket.handshake.auth?.ticket;
  if (typeof ticket !== 'string') {
    next(new Error('Autentikasi diperlukan'));
    return;
  }

  try {
    const payload = jwt.verify(ticket, jwtSecret, {
      algorithms: ['HS256'],
      audience: 'wifi-billing-socket',
    });

    if (
      typeof payload === 'string' ||
      payload.purpose !== 'socket-ticket' ||
      typeof payload.userId !== 'string' || !/^[a-f\d]{24}$/i.test(payload.userId) ||
      typeof payload.username !== 'string' ||
      typeof payload.role !== 'string' ||
      !Array.isArray(payload.roles) || !payload.roles.includes('admin') ||
      typeof payload.exp !== 'number'
    ) {
      next(new Error('Tiket socket tidak valid'));
      return;
    }

    socket.data.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      roles: payload.roles,
      tokenVersion: payload.tokenVersion,
    };
    socket.data.ticketExpiresAt = payload.exp * 1000;
    next();
  } catch {
    next(new Error('Tiket socket tidak valid atau sudah kedaluwarsa'));
  }
});

io.on('connection', (socket) => {
  socket.join(`admin:${socket.data.user.userId}`);

  const disconnectTimer = setTimeout(() => socket.disconnect(true), Math.max(socket.data.ticketExpiresAt - Date.now(), 0));
  socket.once('disconnect', () => clearTimeout(disconnectTimer));
  console.log(`Socket terhubung: ${socket.id}`);
  socket.emit('connected', { ok: true });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Socket.IO berjalan pada port ${port}`);
});