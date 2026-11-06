/**
 * Photo Finish Pro — خادم الترحيل السحابي (Cloud Race Relay Hub v1)
 * ================================================================
 * 
 * نسخة قابلة للنشر من خادم الترحيل المحلي المدمج في vite.config.ts.
 * نفس البروتوكول تماماً — يكفي نشره مرة واحدة ثم ضبط متغير البيئة:
 *   VITE_RELAY_WS_URL=wss://<your-relay-host>
 * في مشروع Vercel، ليعمل بكامون 5-30ms عبر الإنترنت بين كل الهواتف.
 * 
 * النشر المجاني في دقيقتين: Railway / Render / Fly.io (انظر README.md)
 * 
 * البروتوكول:
 *   WS: /ws/relay?room=<ROOM>&role=<ROLE>&token=<SESSION_TOKEN|new>
 *   HTTP: GET / (health check)
 */

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const security = require('./security');

// واجهة المزامنة الخلفية (ESM مشترك مع نسخة Vite) — استيراد ديناميكي من CJS
let syncApi = null;
import('../server/syncApi.js')
  .then((mod) => {
    syncApi = mod;
    console.log('[PhotoFinishRelay] ✅ Sync API ready (offline-first ingest/replay/backup)');
  })
  .catch((e) => {
    console.warn('[PhotoFinishRelay] ⚠️ Sync API unavailable:', e?.message || e);
  });

const PORT = process.env.PORT || 8080;

// ═══ حالة الخادم ═══
/** room → Map<clientId, WsClient> */
const wsRooms = new Map();
/** room → sessionToken */
const roomSessions = new Map();
/** ip → { count, resetAt } لتحديد معدل توقيع رموز نقاط المراقبة */
const cpSignAttempts = new Map();

function makeClient(id, role, room, sessionToken, ws) {
  return {
    id, role, room, sessionToken, ws,
    lastPing: Date.now(),
    isAlive: true,
  };
}

function getOrCreateSession(room) {
  if (!roomSessions.has(room)) {
    const token = crypto.randomUUID();
    roomSessions.set(room, token);
  }
  return roomSessions.get(room);
}

function wsBroadcast(room, senderId, data) {
  const roomClients = wsRooms.get(room);
  if (!roomClients) return 0;
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  let count = 0;
  roomClients.forEach((client) => {
    if (client.id !== senderId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
        count++;
      } catch (e) { /* تجاهل الاتصالات الميتة */ }
    }
  });
  return count;
}

function getWsActiveRoles(room) {
  const roomClients = wsRooms.get(room);
  if (!roomClients) return [];
  return Array.from(roomClients.values()).map((c) => c.role);
}

