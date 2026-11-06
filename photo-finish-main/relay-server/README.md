# Photo Finish Relay — خادم الترحيل السحابي ☁️⚡

خادم WebSocket مستقل يرفع طبقة الترحيل المحلية (كمون 1-3ms) إلى الإنترنت بكامون **5-30ms** بين الهواتف عبر أي شبكة (4G/5G/شركات اتصال مختلفة) — بدل الاعتماد على MQTT السحابي فقط (30-150ms).

نفس البروتوكول تماماً كما في `vite.config.ts` — لا حاجة لتعديل أي كود.

---

## 🚀 النشر في دقيقتين (مجاني)

### الخيار 1: Railway (الأفضل للـ WebSockets)
1. ادخل [railway.app](https://railway.app) وسجّل بحساب GitHub
2. **New Project** ← **Deploy from GitHub repo** ← اختر `photo-finish`
3. **Settings** ← **Root Directory**: `relay-server`
4. Railway يكتشف `npm start` تلقائياً — اضغط **Deploy**
5. **Settings** ← **Networking** ← **Generate Domain** (يعطيك رابط `xxx.up.railway.app`)

### الخيار 2: Render
1. ادخل [render.com](https://render.com) وسجّل بحساب GitHub
2. **New** ← **Web Service** ← اختر مستودع `photo-finish`
3. **Root Directory**: `relay-server` | **Build Command**: `npm install` | **Start Command**: `npm start`
4. **Create Web Service** — ستحصل على رابط `xxx.onrender.com`

> ⚠️ على الخطة المجانية لـ Render ينام الخادم بعد 15 دقيقة خمول — أول اتصال يستغرق ~30 ثانية للاستيقاظ.

### الخيار 3: Fly.io
```bash
fly launch --no-deploy
fly deploy
```

---

## 🔗 الربط بتطبيق Vercel

بعد حصولك على رابط الخادم (مثال: `https://photo-finish-relay.up.railway.app`):

1. افتح مشروع `photo-finish` في Vercel ← **Settings** ← **Environment Variables**
2. أضف:

| المفتاح | القيمة |
|---|---|
| `VITE_RELAY_WS_URL` | `wss://photo-finish-relay.up.railway.app` |

3. **Deploy** ← **Redeploy** (لإعادة البناء بالمتغير الجديد)

انتهى! كل الهواتف ستتصل بالترحيل السحابي تلقائياً، مع MQTT كاحتياطي ذكي عند سقوط الخادم.

---

## 🧪 فحص صحة الخادم

```bash
curl https://<your-relay-host>/health
```

```json
{
  "ok": true,
  "service": "photo-finish-relay",
  "uptimeSec": 3600,
  "rooms": [{ "room": "RACE-2026", "clients": 4, "roles": ["start", "finish", "judge", "chambre_dappel"] }]
}
```

## 🔐 الأمان

- نفس منطق الجلسات المحصّن: رمز `new` يُقبل فقط لأول جهاز يفتح الغرفة
- الأجهزة الأخرى يجب أن تحمل رمز الجلسة (من رابط QR المشترك)
- الأجهزة المرفوضة تتحول تلقائياً إلى MQTT — المزامنة لا تتوقف أبداً
