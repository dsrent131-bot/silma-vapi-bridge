# الوسيط بين Vapi و SILMA (الصوت السعودي النجدي)

خادم صغير يربط صوت Vapi المخصّص بمحرّك SILMA النجدي.
يستقبل النص من Vapi ← يرسله لـ SILMA ← يرجّع الصوت بصيغة PCM اللي يبيها Vapi.

## المتغيّرات (Environment Variables) في Railway

| المتغيّر | إلزامي؟ | الوصف |
|---|---|---|
| `SILMA_API_KEY` | نعم | مفتاح SILMA من app.silma.ai/api-keys |
| `VOICE_ID` | لا | الصوت اللي عجبك (افتراضي: `fahd`). أصوات عربية: abdulaziz, fahd, khalid, omar, yusuf, layla, maryam, nouf, noura, reema |
| `VAPI_SECRET` | لا (مستحسن) | كلمة سر تخترعها، نحطها نفسها في Vapi للحماية |
| `MODEL_ID` | لا | افتراضي `silma-tts-v2-ksa` (النجدي) — لا تغيّره |

## خطوات النشر على Railway

1. أنشئ مستودع (repo) جديد في GitHub وارفع فيه هذي الملفات الثلاثة: `server.js`, `package.json`, `README.md`.
2. في Railway: `New Project` ← `Deploy from GitHub repo` ← اختر المستودع.
3. من تبويب `Variables` أضف المتغيّرات فوق (على الأقل `SILMA_API_KEY` و `VAPI_SECRET`).
4. Railway بينشر تلقائياً. من `Settings` ← `Networking` ← فعّل `Generate Domain` عشان يطلع رابط عام.
5. رابط الـ endpoint حقك بيكون:
   `https://<اسم-مشروعك>.up.railway.app/api/synthesize`

## الربط في Vapi

في الوكيل ← كرت `Voice` ← اختر مزوّد `Custom Voice`:
- `url` = رابط الـ endpoint فوق
- `secret` = نفس قيمة `VAPI_SECRET`

بعدها جرّب بزر `Talk`.

## اختبار سريع (اختياري)

```bash
curl -X POST https://<مشروعك>.up.railway.app/api/synthesize \
  -H "Content-Type: application/json" \
  -H "X-VAPI-SECRET: <VAPI_SECRET>" \
  --output test.pcm \
  -d '{"message":{"type":"voice-request","text":"هلا والله، وش رايك نطلع عشا؟","sampleRate":24000}}'
```

إذا نزّل ملف `test.pcm` فيه بيانات، الوسيط شغّال.
