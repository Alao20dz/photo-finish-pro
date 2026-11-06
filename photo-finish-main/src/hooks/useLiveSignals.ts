/**
 * Photo Finish Pro — خطّاف الإشارات اللحظية (useLiveSignals)
 * ==========================================================
 * المرحلة 7: ربط React رفيع لخدمة realtimeService:
 *  • اشتراك واحد لكل معرف رابطة (إعادة الاشتراك فقط عند تغيّره).
 *  • المستدعيات تُقرأ من ref → يمكن تمرير دوال جديدة كل عرض دون قطع الاتصال.
 *  • حالة polling بعد استنفاد محاولات الاتصال → تحديث دوري خفيف
 *    (كل الأنواع) طوال بقاء الشاشة مفتوحة.
 *  • leagueId فارغ/فاسد → off بلا اشتراك.
 *
 * كل منطق القرار نقي في realtimeService (مُختبَر) — هذا الخطّاف توصيل فقط.
 */

import { useEffect, useRef, useState } from 'react';
import {
  POLL_INTERVAL_MS,
  SIGNAL_EVENTS,
  subscribeLeagueSignals,
  type LiveStatus,
  type SignalEvent,
} from '../services/realtimeService';

export type SignalMap = Partial<Record<SignalEvent, () => void>>;

/** حالة القناة الحية + تفعيل التحديث التلقائي عند وصول الإشارات */
export function useLiveSignals(
  leagueId: string | null | undefined,
  handlers: SignalMap,
  opts: { pollMs?: number } = {}
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('off');
  const handlersRef = useRef<SignalMap>(handlers);
  handlersRef.current = handlers;
  const pollMs = opts.pollMs ?? POLL_INTERVAL_MS;

  useEffect(() => {
    if (!leagueId) {
      setStatus('off');
      return undefined;
    }
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const stopPoll = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const refreshAll = () => {
      for (const ev of SIGNAL_EVENTS) handlersRef.current[ev]?.();
    };

    const dispose = subscribeLeagueSignals(leagueId, {
      onSignal: (ev) => handlersRef.current[ev]?.(),
      onStatus: (st) => {
        setStatus(st);
        stopPoll();
        if (st === 'polling') pollTimer = setInterval(refreshAll, pollMs);
      },
    });

    return () => {
      dispose();
      stopPoll();
    };
  }, [leagueId, pollMs]);

  return status;
}
