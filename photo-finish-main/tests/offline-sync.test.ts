/**
 * اختبارات محرك المزامنة offline-first
 * =====================================
 * المعيار الميداني المقبول: "انقطاع 10 دقائق ثم العودة = صفر فقدان وصفر تكرار".
 * 1. دفتر الخادم (SyncStore): كل معرف يُقبل مرة واحدة فقط مهما تكرر الإرسال.
 * 2. الطابور الدائم: يصمد خلال الانقطاع، يعيد الإرسال بنفس المعرفات، يصفّى عند العودة.
 * 3. تعويض الفجوة (Replay): الجهاز المستعيد يسحب ما فاته بالترتيب.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncStore } from '../server/syncStore.js';
import { syncQueueService, SYNC_WORTHY_TYPES } from '../src/services/syncQueueService';

function makeMsg(i: number, type = 'LANE_FINISH'): any {
  return {
    _msgId: `msg-${i}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    _senderRole: 'finish',
    _senderId: 'APF-FINISH-TEST',
    _room: 'R-OUTAGE',
    timestamp: 1730000000000 + i,
    payload: { lane: (i % 8) + 1, ms: 10000 + i * 37 },
  };
}

describe('Server-side idempotency ledger (SyncStore)', () => {
  let store: SyncStore;

  beforeEach(() => {
    store = new SyncStore({ dbPath: ':memory:' });
  });

  it('accepts each message id exactly once across repeated ingests', () => {
    const batch = [makeMsg(1), makeMsg(2), makeMsg(3)];

    const r1 = store.ingest('R-OUTAGE', batch);
    expect(r1.accepted).toHaveLength(3);
    expect(r1.duplicates).toHaveLength(0);

    // نفس الدفعة تُرسل 4 مرات أخرى (إعادة محاولات بعد انقطاع متكرر)
    for (let round = 0; round < 4; round++) {
      const r = store.ingest('R-OUTAGE', batch);
      expect(r.accepted).toHaveLength(0);
      expect(r.duplicates).toHaveLength(3);
    }

    expect(store.messageCount('R-OUTAGE')).toBe(3);
  });

  it('replays missing gap in strict order after reconnection', () => {
    const batch = Array.from({ length: 25 }, (_, i) => makeMsg(i));
    store.ingest('R-OUTAGE', batch);

    const latest = store.latestSeq('R-OUTAGE');
    expect(latest).toBe(25);

    // جهاز فاته كل شيء منذ البداية
    const full = store.replay('R-OUTAGE', 0);
    expect(full).toHaveLength(25);
    expect(full.map(m => m.seq)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));

    // جهاز فاته آخر 10 رسائل فقط
    const partial = store.replay('R-OUTAGE', 15);
    expect(partial).toHaveLength(10);
    expect(partial[0].seq).toBe(16);
  });

  it('keeps rooms isolated', () => {
    store.ingest('ROOM-A', [makeMsg(1)]);
    store.ingest('ROOM-B', [makeMsg(2)]);
    expect(store.messageCount('ROOM-A')).toBe(1);
    expect(store.messageCount('ROOM-B')).toBe(1);
    expect(store.replay('ROOM-A', 0).every(m => m.room === 'ROOM-A')).toBe(true);
  });

  it('rejects messages without idempotency keys (cannot guarantee zero-duplicate)', () => {
    const r = store.ingest('R-OUTAGE', [{ type: 'LANE_FINISH', _senderRole: 'finish' }]);
    expect(r.accepted).toHaveLength(0);
    expect(r.duplicates).toHaveLength(0);
    expect(store.messageCount('R-OUTAGE')).toBe(0);
  });
});

describe('Client persistent queue — 10 minute outage simulation (zero loss, zero duplicates)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    syncQueueService.resetForTest();
    syncQueueService.configure('R-OUTAGE', 'token-outage-1');
  });

  it('survives a full outage: queue holds everything, then flushes exactly once per message', async () => {
    // ═══ محاكاة الخادم: دفتر إلغاء تكرار حقيقي ═══
    const serverLedger = new Set<string>();
    const serverAcceptedLog: string[] = [];
    let outageActive = true;
    let requestCount = 0;

    syncQueueService.transportOverride = async (batch) => {
      requestCount++;
      if (outageActive) {
        return { ok: false, accepted: [], duplicates: [], error: 'network unreachable (simulated 10-min outage)' };
      }
      const accepted: string[] = [];
      const duplicates: string[] = [];
      for (const item of batch) {
        if (serverLedger.has(item.id)) {
          duplicates.push(item.id);
        } else {
          serverLedger.add(item.id);
          accepted.push(item.id);
          serverAcceptedLog.push(item.id);
        }
      }
      return { ok: true, accepted, duplicates, latestSeq: serverLedger.size };
    };

    // ═══ مرحلة الانقطاع: 10 دقائق من الرسائل الميدانية الحقيقية ═══
    // (طلقة بداية + 3 أدوار × 8 حارات + تصحيحات حكم)
    const sentIds: string[] = [];
    const allSent = [
      makeMsg(0, 'START_GUN'),
      ...Array.from({ length: 24 }, (_, k) => makeMsg(1 + k, 'LANE_FINISH')),
      ...Array.from({ length: 6 }, (_, k) => makeMsg(25 + k, 'JUDGE_UPDATE_RUNNER')),
    ];
    for (const m of allSent) {
      sentIds.push(m._msgId);
      syncQueueService.enqueue(m);
    }

    // أثناء الانقطاع: عدة محاولات تدفق تفشل (كل محاولة مع تراجع أسّي)
    for (let attempt = 0; attempt < 6; attempt++) {
      await syncQueueService.flush(true);
      await vi.advanceTimersByTimeAsync(60_000); // أقصى تراجع
    }
    // صفر فقدان: كل الرسائل ما تزال محفوظة
    expect(syncQueueService.pendingCount).toBe(31);
    expect(serverAcceptedLog).toHaveLength(0);

    // ═══ العودة من الانقطاع بعد 10 دقائق ═══
    outageActive = false;
    const result = await syncQueueService.flush(true);
    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(31);
    expect(syncQueueService.pendingCount).toBe(0);

    // صفر فقدان: كل معرف مُرسل وصل حتماً
    expect(new Set(serverAcceptedLog)).toEqual(new Set(sentIds));
    expect(serverAcceptedLog).toHaveLength(31);

    // صفر تكرار: كل معرف قُبل مرة واحدة فقط في دفتر الخادم
    expect(new Set(serverAcceptedLog).size).toBe(serverAcceptedLog.length);
    expect(result.duplicates).toBe(0);

    // المحاولات أثناء الانقطاع أعادت إرسال نفس المعرفات (مفتاح إلغاء التكرار ثابت)
    expect(requestCount).toBeGreaterThanOrEqual(7);
  });

  it('skips noise messages and messages without ids', () => {
    syncQueueService.enqueue({ type: 'SYNC_PING', _msgId: 'ping-1' }); // ضوضاء
    syncQueueService.enqueue({ type: 'LANE_FINISH' }); // بلا معرف
    syncQueueService.enqueue({ type: 'LANE_FINISH', _msgId: 'ok-1', payload: {} }); // رسمية
    expect(syncQueueService.pendingCount).toBe(1);
    expect(SYNC_WORTHY_TYPES.has('CLOCK_TICK')).toBe(false);
    expect(SYNC_WORTHY_TYPES.has('RESULTS_LOCK_PUBLISH')).toBe(true);
  });

  it('does not enqueue the same id twice locally', () => {
    const m = makeMsg(99);
    syncQueueService.enqueue(m);
    syncQueueService.enqueue(m); // إرسال مزدوج لنفس الرسالة
    expect(syncQueueService.pendingCount).toBe(1);
  });
});

describe('Gap replay client pull', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    syncQueueService.resetForTest();
    syncQueueService.configure('R-OUTAGE', 'token-replay-1');
  });

  it('pulls missing messages in order and advances lastServerSeq', async () => {
    const received: any[] = [];
    syncQueueService.setPullCallback((m) => received.push(m));

    // الخادم يملك 7 رسائل فاتت الجهاز
    syncQueueService.replayOverride = async (since) => {
      const rows = [];
      for (let i = since + 1; i <= 7; i++) {
        rows.push({ seq: i, msg_id: `srv-${i}`, payload: makeMsg(i, 'CROSSING_RECORDED') });
      }
      return { ok: true, messages: rows, latestSeq: 7 };
    };

    const fetched = await syncQueueService.pullReplay(true);
    expect(fetched).toBe(7);
    expect(received).toHaveLength(7);
    expect(received[0]._msgId).not.toBeUndefined();
    expect(syncQueueService.getStats().lastServerSeq).toBe(7);

    // استدعاء ثانٍ: لا شيء جديد
    const second = await syncQueueService.pullReplay(true);
    expect(second).toBe(0);
  });
});