// ═══ خادم HTTP (فحص الصحة + أمان وتراخيص Ed25519 + مزامنة offline-first) ═══
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

  // 1. فحص الصحة (Health Check)
  if (url.pathname === '/' || url.pathname === '/health') {
    const rooms = [];
    wsRooms.forEach((clients, room) => {
      rooms.push({ room, clients: clients.size, roles: getWsActiveRoles(room) });
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'photo-finish-relay',
      version: '2.0.0',
      uptimeSec: Math.floor(process.uptime()),
      rooms,
      sessionCount: roomSessions.size,
      serverTime: Date.now(),
    }));
    return;
  }

  // 2. جلب المفتاح العام Ed25519 للتحقق من التراخيص أوفلاين
  if (url.pathname === '/api/public-key' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      publicKeyBase64: security.getPublicKeyBase64()
    }));
    return;
  }

  // 3. جلسة الغرفة ورمز الحماية (Session Token)
  if (url.pathname === '/api/session' && req.method === 'GET') {
    const room = (url.searchParams.get('room') || 'RACE-2026').toUpperCase();
    const token = getOrCreateSession(room);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ room, sessionToken: token }));
    return;
  }

  // 3-b. توقيع رموز نقاط المراقبة Ed25519 (Checkpoint QR Signing)
  // النص القياسي يُوقّع خادمياً حصراً — لا يوجد أي سر في حزمة الواجهة.
  // محمي بحد معدل لكل IP (حتى ربطه بمصادقة الأدوار في منصة Supabase).
  if (url.pathname === '/api/checkpoint/sign' && req.method === 'POST') {
    const now = Date.now();
    const rec = cpSignAttempts.get(clientIp) || { count: 0, resetAt: now + 3600000 };
    if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 3600000; }
    rec.count++;
    cpSignAttempts.set(clientIp, rec);
    if (rec.count > 120) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'تم تجاوز حد توقيع رموز نقاط المراقبة لهذه الساعة.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { cid, cpid, code, km, iat, exp } = JSON.parse(body || '{}');
        if (!cid || !cpid || !code || typeof km !== 'number' || typeof iat !== 'number' || typeof exp !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'حمولة توقيع غير مكتملة (cid, cpid, code, km, iat, exp)' }));
          return;
        }
        if (exp <= iat || exp - iat > 30 * 86400000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'مدة صلاحية رمز غير مقبولة (الحد الأقصى 30 يوماً).' }));
          return;
        }
        const signature = security.signCheckpointQr({ cid, cpid, code, km, iat, exp });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, signature }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 4. تسجيل دخول المدير الآمن (Rate-Limited Admin Login)
  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const result = security.verifyAdminLogin(parsed.password, clientIp);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 5. توليد كود ترخيص Ed25519 موقع رسمياً (Admin License Generator)
  if (url.pathname === '/api/admin/generate-license' && req.method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!security.verifyAdminToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Invalid admin token' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { tier, expCode, devHash } = JSON.parse(body || '{}');
        if (!tier || !expCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing tier or expCode' }));
          return;
        }
        const licenseCode = security.generateEd25519License(tier, expCode, devHash || 'POOL');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, licenseCode }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 6. مزامنة offline-first (Idempotent Ingest / Replay / Backup / Audit)
  if (
    syncApi && (
      url.pathname.startsWith('/api/sync/') ||
      url.pathname.startsWith('/api/backup/') ||
      url.pathname === '/api/audit'
    )
  ) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await syncApi.handleSyncRequest({
            pathname: url.pathname,
            searchParams: url.searchParams,
            method: 'POST',
            body: parsed,
            getOrCreateSession,
            verifyAdminToken: (t) => security.verifyAdminToken(t),
          });
          if (result) {
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.json));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Not found' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    const result = await syncApi.handleSyncRequest({
      pathname: url.pathname,
      searchParams: url.searchParams,
      method: req.method,
      body: null,
      getOrCreateSession,
      verifyAdminToken: (t) => security.verifyAdminToken(t),
    });
    if (result) {
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.json));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

