/**
 * Photo Finish Pro — عميل Supabase الأساسي (Supabase Client Foundation)
 * ==============================================================================
 * المرحلة 0: نقطة الوصول الموحدة لمنصة Supabase متعددة البطولات (Multi-League SaaS).
 *
 * مبادئ أمنية (Zero Backdoors Policy):
 * 1. يُقرأ الرابط والمفتاح العام (publishable/anon) حصراً من متغيرات البيئة VITE_*.
 *    المفتاح العام غير سري بحكم تصميم Supabase — الحماية الحقيقية عبر RLS على الخادم.
 * 2. يُمنع منعاً باتاً وضع مفتاح الخدمة السرّي الخادمي (service role) أو أي مفتاح سري في الواجهة.
 * 3. العميل كسول (Lazy Singleton): لا يُنشأ إلا عند أول استدعاء، ولا يرمي استثناء
 *    إذا لم تُضبط البيئة — التطبيق يظل يعمل أوفلاين كاملاً بدون Supabase.
 * 4. الجلسات تُخزَّن تحت مفتاح تخزين خاص بالتطبيق لتفادي أي تعارض محلي.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();

/** هل أُضبط منصة Supabase؟ (يستخدمه كل الواجهات لتقرير عرض مزامنة السحابة أو لا) */
export const isSupabaseConfigured: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/**
 * إرجاع عميل Supabase المشترك، أو null إن لم تُضبط متغيرات البيئة.
 * المتصل مُلزم بمعالجة null بأمان (وضع أوفلاين كامل).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'pf_supabase_auth_v1',
      },
    });
  }
  return client;
}

/** معرف التطبيق عند مراجعة سجلات Supabase Auth (يتسق مع توثيق المشروع) */
export const SUPABASE_CLIENT_ID = 'photo-finish-pro';
