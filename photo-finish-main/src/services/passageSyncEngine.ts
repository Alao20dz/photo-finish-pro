/**
 * محرك المزامنة المستقل عن الإنترنت لنقاط المراقبة والحكام
 * (Offline-First Passage Sync Engine)
 * 
 * المبادئ الحاكمة:
 * - كل عملية تسجيل تأخذ UUID فريد وتُحفظ فوراً في IndexedDB المحلي.
 * - طابور انتظار للأحداث غير المرسلة عند انقطاع الشبكة.
 * - منع التكرار التام (Idempotency) باستخدام المعرفات الفريدة.
 * - إعادة إرسال تلقائية ومجمعة (Batching) فور عودة الاتصال.
 * - إشعار الواجهات لحظياً دون الحاجة لتحديث الصفحة.
 */

import { 
  PassageEvent, 
  PassageCorrection, 
  PassageSource,
  AthleticsJudge,
  Checkpoint 
} from '../types/athletics';
import { checkpointStorage } from './checkpointStorage';
import { NetworkPeerMessage } from '../types/race';

export type SyncState = 'offline' | 'syncing' | 'synced' | 'has_pending';

class PassageSyncEngine {
  private listeners: Set<(event: PassageEvent) => void> = new Set();
  private correctionListeners: Set<(corr: PassageCorrection) => void> = new Set();
  private heartbeatListeners: Set<(judge: AthleticsJudge) => void> = new Set();
  private syncStateListeners: Set<(state: SyncState, pendingCount: number) => void> = new Set();

  private processedEventIds: Set<string> = new Set();
  private networkSender: ((msg: NetworkPeerMessage) => void) | null = null;
  private isOnline: boolean = true;
  private flushTimer: any = null;
  private heartbeatTimer: any = null;
  private currentJudge: AthleticsJudge | null = null;
  private currentDeviceId: string = '';

  constructor() {
    this.currentDeviceId = this.getOrCreateDeviceId();
    // فحص دوري لطابور المزامنة كل 4 ثوانٍ
    if (typeof window !== 'undefined') {
      this.flushTimer = setInterval(() => this.flushPendingQueue(), 4000);
    }
  }