// ═══ خادم WebSocket ═══
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/ws/relay') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, url);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req, url) => {
  const room = (url.searchParams.get('room') || 'RACE-2026').toUpperCase();
  const role = url.searchParams.get('role') || 'viewer';
  const clientToken = url.searchParams.get('token') || '';
  const clientId = `ws-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // التحقق من Session Token (نفس منطق التحصين في نسخة Vite المحلية):
  // - رمز صحيح = قبول دائماً
  // - رمز 'new' يُقبل فقط عند تهيئة الغرفة (أول جهاز)
  // - الأجهزة المرفوضة تتحول تلقائياً إلى MQTT السحابي مع بقاء المزامنة
  const sessionToken = getOrCreateSession(room);
  const roomIsEmpty = !wsRooms.has(room) || wsRooms.get(room).size === 0;
  const tokenValid = clientToken === sessionToken || (clientToken === 'new' && roomIsEmpty);

  if (!tokenValid) {
    ws.close(4001, 'Invalid session token');
    return;
  }

  // تسجيل العميل
  if (!wsRooms.has(room)) wsRooms.set(room, new Map());
  const roomClients = wsRooms.get(room);
  const client = makeClient(clientId, role, room, sessionToken, ws);
  roomClients.set(clientId, client);

  const activeRoles = getWsActiveRoles(room);

  // رسالة ترحيب فورية (نفس شكل WS_WELCOME في نسخة Vite)
  ws.send(JSON.stringify({
    type: 'WS_WELCOME',
    clientId,
    room,
    role,
    sessionToken,
    connectedRoles: activeRoles,
    clientCount: roomClients.size,
    serverTime: Date.now(),
    serverPerfOrigin: performance.now(),
    timestamp: Date.now(),
  }));

  // إعلام بقية الهواتف بانضمام جهاز جديد
  wsBroadcast(room, clientId, {
    type: 'WS_PEER_JOINED',
    newRole: role,
    clientId,
    connectedRoles: activeRoles,
    clientCount: roomClients.size,
    timestamp: Date.now(),
  });

  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // مزامنة التوقيت NTP-style
      if (data.type === 'WS_TIME_SYNC_REQ') {
        ws.send(JSON.stringify({
          type: 'WS_TIME_SYNC_RESP',
          clientSendTime: data.clientSendTime,
          clientPerfSend: data.clientPerfSend,
          serverRecvTime: Date.now(),
          serverPerfRecv: performance.now(),
          serverSendTime: Date.now(),
          serverPerfSend: performance.now(),
        }));
        return;
      }

      // نبضة حية
      if (data.type === 'WS_PING') {
        client.lastPing = Date.now();
        ws.send(JSON.stringify({
          type: 'WS_PONG',
          serverTime: Date.now(),
          echo: data.clientTime,
        }));
        return;
      }

      // بث الرسالة لبقية الغرفة (مع توقيع الترحيل)
      wsBroadcast(room, clientId, {
        ...data,
        _wsRelayed: true,
        _relayTime: Date.now(),
      });
    } catch (e) {
      // تجاهل الرسائل غير الصالحة
    }
  });

  ws.on('pong', () => {
    client.isAlive = true;
    client.lastPing = Date.now();
  });

  ws.on('close', () => {
    roomClients.delete(clientId);
    const remainingRoles = getWsActiveRoles(room);
    wsBroadcast(room, clientId, {
      type: 'WS_PEER_LEFT',
      leftRole: role,
      clientId,
      connectedRoles: remainingRoles,
      clientCount: roomClients.size,
      timestamp: Date.now(),
    });
    if (roomClients.size === 0) {
      wsRooms.delete(room);
      // الاحتفاظ برمز الجلسة ساعتين للسماح بإعادة الاتصال، ثم تنظيفه تلقائياً
      setTimeout(() => {
        const stillEmpty = !wsRooms.has(room) || wsRooms.get(room).size === 0;
        if (stillEmpty && roomSessions.get(room) === sessionToken) {
          roomSessions.delete(room);
        }
      }, 2 * 60 * 60 * 1000);
    }
  });

  ws.on('error', () => {
    roomClients.delete(clientId);
  });
});

// ═══ نبضات الحفاظ على الاتصال (كل 15 ثانية) ═══
setInterval(() => {
  wsRooms.forEach((roomClients) => {
    roomClients.forEach((client, id) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!client.isAlive) {
          try { client.ws.terminate(); } catch (e) {}
          roomClients.delete(id);
          return;
        }
        client.isAlive = false;
        try { client.ws.ping(); } catch (e) {
          roomClients.delete(id);
        }
      }
    });
  });
}, 15000);

server.listen(PORT, () => {
  console.log(`[PhotoFinishRelay] ✅ Cloud relay hub running on port ${PORT}`);
  console.log(`[PhotoFinishRelay] WS endpoint: ws://<host>/ws/relay?room=<ROOM>&role=<ROLE>&token=<TOKEN|new>`);
});
