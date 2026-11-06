/**
 * شبكة الاتصال الهجينة الذكية v2 (Smart Hybrid Network v2)
 * 
 * ترتيب الأولوية:
 * - الطبقة 1 (أساسية): WebSocket محلي ثنائي الاتجاه (/ws/relay) — كمون 1-3ms
 * - الطبقة 2: قناة البث المحلي BroadcastChannel — نفس الجهاز فقط
 * - الطبقة 3: جسر WebRTC عبر PeerJS + STUN/TURN
 * - الطبقة 4 (احتياطي): سحابة MQTT عبر broker.emqx.io (شبكات 4G/5G)
 * - الطبقة 5 (احتياطي): SSE + HTTP POST (المتصفحات القديمة)
 * 
 * تدعم الهواتف الأربعة:
 * 1. هاتف البداية ومسدس الانطلاق (START)
 * 2. هاتف كاميرا خط النهاية (FINISH)
 * 3. هاتف الحكم العام وإحصاء النتائج (JUDGE)
 * 4. هاتف غرفة النداء وتسجيل القوائم (CHAMBRE D'APPEL)
 */

import mqtt, { MqttClient } from 'mqtt';
import Peer, { DataConnection } from 'peerjs';
import { NetworkPeerMessage, PhoneRole } from '../types/race';
import {
  isMessagePermitted,
  computeMessageHmac,
  verifyMessageHmac,
  encryptJsonPayload,
  decryptJsonPayload,
  throttledSecurityLog
} from './securityService';
import { syncQueueService } from './syncQueueService';

export type ConnectionMode = 'local_ws' | 'cloud_mqtt' | 'webrtc_bridge' | 'local_hub' | 'local_broadcast' | 'dual_sync' | 'internet_bridge' | 'sync_replay' | 'disconnected';

export interface ConnectionQuality {
  localWsConnected: boolean;
  localWsLatency: number;
  mqttConnected: boolean;
  mqttLatency: number;
  webRtcPeers: number;
  sseConnected: boolean;
  clockOffset: number;
  syncAccuracy: 'excellent' | 'good' | 'fair' | 'poor';
}

export class AthleticsNetworkService {
  // ═══ قنوات الاتصال ═══
  private localWs: WebSocket | null = null;
  private mqttClient: MqttClient | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private sseSource: EventSource | null = null;
  private recentMessageIds: Set<string> = new Set();

  // ═══ معلومات الجلسة ═══
  public roomCode: string = 'RACE-2026';
  public sessionToken: string = '';
  public role: PhoneRole = null;
  public myAddress: string = '';
  public targetAddresses: string[] = [];
  public targetAddress: string = '';
  public hubClientId: string = '';
  public wsClientId: string = '';

  // ═══ حالة الاتصال ═══
  public latencyMs: number = 0;
  public wsLatencyMs: number = 0;
  public mqttLatencyMs: number = 0;
  public clockOffsetMs: number = 0;
  public isConnected: boolean = false;
  public mqttConnected: boolean = false;
  public localWsConnected: boolean = false;
  public cloudBridgeActive: boolean = false;
  public localHubActive: boolean = false;
  public connectionMode: ConnectionMode = 'disconnected';
  public connectionStatusText: string = 'جاري التهيئة...';
  public connectedCount: number = 0;
  public connectedRoles: string[] = [];

  // ═══ هواتف متصلة ═══
  public hasStartPhone: boolean = false;
  public hasFinishPhone: boolean = false;
  public hasJudgePhone: boolean = false;
  public hasChambrePhone: boolean = false;

  // ═══ التوقيت الدقيق ═══
  private perfOrigin: number = performance.now();
  private timeSyncSamples: { offset: number; rtt: number }[] = [];
  public timeSyncAccuracy: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';

  // ═══ Callbacks ═══
  private onMessageCallback: ((msg: NetworkPeerMessage) => void) | null = null;
  private onStatusChangeCallback: ((connected: boolean, latency: number, mode: ConnectionMode) => void) | null = null;
  private heartbeatInterval: any = null;
  private wsReconnectTimer: any = null;
  private timeSyncInterval: any = null;
  private pingStartTime: number = 0;