  private getOrCreateDeviceId(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let devId = localStorage.getItem('photo_finish_device_id');
        if (!devId) {
          devId = `DEV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
          localStorage.setItem('photo_finish_device_id', devId);
        }
        return devId;
      }
    } catch (e) {}
    return `DEV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }

  public getDeviceId(): string {
    return this.currentDeviceId;
  }

  /** تعيين وسيط الشبكة لإرسال الرسائل */
  public attachNetwork(sender: (msg: NetworkPeerMessage) => void) {
    this.networkSender = sender;
  }

  /** ضبط هوية الحكم الحالي للجهاز */
  public setCurrentJudge(judge: AthleticsJudge | null) {
    this.currentJudge = judge;
    if (judge) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  public getCurrentJudge(): AthleticsJudge | null {
    return this.currentJudge;
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.stopHeartbeat();
  }

  // ═══════════════════════════════════════════════════
  // تسجيل أحداث المرور (Recording Passages)
  // ═══════════════════════════════════════════════════

  /**
   * تسجيل مرور عداء في نقطة مراقبة
   * @param competitionId معرف المنافسة
   * @param checkpoint كائن نقطة المراقبة
   * @param bibNumber رقم الصدرية
   * @param lapNumber رقم الحلقة
   * @param source طريقة التسجيل (زر سريع / باركود / يدوي)
   * @param raceStartTime توقيت انطلاق السباق بالمللي ثانية (لحساب الزمن الجزئي)
   */
  public async recordPassage(
    competitionId: string,
    checkpoint: Checkpoint,
    bibNumber: number,
    lapNumber: number = 1,
    source: PassageSource = 'quick_button',
    raceStartTime?: number
  ): Promise<{ event: PassageEvent; isDuplicate: boolean }> {
    const now = Date.now();
    const perfNow = typeof performance !== 'undefined' ? performance.now() : 0;
    const elapsedTimeMs = raceStartTime && raceStartTime > 0 ? now - raceStartTime : undefined;

    // فحص التسجيل المزدوج في نفس النقطة والحلقة
    const existing = await checkpointStorage.checkBibPassageExists(
      competitionId,
      checkpoint.id,
      lapNumber,
      bibNumber
    );

    const eventId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pass_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const event: PassageEvent = {
      id: eventId,
      competitionId,
      checkpointId: checkpoint.id,
      checkpointCode: checkpoint.code,
      lapNumber,
      bibNumber,
      timestamp: now,
      perfNow,
      elapsedTimeMs,
      recordedByJudgeId: this.currentJudge ? this.currentJudge.id : 'anonymous_judge',
      judgeName: this.currentJudge ? this.currentJudge.name : 'حكم نقطة',
      deviceId: this.currentDeviceId,
      source,
      syncStatus: 'pending',
      isFlagged: !!existing,
      flagReason: existing ? `تم تسجيل هذا العداء مسبقاً في هذه النقطة بنفس الحلقة` : undefined
    };

    // 1. الحفظ المحلي فوراً
    await checkpointStorage.recordPassage(event);
    this.processedEventIds.add(event.id);

    // 2. البث الشبكي الحي
    this.broadcastPassageBatch([event]);

    // 3. إعلام الواجهات المحلية
    this.notifyPassage(event);

    return { event, isDuplicate: !!existing };
  }

  /** بث دفعة أحداث عبر الشبكة */
  private broadcastPassageBatch(events: PassageEvent[]) {
    if (!this.networkSender || !events.length) return;

    try {
      this.networkSender({
        type: 'ATHLETICS_PASSAGE_BATCH',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: {
          events,
          senderDeviceId: this.currentDeviceId,
          judge: this.currentJudge
        }
      });
    } catch (e) {
      console.warn('[SyncEngine] فشل البث الشبكي، محفوظ في الطابور:', e);
    }
  }

  /** معالجة الرسائل الواردة من شبكة ألعاب القوى */
  public handleIncomingMessage(msg: NetworkPeerMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ATHLETICS_PASSAGE_BATCH':
        this.handleIncomingPassageBatch(msg.payload);
        break;
      case 'ATHLETICS_CORRECTION':
        this.handleIncomingCorrection(msg.payload);
        break;
      case 'ATHLETICS_JUDGE_HEARTBEAT':
        this.handleIncomingJudgeHeartbeat(msg.payload);
        break;
      default:
        break;
    }
  }

  /** معالجة دفعة أحداث قادمة من جهاز آخر */
  private async handleIncomingPassageBatch(payload: any) {
    if (!payload || !Array.isArray(payload.events)) return;

    const incomingEvents: PassageEvent[] = payload.events;
    const newEventsToStore: PassageEvent[] = [];

    for (const event of incomingEvents) {
      if (this.processedEventIds.has(event.id)) {
        continue; // معالج مسبقاً
      }

      this.processedEventIds.add(event.id);
      event.syncStatus = 'synced';
      newEventsToStore.push(event);

      // حفظ في قاعدة البيانات المحلية
      await checkpointStorage.recordPassage(event);
      this.notifyPassage(event);
    }
  }

  /** معالجة طلب أو اعتماد تصحيح */
  private async handleIncomingCorrection(payload: any) {
    if (!payload || !payload.correction) return;
    const corr: PassageCorrection = payload.correction;
    await checkpointStorage.recordCorrection(corr);
    this.correctionListeners.forEach(fn => fn(corr));
  }

  /** معالجة نبضة اتصال حكم */
  private handleIncomingJudgeHeartbeat(payload: any) {
    if (!payload || !payload.judge) return;
    const judge: AthleticsJudge = {
      ...payload.judge,
      isOnline: true,
      lastSeen: Date.now(),
      latencyMs: payload.latency || 0
    };
    this.heartbeatListeners.forEach(fn => fn(judge));
  }

  // ═══════════════════════════════════════════════════
  // تفريغ طابور المزامنة التلقائي (Flush Queue)
  // ═══════════════════════════════════════════════════

  public async flushPendingQueue(): Promise<number> {
    try {
      const pending = await checkpointStorage.getPendingSyncQueue();
      const count = pending.length;

      if (count === 0) {
        this.notifySyncState('synced', 0);
        return 0;
      }

      this.notifySyncState('has_pending', count);

      if (this.networkSender) {
        this.notifySyncState('syncing', count);
        this.broadcastPassageBatch(pending);
        await checkpointStorage.markPassagesSynced(pending.map(p => p.id));
        this.notifySyncState('synced', 0);
        return count;
      }
    } catch (e) {
      this.notifySyncState('offline', 0);
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════
  // تصحيح الأخطاء وسجل التدقيق (Corrections)
  // ═══════════════════════════════════════════════════

  public async submitCorrection(
    passageEventId: string,
    originalBib: number,
    correctedBib: number,
    reason: string
  ): Promise<PassageCorrection> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const correction: PassageCorrection = {
      id,
      passageEventId,
      originalBibNumber: originalBib,
      correctedBibNumber: correctedBib,
      reason,
      requestedByJudgeId: this.currentJudge ? this.currentJudge.id : 'unknown',
      requestedByName: this.currentJudge ? this.currentJudge.name : 'حكم',
      requestedAt: Date.now(),
      status: this.currentJudge?.role === 'chief_judge' ? 'approved' : 'pending'
    };

    await checkpointStorage.recordCorrection(correction);

    if (this.networkSender) {
      this.networkSender({
        type: 'ATHLETICS_CORRECTION',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: { correction }
      });
    }

    this.correctionListeners.forEach(fn => fn(correction));
    return correction;
  }

  // ═══════════════════════════════════════════════════
  // نبضات حياة الحكام (Judge Heartbeat)
  // ═══════════════════════════════════════════════════

  private startHeartbeat() {
    this.stopHeartbeat();
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat() {
    if (!this.networkSender || !this.currentJudge) return;
    try {
      this.networkSender({
        type: 'ATHLETICS_JUDGE_HEARTBEAT',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: {
          judge: this.currentJudge,
          deviceId: this.currentDeviceId,
          time: Date.now()
        }
      });
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════
  // الاشتراكات والإشعارات (Listeners)
  // ═══════════════════════════════════════════════════

  public onPassage(callback: (event: PassageEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onCorrection(callback: (corr: PassageCorrection) => void): () => void {
    this.correctionListeners.add(callback);
    return () => this.correctionListeners.delete(callback);
  }

  public onJudgeHeartbeat(callback: (judge: AthleticsJudge) => void): () => void {
    this.heartbeatListeners.add(callback);
    return () => this.heartbeatListeners.delete(callback);
  }

  public onSyncStateChange(callback: (state: SyncState, pendingCount: number) => void): () => void {
    this.syncStateListeners.add(callback);
    return () => this.syncStateListeners.delete(callback);
  }

  private notifyPassage(event: PassageEvent) {
    this.listeners.forEach(fn => fn(event));
  }

  private notifySyncState(state: SyncState, count: number) {
    this.syncStateListeners.forEach(fn => fn(state, count));
  }
}

export const passageSyncEngine = new PassageSyncEngine();
