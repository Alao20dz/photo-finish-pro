import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import type { ServerResponse, IncomingMessage } from "http";
import { WebSocketServer, type WebSocket as WsWebSocket } from "ws";
import * as security from "./server/security.js";
import { handleSyncRequest } from "./server/syncApi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  id: string;
  role: string;
  room: string;
  res: ServerResponse;
}

interface WsClient {
  id: string;
  role: string;
  room: string;
  sessionToken: string;
  ws: WsWebSocket;
  lastPing: number;
  latencyMs: number;
}

/**
 * إضافة خادم ترحيل محلي فائق السرعة (Local Race Relay Hub v2)
 * 
 * الطبقة الأولى: WebSocket ثنائي الاتجاه (كمون 1-3ms)
 *   - كل هاتف يفتح اتصال WS واحد دائم
 *   - الرسائل تمر عبر إطار واحد (single frame) بدل HTTP request/response
 *   - يدعم Session Token للتحقق من الصلاحية
 *   - مزامنة توقيت NTP مبسّطة عبر performance.now()
 * 
 * الطبقة الثانية: SSE + HTTP (احتياطي للمتصفحات القديمة)
 */
function raceRelayPlugin(): Plugin {
  const rooms = new Map<string, Map<string, ConnectedClient>>();
  const wsRooms = new Map<string, Map<string, WsClient>>();
  const roomSessions = new Map<string, string>(); // room → sessionToken
  const cpSignAttempts = new Map<string, { count: number; resetAt: number }>(); // ip → checkpoint-sign rate

  // توليد أو استرجاع Session Token للغرفة
  function getOrCreateSession(room: string): string {
    if (!roomSessions.has(room)) {
      const token = crypto.randomUUID ? crypto.randomUUID() : 
        `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
      roomSessions.set(room, token);
    }
    return roomSessions.get(room)!;
  }

  // بث رسالة WS لجميع العملاء في الغرفة عدا المرسل
  function wsBroadcast(room: string, senderId: string, data: any) {
    const roomClients = wsRooms.get(room);
    if (!roomClients) return 0;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let count = 0;
    roomClients.forEach((client) => {
      if (client.id !== senderId && client.ws.readyState === 1 /* OPEN */) {
        try {
          client.ws.send(payload);
          count++;
        } catch (e) { /* ignore dead connections */ }
      }
    });
    return count;
  }

  // الحصول على الأدوار النشطة في غرفة WS
  function getWsActiveRoles(room: string): string[] {
    const roomClients = wsRooms.get(room);
    if (!roomClients) return [];
    return Array.from(roomClients.values()).map(c => c.role);
  }

  const setupMiddleware = (server: any) => {
    // ═══════════════════════════════════════════════════
    // ██ WebSocket Server (الطبقة الأساسية الجديدة) ██
    // ═══════════════════════════════════════════════════
    if (server.httpServer) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (req: IncomingMessage, socket: any, head: Buffer) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        if (url.pathname === '/ws/relay') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws: WsWebSocket, req: IncomingMessage) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const room = (url.searchParams.get('room') || 'RACE-2026').toUpperCase();
        const role = url.searchParams.get('role') || 'viewer';
        const clientToken = url.searchParams.get('token') || '';
        const clientId = `ws-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // التحقق من Session Token (تحصين الجلسة):
        // - رمز صحيح = قبول دائماً
        // - رمز 'new' يُقبل فقط عند تهيئة الغرفة (أول جهاز) لمنع تداخل السباقات
        // - الأجهزة المرفوضة تتحول تلقائياً إلى MQTT السحابي مع بقاء المزامنة
        const sessionToken = getOrCreateSession(room);
        const roomIsEmpty = !wsRooms.has(room) || wsRooms.get(room)!.size === 0;
        const tokenValid = clientToken === sessionToken || (clientToken === 'new' && roomIsEmpty);

        if (!tokenValid) {
          ws.close(4001, 'Invalid session token');
          return;
        }

        // تسجيل العميل
        if (!wsRooms.has(room)) {
          wsRooms.set(room, new Map());
        }
        const roomClients = wsRooms.get(room)!;
        const client: WsClient = { 
          id: clientId, role, room, sessionToken, ws, 
          lastPing: Date.now(), latencyMs: 0 
        };
        roomClients.set(clientId, client);

        const activeRoles = getWsActiveRoles(room);

        // رسالة ترحيب فورية
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
          timestamp: Date.now()
        }));

        // إعلام بقية الهواتف بانضمام جهاز جديد
        wsBroadcast(room, clientId, {
          type: 'WS_PEER_JOINED',
          newRole: role,
          clientId,
          connectedRoles: activeRoles,
          clientCount: roomClients.size,
          timestamp: Date.now()
        });

        // استقبال الرسائل
        ws.on('message', (rawData: Buffer | string) => {
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
                echo: data.clientTime 
              }));
              return;
            }

            // بث الرسالة لبقية الغرفة
            const enriched = {
              ...data,
              _wsRelayed: true,
              _relayTime: Date.now()
            };
            wsBroadcast(room, clientId, enriched);
          } catch (e) {
            // تجاهل الرسائل غير الصالحة
          }
        });

        // قطع الاتصال
        ws.on('close', () => {
          roomClients.delete(clientId);
          const remainingRoles = getWsActiveRoles(room);
          wsBroadcast(room, clientId, {
            type: 'WS_PEER_LEFT',
            leftRole: role,
            clientId,
            connectedRoles: remainingRoles,
            clientCount: roomClients.size,
            timestamp: Date.now()
          });
          // تنظيف الغرف الفارغة
          if (roomClients.size === 0) {
            wsRooms.delete(room);
          }
        });

        ws.on('error', () => {
          roomClients.delete(clientId);
        });
      });

      // نبضات الحفاظ على الاتصال (كل 15 ثانية)
      setInterval(() => {
        wsRooms.forEach((roomClients) => {
          roomClients.forEach((client) => {
            if (client.ws.readyState === 1) {
              try {
                client.ws.ping();
              } catch (e) {
                roomClients.delete(client.id);
              }
            }
          });
        });
      }, 15000);
    }

    // ═══════════════════════════════════════════════
    // ██ HTTP/SSE Middleware (الطبقة الاحتياطية) ██
    // ═══════════════════════════════════════════════
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      // تفعيل CORS لجميع نقاط الـ API
      if (req.url?.startsWith('/api/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }
      }

      const host = req.headers.host || 'localhost';
      const parsedUrl = new URL(req.url || '', `http://${host}`);

      // 1. تدفق الأحداث الحية SSE (Server-Sent Events) — احتياطي
      if (parsedUrl.pathname === '/api/events') {
        const room = (parsedUrl.searchParams.get('room') || 'RACE-2026').toUpperCase();
        const role = parsedUrl.searchParams.get('role') || 'unknown';
        const clientId = `sse-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        if (!rooms.has(room)) {
          rooms.set(room, new Map());
        }
        const roomClients = rooms.get(room)!;
        const client: ConnectedClient = { id: clientId, role, room, res };
        roomClients.set(clientId, client);

        // دمج أدوار SSE + WS
        const sseRoles = Array.from(roomClients.values()).map(c => c.role);
        const wsActiveRoles = getWsActiveRoles(room);
        const allRoles = [...new Set([...sseRoles, ...wsActiveRoles])];

        res.write(`data: ${JSON.stringify({
          type: 'HUB_WELCOME',
          clientId,
          room,
          role,
          sessionToken: getOrCreateSession(room),
          connectedRoles: allRoles,
          clientCount: roomClients.size,
          timestamp: Date.now()
        })}\n\n`);

        roomClients.forEach((otherClient) => {
          if (otherClient.id !== clientId) {
            try {
              otherClient.res.write(`data: ${JSON.stringify({
                type: 'PEER_JOINED',
                newRole: role,
                clientId,
                connectedRoles: allRoles,
                clientCount: roomClients.size,
                timestamp: Date.now()
              })}\n\n`);
            } catch (e) {}
          }
        });

        const keepAlive = setInterval(() => {
          try { res.write(':keep-alive\n\n'); } catch (e) { clearInterval(keepAlive); }
        }, 10000);

        req.on('close', () => {
          clearInterval(keepAlive);
          roomClients.delete(clientId);
          const remainingRoles = Array.from(roomClients.values()).map(c => c.role);
          roomClients.forEach((otherClient) => {
            try {
              otherClient.res.write(`data: ${JSON.stringify({
                type: 'PEER_LEFT',
                leftRole: role,
                connectedRoles: remainingRoles,
                clientCount: roomClients.size,
                timestamp: Date.now()
              })}\n\n`);
            } catch (e) {}
          });
        });

        return;
      }

      // 2. بث الرسائل عبر HTTP POST — احتياطي
      if (parsedUrl.pathname === '/api/broadcast' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const room = (data.room || 'RACE-2026').toUpperCase();
            const senderClientId = data.senderClientId;
            const roomClients = rooms.get(room);

            let relayedCount = 0;
            if (roomClients) {
              const msgPayload = `data: ${JSON.stringify(data)}\n\n`;
              roomClients.forEach((client) => {
                if (client.id !== senderClientId) {
                  try {
                    client.res.write(msgPayload);
                    relayedCount++;
                  } catch (e) {}
                }
              });
            }

            // أيضاً بث عبر WS إذا متاح
            relayedCount += wsBroadcast(room, senderClientId || '', data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, relayedCount }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          }
        });
        return;
      }

      // 3. حالة الغرفة (تدمج SSE + WS)
      if (parsedUrl.pathname === '/api/room-status') {
        const room = (parsedUrl.searchParams.get('room') || 'RACE-2026').toUpperCase();
        const sseClients = rooms.get(room);
        const wsClients = wsRooms.get(room);
        
        const sseList = sseClients ? Array.from(sseClients.values()).map(c => ({ id: c.id, role: c.role, transport: 'sse' })) : [];
        const wsList = wsClients ? Array.from(wsClients.values()).map(c => ({ id: c.id, role: c.role, transport: 'ws', latency: c.latencyMs })) : [];
        const allClients = [...sseList, ...wsList];
        const roles = allClients.map(c => c.role);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          room,
          sessionToken: getOrCreateSession(room),
          count: allClients.length,
          roles,
          hasStart: roles.includes('start'),
          hasFinish: roles.includes('finish'),
          hasJudge: roles.includes('judge'),
          hasChambre: roles.includes('chambre_dappel'),
          clients: allClients,
          wsActive: (wsList.length > 0),
        }));
        return;
      }

      // 4. نقطة نهاية لإنشاء/استرجاع session token
      if (parsedUrl.pathname === '/api/session') {
        const room = (parsedUrl.searchParams.get('room') || 'RACE-2026').toUpperCase();
        const token = getOrCreateSession(room);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ room, sessionToken: token }));
        return;
      }

      // 5. جلب المفتاح العام Ed25519 للتحقق من التراخيص
      if (parsedUrl.pathname === '/api/public-key' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, publicKeyBase64: security.getPublicKeyBase64() }));
        return;
      }

      // 6. تسجيل دخول المدير الآمن (Rate-Limited Admin Login)
      if (parsedUrl.pathname === '/api/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
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

      // 7. توليد كود ترخيص موقع بـ Ed25519
      if (parsedUrl.pathname === '/api/admin/generate-license' && req.method === 'POST') {
        const authHeader = (req.headers['authorization'] || '').toString();
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!security.verifyAdminToken(token)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Invalid admin token' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
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

      // 8. توقيع رموز نقاط المراقبة Ed25519 (Checkpoint QR Signing)
      // النص القياسي يُوقّع خادمياً حصراً — لا يوجد أي سر في حزمة الواجهة.
      // محمي بحد معدل لكل IP (تخفيف إساءة حتى ربطه بمصادقة الأدوار في منصة Supabase).
      if (parsedUrl.pathname === '/api/checkpoint/sign' && req.method === 'POST') {
        const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        const now = Date.now();
        const rec = cpSignAttempts.get(clientIp) || { count: 0, resetAt: now + 3600_000 };
        if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 3600_000; }
        rec.count++;
        cpSignAttempts.set(clientIp, rec);
        if (rec.count > 120) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'تم تجاوز حد توقيع رموز نقاط المراقبة لهذه الساعة.' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            const { cid, cpid, code, km, iat, exp } = JSON.parse(body || '{}');
            if (!cid || !cpid || !code || typeof km !== 'number' || typeof iat !== 'number' || typeof exp !== 'number') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'حمولة توقيع غير مكتملة (cid, cpid, code, km, iat, exp)' }));
              return;
            }
            if (exp <= iat || exp - iat > 30 * 86400_000) {
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

      // 9. مزامنة offline-first: دفتر إلغاء التكرار + الاسترجاع + النسخ الاحتياطي
      if (parsedUrl.pathname.startsWith('/api/sync/') ||
          parsedUrl.pathname.startsWith('/api/backup/') ||
          parsedUrl.pathname === '/api/audit') {
        const isPost = req.method === 'POST';
        if (!isPost) {
          const result = handleSyncRequest({
            pathname: parsedUrl.pathname,
            searchParams: parsedUrl.searchParams,
            method: req.method || 'GET',
            body: null,
            getOrCreateSession,
            verifyAdminToken: (t: string) => security.verifyAdminToken(t)
          });
          if (result) {
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.json));
            return;
          }
        } else {
          let raw = '';
          req.on('data', (chunk: any) => { raw += chunk; });
          req.on('end', () => {
            let parsedBody: any = null;
            try { parsedBody = JSON.parse(raw || '{}'); } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
              return;
            }
            const result = handleSyncRequest({
              pathname: parsedUrl.pathname,
              searchParams: parsedUrl.searchParams,
              method: 'POST',
              body: parsedBody,
              getOrCreateSession,
              verifyAdminToken: (t: string) => security.verifyAdminToken(t)
            });
            if (result) {
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.json));
              return;
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Not found' }));
          });
          return;
        }
      }

      next();
    });
  };

  return {
    name: 'race-relay-plugin',
    configureServer(server) {
      setupMiddleware(server);
    },
    configurePreviewServer(server) {
      setupMiddleware(server);
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), raceRelayPlugin()],
  server: {
    host: true, // يتيح الاتصال من الهواتف عبر شبكة الـ Wi-Fi المحلية
    port: 5173,
    allowedHosts: true, // يسمح بالاتصال عبر القنوات الآمنة والأنفاق دون 403
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
