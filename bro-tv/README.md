# BRO TV 🍿

غرفة مشاهدة مشتركة (Watch Party) — Next.js 14 + Supabase Realtime (Broadcast & Presence) — بدون أي جداول قاعدة بيانات.

## التشغيل

```bash
npm install
cp .env.example .env.local   # ثم ضع NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

الإنتاج: `npm run build && npm start` (أو انشره على Vercel وأضف المتغيرين في Environment Variables).

## إعداد Supabase (دقيقة واحدة)

1. أنشئ مشروعاً مجانياً على supabase.com.
2. من **Project Settings → API** انسخ `Project URL` و `anon public key` إلى `.env.local`.
3. لا حاجة لإنشاء جداول. تأكد فقط أن **Realtime** مفعّل (افتراضياً مفعّل) وأن خيار *Allow public access* في إعدادات Realtime غير معطّل.

## الشعار

الشعار في `public/logo.png` (يُستخدم في الهيدر وشاشة الدخول وكـ Favicon). استبدله بأي صورة مربعة.

## الألوان

| الاسم | Hex |
|---|---|
| Imperial purple | `#3C1A4F` |
| Champagne | `#F7E7CE` |

معرّفة في `tailwind.config.ts` (`brand`, `ink`, `champagne`).

## ملاحظات

- سيرفرات الأفلام (VidSrc / 2Embed / MultiEmbed / AutoEmbed) هي iframes خارجية: لا يمكن التحكم بتشغيلها برمجياً، لذلك زر «مزامنة المشهد» يبدأ عدّاً تنازلياً 3-2-1 عند الجميع ليضغطوا تشغيل معاً.
- روابط `.mp4` و `.m3u8` و YouTube تُزامَن كاملاً (تشغيل · إيقاف · قفز · الوقت الحالي، ومن ينضم متأخراً يستلم الحالة الحالية).
- بعض سيرفرات الأفلام ترفض العمل داخل iframe بوضع Sandbox — لذلك هو متوقف افتراضياً للسيرفرات ومفعّل افتراضياً للروابط الخارجية، ويمكن تبديله من الغرفة ويُزامَن بين الجميع.
- المشروع للاستخدام الشخصي؛ المحتوى المعروض يأتي من خدمات طرف ثالث.
