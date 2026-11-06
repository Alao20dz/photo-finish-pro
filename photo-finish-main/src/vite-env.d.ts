/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** خادم ترحيل WebSocket سحابي اختياري (مثال: wss://my-relay.up.railway.app) */
  readonly VITE_RELAY_WS_URL?: string;
  /** رابط مشروع Supabase (مثال: https://xxxx.supabase.co) — مفتاح عام غير سري بحكم التصميم */
  readonly VITE_SUPABASE_URL?: string;
  /** المفتاح العام (publishable/anon) لـ Supabase — آمن للواجهة، أما service_role فممنوع هنا نهائياً */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
