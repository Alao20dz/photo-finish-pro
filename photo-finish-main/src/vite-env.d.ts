/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** خادم ترحيل WebSocket سحابي اختياري (مثال: wss://my-relay.up.railway.app) */
  readonly VITE_RELAY_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