  constructor() {
    try {
      this.broadcastChannel = new BroadcastChannel('athletics_photo_finish_v4');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && this.onMessageCallback) {
          void this.handleIncomingMessage(event.data, 'local_broadcast');
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  public init(
    role: PhoneRole,
    roomCode: string = 'RACE-2026',
    onMessage: (msg: NetworkPeerMessage) => void,
    onStatusChange?: (connected: boolean, latency: number, mode: ConnectionMode) => void,
    customAddress?: string
  ) {
    this.role = role;
    this.roomCode = roomCode.trim().toUpperCase() || 'RACE-2026';
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange || null;
    this.perfOrigin = performance.now();

    const prefix = 'APF';
    const rand = Math.floor(100 + Math.random() * 900);
    const startAddr = `${prefix}-START-${this.roomCode}`;
    const finishAddr = `${prefix}-FINISH-${this.roomCode}`;
    const judgeAddr = `${prefix}-JUDGE-${this.roomCode}`;
    const chambreAddr = `${prefix}-CALLROOM-${this.roomCode}`;

    if (customAddress && customAddress.trim()) {
      this.myAddress = customAddress.trim().toUpperCase();
    } else {
      if (this.role === 'start') this.myAddress = `${startAddr}-${rand}`;
      else if (this.role === 'finish') this.myAddress = `${finishAddr}-${rand}`;
      else if (this.role === 'judge') this.myAddress = `${judgeAddr}-${rand}`;
      else if (this.role === 'chambre_dappel') this.myAddress = `${chambreAddr}-${rand}`;
      else this.myAddress = `${prefix}-VIEW-${this.roomCode}-${rand}`;
    }

    // تحديد العناوين المستهدفة للهواتف الأخرى
    this.targetAddresses = [startAddr, finishAddr, judgeAddr, chambreAddr];
    this.targetAddress = finishAddr;

    // ═══ ترتيب التهيئة حسب الأولوية ═══

    // 1. WebSocket المحلي (الطبقة الأساسية الجديدة — كمون 1-3ms)
    this.setupLocalWebSocket();

    // 2. سحابة MQTT (احتياطي للشبكات البعيدة 4G/5G)
    this.setupMqttCloud();

    // 3. جسر WebRTC P2P
    this.setupPeerConnection();

    // 4. SSE المحلي (احتياطي للمتصفحات القديمة)
    this.setupLocalRelayHub();

    // 5. نبضات الحياة
    this.startHeartbeat();

    // 6. مزامنة التوقيت المتقدمة
    this.startTimeSync();

    // 7. طابور المزامنة الدائم (offline-first: صفر فقدان/تكرار بعد الانقطاع)
    syncQueueService.configure(this.roomCode, this.sessionToken);
    syncQueueService.setPullCallback((msg) => {
      // رسائل الاسترجاع من الخادم تعبر البوابة الأمنية نفسها (توقيع/مصفوفة/إلغاء تكرار)
      void this.handleIncomingMessage(msg, 'sync_replay');
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline);
    }
  }

  private handleNetworkOnline = () => {
    // العودة من الانقطاع: ادفع ما تراكم + اسحب ما فاتنا من الخادم
    syncQueueService.configure(this.roomCode, this.sessionToken);
    void syncQueueService.flush(true);
    void syncQueueService.pullReplay(true);
  };

  // ═══════════════════════════════════════════════════
  // ██ الطبقة 1: WebSocket المحلي (الأساسي)       ██
  // ═══════════════════════════════════════════════════

  private setupLocalWebSocket() {
    if (this.localWs) {
      try { this.localWs.close(); } catch (e) {}
      this.localWs = null;
    }

    try {
      // دعم خادم ترحيل سحابي مخصص عبر متغير البيئة VITE_RELAY_WS_URL
      // مثال: VITE_RELAY_WS_URL=wss://my-relay.up.railway.app
      // عند غيابه يُستخدم نفس المضيف (يعمل مع npm run dev / vite preview محلياً)
      const envRelay = (import.meta.env.VITE_RELAY_WS_URL || '').trim().replace(/\/+$/, '');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const base = envRelay || `${protocol}//${location.host}`;
      const params = new URLSearchParams({
        room: this.roomCode,
        role: this.role || 'viewer',
        token: this.sessionToken || 'new'
      });
      const wsUrl = `${base}/ws/relay?${params.toString()}`;

      this.localWs = new WebSocket(wsUrl);

      this.localWs.onopen = () => {
        console.log('[WS] ✅ Connected to local relay');
        this.localWsConnected = true;
        this.updateConnectionState();
      };

      this.localWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // رسالة ترحيب — استقبال Session Token و Client ID
          if (data.type === 'WS_WELCOME') {
            this.wsClientId = data.clientId;
            this.sessionToken = data.sessionToken || this.sessionToken;
            this.connectedRoles = data.connectedRoles || [];
            this.localWsConnected = true;
            syncQueueService.configure(this.roomCode, this.sessionToken);
            this.updateConnectionState();

            // عودة الاتصال المحلي: ادفع رصيد الطابور + عوّض أي فجوة زمنية
            void syncQueueService.flush(true);
            void syncQueueService.pullReplay();

            // طلب مزامنة الحالة من بقية الهواتف
            // (عبر sendMessage ليُوقّع بـ HMAC ويحمل معرف رسالة فريداً)
            void this.sendMessage({
              type: 'REQUEST_STATE_SYNC',
              timestamp: Date.now(),
              senderTime: Date.now(),
              perfNow: performance.now() - this.perfOrigin,
              payload: { fromRole: this.role, peerId: this.myAddress }
            });
            return;
          }

          // انضمام/مغادرة عبر WS
          if (data.type === 'WS_PEER_JOINED' || data.type === 'WS_PEER_LEFT') {
            this.connectedRoles = data.connectedRoles || [];
            this.updateConnectionState();
            return;
          }

          // استجابة مزامنة التوقيت NTP
          if (data.type === 'WS_TIME_SYNC_RESP') {
            this.processTimeSyncResponse(data);
            return;
          }

          // نبضة حية WS
          if (data.type === 'WS_PONG') {
            const now = Date.now();
            this.wsLatencyMs = Math.max(1, Math.round((now - (data.echo || now)) / 2));
            this.latencyMs = this.wsLatencyMs;
            this.updateConnectionState();
            return;
          }

          // رسالة عادية
          void this.handleIncomingMessage(data, 'local_ws');
        } catch (e) {
          console.warn('[WS] Parse error:', e);
        }
      };

      this.localWs.onclose = () => {
        this.localWsConnected = false;
        this.updateConnectionState();
        // محاولة إعادة الاتصال تلقائياً
        if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => this.setupLocalWebSocket(), 2000);
      };

      this.localWs.onerror = () => {
        this.localWsConnected = false;
        this.updateConnectionState();
      };
    } catch (e) {
      console.warn('[WS] Init notice:', e);
    }
  }

  private sendViaLocalWs(data: any): boolean {
    if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
      try {
        const enriched = {
          ...data,
          _senderId: this.myAddress,
          _senderRole: this.role,
          _room: this.roomCode,
          _wsClientId: this.wsClientId,
        };
        this.localWs.send(JSON.stringify(enriched));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════
  // ██ الطبقة 4: سحابة MQTT (احتياطي 4G/5G)       ██
  // ═══════════════════════════════════════════════════

  private setupMqttCloud() {
    if (this.mqttClient) {
      try { this.mqttClient.end(true); } catch (e) {}
      this.mqttClient = null;
    }

    const sessionScope = (this.sessionToken || 'GLOBAL').slice(0, 8);
    const topic = `pfp/rooms/${this.roomCode}/${sessionScope}/events`;
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId: `apf_${this.role || 'device'}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500,
        keepalive: 30,
      });

      this.mqttClient.on('connect', () => {
        this.mqttConnected = true;
        this.mqttClient?.subscribe(topic, { qos: 0 });
        this.updateConnectionState();

        // إعلان الانضمام وطلب مزامنة الحالة الكاملة
        this.sendMessage({
          type: 'REQUEST_STATE_SYNC',
          timestamp: Date.now(),
          senderTime: Date.now(),
          payload: { fromRole: this.role, peerId: this.myAddress }
        });
      });

      this.mqttClient.on('message', (_t, payload) => {
        try {
          const parsed = JSON.parse(payload.toString());
          // تجاهل الرسائل الصادرة من نفس الجهاز
          if (parsed._senderId === this.myAddress) return;
          void this.handleIncomingMessage(parsed, 'cloud_mqtt');
        } catch (e) {
          console.warn('[MQTT] Parse error:', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('[MQTT] Connection notice:', err);
      });

      this.mqttClient.on('close', () => {
        this.mqttConnected = false;
        this.updateConnectionState();
      });
    } catch (e) {
      console.warn('[MQTT] Init notice:', e);
    }
  }

  // ═══════════════════════════════════════════════════
  // ██ الطبقة 3: جسر WebRTC P2P                    ██
  // ═══════════════════════════════════════════════════

  private setupPeerConnection() {
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:openrelay.metered.ca:80' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];

    try {
      this.peer = new Peer(this.myAddress, {
        debug: 1,
        config: { iceServers }
      });

      this.peer.on('open', (id) => {
        this.myAddress = id;
        this.cloudBridgeActive = true;
        this.updateConnectionState();
        this.connectToAllTargets();
      });

      this.peer.on('connection', (conn) => {
        this.attachConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          const fallbackId = `${this.myAddress}-${Math.floor(100 + Math.random() * 900)}`;
          this.myAddress = fallbackId;
          setTimeout(() => this.setupPeerConnection(), 800);
        }
      });

      this.peer.on('disconnected', () => {
        this.cloudBridgeActive = false;
        this.updateConnectionState();
        try { this.peer?.reconnect(); } catch (e) {}
      });
    } catch (err) {
      console.warn('[WebRTC] Notice:', err);
    }
  }

  // ═══════════════════════════════════════════════════
  // ██ الطبقة 5: SSE المحلي (احتياطي)              ██
  // ═══════════════════════════════════════════════════

  private setupLocalRelayHub() {
    if (this.sseSource) {
      try { this.sseSource.close(); } catch (e) {}
      this.sseSource = null;
    }

    try {
      const sseUrl = `/api/events?room=${encodeURIComponent(this.roomCode)}&role=${encodeURIComponent(this.role || 'viewer')}`;
      this.sseSource = new EventSource(sseUrl);

      this.sseSource.onopen = () => {
        this.localHubActive = true;
        this.updateConnectionState();
      };

      this.sseSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'HUB_WELCOME') {
            this.hubClientId = parsed.clientId;
            this.localHubActive = true;
            if (parsed.sessionToken) this.sessionToken = parsed.sessionToken;
            this.connectedRoles = parsed.connectedRoles || [];
            this.updateConnectionState();
            return;
          }
          if (parsed.type === 'PEER_JOINED' || parsed.type === 'PEER_LEFT') {
            this.connectedRoles = parsed.connectedRoles || [];
            this.updateConnectionState();
            return;
          }
          void this.handleIncomingMessage(parsed, 'local_hub');
        } catch (e) {}
      };

      this.sseSource.onerror = () => {
        this.localHubActive = false;
        this.updateConnectionState();
      };
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════
  // ██ مزامنة التوقيت NTP-Style                     ██
  // ═══════════════════════════════════════════════════

  private startTimeSync() {
    if (this.timeSyncInterval) clearInterval(this.timeSyncInterval);

    // مزامنة أولية (3 نبضات متتالية سريعة)
    let initialCount = 0;
    const initialSync = setInterval(() => {
      this.sendTimeSyncRequest();
      initialCount++;
      if (initialCount >= 3) clearInterval(initialSync);
    }, 500);

    // مزامنة دورية (كل 10 ثوانٍ)
    this.timeSyncInterval = setInterval(() => {
      this.sendTimeSyncRequest();
    }, 10000);
  }

  private sendTimeSyncRequest() {
    if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
      this.localWs.send(JSON.stringify({
        type: 'WS_TIME_SYNC_REQ',
        clientSendTime: Date.now(),
        clientPerfSend: performance.now() - this.perfOrigin,
      }));
    }
  }

  private processTimeSyncResponse(data: any) {
    const clientRecvTime = Date.now();
    const rtt = clientRecvTime - data.clientSendTime;
    const serverTime = (data.serverRecvTime + data.serverSendTime) / 2;
    const offset = serverTime - (data.clientSendTime + rtt / 2);

    this.timeSyncSamples.push({ offset, rtt });
    // الاحتفاظ بآخر 10 عينات فقط
    if (this.timeSyncSamples.length > 10) {
      this.timeSyncSamples.shift();
    }

    // حساب الإزاحة المتوسطة (median) — أكثر دقة من المتوسط الحسابي
    const sortedByRtt = [...this.timeSyncSamples].sort((a, b) => a.rtt - b.rtt);
    // أخذ أفضل 5 عينات (أقل RTT)
    const bestSamples = sortedByRtt.slice(0, Math.min(5, sortedByRtt.length));
    const medianOffset = bestSamples[Math.floor(bestSamples.length / 2)].offset;

    this.clockOffsetMs = Math.round(medianOffset);
    this.wsLatencyMs = Math.max(1, Math.round(rtt / 2));
    this.latencyMs = this.wsLatencyMs;

    // تصنيف دقة المزامنة
    const bestRtt = sortedByRtt[0].rtt;
    if (bestRtt < 5) this.timeSyncAccuracy = 'excellent';
    else if (bestRtt < 15) this.timeSyncAccuracy = 'good';
    else if (bestRtt < 50) this.timeSyncAccuracy = 'fair';
    else this.timeSyncAccuracy = 'poor';

    this.updateConnectionState();
  }

  // ═══════════════════════════════════════════════════
  // ██ WebRTC Helpers                                ██
  // ═══════════════════════════════════════════════════

  public connectToAllTargets() {
    if (!this.peer || this.peer.disconnected) return;
    this.targetAddresses.forEach(addr => {
      if (!this.connections.has(addr)) {
        this.connectToTargetAddress(addr);
      }
    });
  }

  public connectToTargetAddress(targetAddr: string) {
    if (!this.peer || !targetAddr) return;
    const cleaned = targetAddr.trim().toUpperCase();
    if (cleaned === this.myAddress) return;

    try {
      const conn = this.peer.connect(cleaned, { reliable: true });
      this.attachConnection(conn);
    } catch (e) {}
  }

  private attachConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.updateConnectionState();
      conn.send({
        type: 'REQUEST_STATE_SYNC',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: { fromRole: this.role }
      });
    });

    conn.on('data', (data: any) => {
      void this.handleIncomingMessage(data, 'webrtc_bridge');
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updateConnectionState();
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.updateConnectionState();
    });
  }

  // ═══════════════════════════════════════════════════
  // ██ إرسال الرسائل (ذكي حسب الأولوية)            ██
  // ═══════════════════════════════════════════════════

  /**
   * إرسال رسالة عبر جميع القنوات المتاحة بأفضل سرعة مع التوقيع الأمني
   * الأحداث الحرجة (START_GUN, LANE_FINISH) تُرسل عبر WS المحلي فقط لتجنب التأخير
   */
  public async sendMessage(msg: NetworkPeerMessage) {
    const enriched: any = {
      ...msg,
      _msgId: `${this.myAddress}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      _senderId: this.myAddress,
      _senderRole: this.role,
      _room: this.roomCode,
      perfNow: performance.now() - this.perfOrigin,
    };

    if (this.sessionToken) {
      try {
        enriched._sig = await computeMessageHmac(this.sessionToken, msg.type, enriched.timestamp || Date.now());
      } catch {}
    }

    // التخزين الدائم قبل الإرسال (offline-first): رسالة رسمية تبقى حتى تصل للخادم
    try { syncQueueService.enqueue(enriched); } catch { /* لا يُعطل الإرسال أبداً */ }

    const isCritical = ['START_GUN', 'RECALL_GUN', 'LANE_FINISH', 'RACE_COMPLETE', 'ON_MARKS', 'SET'].includes(msg.type);

    // 1. WebSocket المحلي (الأسرع — 1-3ms)
    const sentViaWs = this.sendViaLocalWs(enriched);

    // 2. BroadcastChannel (نفس الجهاز)
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(enriched); } catch (e) {}
    }

    // للأحداث الحرجة: لا حاجة لإرسال عبر MQTT إذا WS المحلي متصل
    if (isCritical && sentViaWs) {
      // أرسل فقط عبر القنوات المحلية السريعة
      this.connections.forEach((conn) => {
        if (conn.open) {
          try { conn.send(enriched); } catch (e) {}
        }
      });
      return;
    }

    // 3. MQTT السحابي (للرسائل العامة أو كاحتياطي) — الحمولة مشفرة AES-GCM
    // الوسيط العام (broker.emqx.io) لا يستطيع قراءة المحتوى أو تزويره
    if (this.mqttClient && this.mqttConnected) {
      try {
        const sessionScope = (this.sessionToken || 'GLOBAL').slice(0, 8);
        const topic = `pfp/rooms/${this.roomCode}/${sessionScope}/events`;
        let wirePayload: string;
        if (this.sessionToken) {
          const envelope = await encryptJsonPayload(this.sessionToken, enriched);
          wirePayload = JSON.stringify(envelope || enriched);
        } else {
          // بلا رمز جلسة لا يوجد مفتاح مشتق — تُرسل نصياً (الغرف المفتوحة التجريبية)
          wirePayload = JSON.stringify(enriched);
        }
        this.mqttClient.publish(topic, wirePayload, { qos: 0 });
      } catch (e) {
        console.warn('[MQTT] Publish notice:', e);
      }
    }

    // 4. WebRTC
    this.connections.forEach((conn) => {
      if (conn.open) {
        try { conn.send(enriched); } catch (e) {}
      }
    });

    // 5. SSE/HTTP (احتياطي)
    if (this.localHubActive && !sentViaWs) {
      fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...enriched, room: this.roomCode, role: this.role, clientId: this.hubClientId })
      }).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════
  // ██ معالجة الرسائل الواردة (بوابة أمنية أولاً)    ██
  // ═══════════════════════════════════════════════════

  /**
   * البوابة الأمنية الموحدة لكل رسالة واردة من أي قناة:
   * 1) فك تشفير حمولات MQTT المشفرة (AES-GCM) عند توفر رمز الجلسة.
   * 2) التحقق من توقيع HMAC للرسائل الموقعة — أي تلاعب يُرفض ويُدوَّن.
   * 3) مصفوفة صلاحيات الأدوار — رسالة غير مصرح بها تُرفض وتُدوَّن.
   * الرسائل المرفقة من الخادم (WS_WELCOME...) بلا دور مُرسل فتتجاوز البوابة.
   */
  private async handleIncomingMessage(msg: any, _source?: ConnectionMode) {
    if (!msg || !msg.type) return;

    // ── 1) فك التشفير: مغلف MQTT المشفر (AES-GCM مشتق من رمز الجلسة) ──
    if (msg._enc === 'A256GCM') {
      if (!this.sessionToken) {
        throttledSecurityLog('SEC_MQTT_ENVELOPE_NO_SESSION', {
          reason: `مغلف مشفر بلا رمز جلسة محلي — تجاهل (${msg.iv ? 'iv موجود' : 'لا iv'})`,
          target: 'cloud_mqtt'
        });
        return;
      }
      const decrypted = await decryptJsonPayload(this.sessionToken, msg);
      if (!decrypted) {
        // فشل فك التشفير = رسالة من غرفة أخرى أو محاولة حقن
        throttledSecurityLog('SEC_MQTT_DECRYPT_FAIL', {
          reason: 'فشل فك تشفير مغلف MQTT — مفتاح جلسة غير مطابق أو حمولة مسمومة',
          target: 'cloud_mqtt'
        });
        return;
      }
      msg = decrypted;
      if (!msg || !msg.type) return;
      if (msg._senderId === this.myAddress) return; // صدى رسالتنا بعد فك التشفير
    }

    // ── 2) التحقق من توقيع HMAC (للرسائل التي تحمل دور مُرسل) ──
    if (msg._senderRole && msg._sig && this.sessionToken) {
      const sigOk = await verifyMessageHmac(
        this.sessionToken,
        msg.type,
        msg.timestamp || 0,
        String(msg._sig)
      );
      if (!sigOk) {
        throttledSecurityLog('SEC_HMAC_REJECT', {
          actorRole: msg._senderRole as PhoneRole,
          reason: `توقيع HMAC غير صالح للرسالة ${msg.type} — رفض ومنع`,
          target: msg._senderId || 'unknown'
        });
        return;
      }
    } else if (msg._senderRole && !msg._sig && _source === 'local_ws' && this.sessionToken) {
      // على الشبكة المحلية المغلقة كل الأجهزة تعرف رمز الجلسة، فالرسالة غير الموقعة تعتبر دخيلاً
      throttledSecurityLog('SEC_UNSIGNED_PEER_MSG', {
        actorRole: msg._senderRole as PhoneRole,
        reason: `رسالة زميل غير موقعة على WS المحلي (${msg.type}) — رفض`,
        target: msg._senderId || 'unknown'
      });
      return;
    }

    // ── 3) مصفوفة صلاحيات الأدوار الميدانية (Role Permission Matrix) ──
    if (msg._senderRole && !isMessagePermitted(msg._senderRole as PhoneRole, msg.type)) {
      throttledSecurityLog('SEC_ROLE_MATRIX_REJECT', {
        actorRole: msg._senderRole as PhoneRole,
        reason: `حظر رسالة غير مصرح بها من دور «${msg._senderRole}»`,
        target: msg.type
      });
      return;
    }

    // تصفية الرسائل المكررة عبر القنوات المختلفة
    if (msg._msgId) {
      if (this.recentMessageIds.has(msg._msgId)) return;
      this.recentMessageIds.add(msg._msgId);
      if (this.recentMessageIds.size > 200) {
        const first = this.recentMessageIds.values().next().value;
        if (first) this.recentMessageIds.delete(first);
      }
    }

    // قياس الكمون والتزامن الزمني (MQTT legacy)
    if (msg.type === 'SYNC_PING') {
      this.sendMessage({
        type: 'SYNC_PONG',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: { originalSenderTime: msg.senderTime }
      });
    } else if (msg.type === 'SYNC_PONG') {
      const now = Date.now();
      const rtt = now - (msg.payload?.originalSenderTime || this.pingStartTime || now);
      this.mqttLatencyMs = Math.max(1, Math.round(rtt / 2));
      // WS latency أدق، لا نكتب فوقها إلا إذا لم يكن WS متصلاً
      if (!this.localWsConnected) {
        this.latencyMs = this.mqttLatencyMs;
        this.clockOffsetMs = Math.round(now - (msg.senderTime + this.mqttLatencyMs));
      }
      this.updateConnectionState();
    }

    // تتبع الأدوار المتصلة
    if (msg._senderRole) {
      if (msg._senderRole === 'start') this.hasStartPhone = true;
      if (msg._senderRole === 'finish') this.hasFinishPhone = true;
      if (msg._senderRole === 'judge') this.hasJudgePhone = true;
      if (msg._senderRole === 'chambre_dappel') this.hasChambrePhone = true;
    }

    if (this.onMessageCallback) {
      this.onMessageCallback(msg);
    }
  }

  // ═══════════════════════════════════════════════════
  // ██ تحديث حالة الاتصال                           ██
  // ═══════════════════════════════════════════════════

  private updateConnectionState() {
    const webRtcCount = this.connections.size;
    const connected = this.localWsConnected || this.mqttConnected || webRtcCount > 0 || this.localHubActive;
    this.isConnected = connected;

    // أولوية العرض: WS > MQTT+WebRTC > MQTT > WebRTC > SSE
    if (this.localWsConnected && this.mqttConnected) {
      this.connectionMode = 'dual_sync';
      this.connectionStatusText = `⚡ مزامنة محلية + سحابية • WS: ${this.wsLatencyMs}ms • MQTT: ${this.mqttLatencyMs || '...'}ms`;
    } else if (this.localWsConnected) {
      this.connectionMode = 'local_ws';
      this.connectionStatusText = `⚡ WebSocket محلي فائق السرعة • ${this.wsLatencyMs}ms • دقة: ${this.timeSyncAccuracy === 'excellent' ? 'ممتازة' : this.timeSyncAccuracy === 'good' ? 'جيدة' : this.timeSyncAccuracy === 'fair' ? 'مقبولة' : 'ضعيفة'}`;
    } else if (this.mqttConnected && webRtcCount > 0) {
      this.connectionMode = 'cloud_mqtt';
      this.connectionStatusText = `مزامنة مزدوجة (سحابة 4G + WebRTC) • ${this.latencyMs}ms`;
    } else if (this.mqttConnected) {
      this.connectionMode = 'cloud_mqtt';
      this.connectionStatusText = `سحابة 4G متصلة فورياً • ${this.mqttLatencyMs || 25}ms`;
    } else if (webRtcCount > 0) {
      this.connectionMode = 'webrtc_bridge';
      this.connectionStatusText = `جسر WebRTC P2P مباشر (${webRtcCount} هواتف)`;
    } else if (this.localHubActive) {
      this.connectionMode = 'local_hub';
      this.connectionStatusText = `خادم ترحيل محلي SSE (${this.connectedRoles.length} هواتف)`;
    } else {
      this.connectionMode = 'disconnected';
      this.connectionStatusText = 'بانتظار اقتران الهواتف...';
    }

    this.connectedCount = (this.hasStartPhone ? 1 : 0) + 
                          (this.hasFinishPhone ? 1 : 0) + 
                          (this.hasJudgePhone ? 1 : 0) + 
                          (this.hasChambrePhone ? 1 : 0);

    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.isConnected, this.latencyMs, this.connectionMode);
    }
  }

  // ═══════════════════════════════════════════════════
  // ██ نبضات الحياة والمزامنة                       ██
  // ═══════════════════════════════════════════════════

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      // نبضة WS
      if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
        this.localWs.send(JSON.stringify({
          type: 'WS_PING',
          clientTime: Date.now()
        }));
      }

      // نبضة MQTT
      this.pingStartTime = Date.now();
      this.sendMessage({
        type: 'SYNC_PING',
        timestamp: Date.now(),
        senderTime: Date.now()
      });
    }, 4000);
  }

  // ═══════════════════════════════════════════════════
  // ██ الواجهات العامة (Public API)                  ██
  // ═══════════════════════════════════════════════════

  public performTimeSync() {
    this.sendTimeSyncRequest();
    this.pingStartTime = Date.now();
    this.sendMessage({
      type: 'SYNC_PING',
      timestamp: Date.now(),
      senderTime: Date.now()
    });
  }

  public async fetchRoomStatus(): Promise<{ hasStart: boolean; hasFinish: boolean; hasJudge: boolean; hasChambre?: boolean } | null> {
    try {
      const res = await fetch(`/api/room-status?room=${encodeURIComponent(this.roomCode)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      hasStart: this.hasStartPhone || this.role === 'start',
      hasFinish: this.hasFinishPhone || this.role === 'finish',
      hasJudge: this.hasJudgePhone || this.role === 'judge',
      hasChambre: this.hasChambrePhone || this.role === 'chambre_dappel'
    };
  }

  public getConnectionQuality(): ConnectionQuality {
    return {
      localWsConnected: this.localWsConnected,
      localWsLatency: this.wsLatencyMs,
      mqttConnected: this.mqttConnected,
      mqttLatency: this.mqttLatencyMs,
      webRtcPeers: this.connections.size,
      sseConnected: this.localHubActive,
      clockOffset: this.clockOffsetMs,
      syncAccuracy: this.timeSyncAccuracy,
    };
  }

  public disconnect() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.timeSyncInterval) clearInterval(this.timeSyncInterval);
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline);
    }

    // قبل الانفصال: حاول دفع الرصيد المتراكم (لا يمنع الإغلاق أبداً)
    try { void syncQueueService.flush(true); } catch {}

    if (this.localWs) {
      try { this.localWs.close(); } catch (e) {}
      this.localWs = null;
    }
    if (this.mqttClient) {
      try { this.mqttClient.end(true); } catch (e) {}
      this.mqttClient = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    if (this.sseSource) {
      try { this.sseSource.close(); } catch (e) {}
      this.sseSource = null;
    }
    this.connections.clear();
    this.isConnected = false;
    this.localWsConnected = false;
  }

  public destroy() {
    this.disconnect();
  }
}

export const athleticsNetwork = new AthleticsNetworkService();
