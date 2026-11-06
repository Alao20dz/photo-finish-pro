# مجلد Supabase — مصدر الحقيقة الوحيد للخلفية

## البنية
```
supabase/
├── config.toml            # إعدادات المشروع المحلي (Supabase CLI)
├── migrations/            # مصدر الحقيقة الوحيد للمخطط (لا تعديل يدوي من اللوحة)
│   ├── 0001_initial_schema.sql   # الجداول + الفهارس + المشغّلات
│   └── 0002_rls_policies.sql     # RLS الشامل + دوال المساعدة + Views العامة + التدقيق
├── seed.sql               # بيانات تجريبية (رابطتان، أندية، تظاهرات، أصناف)
├── tests/rls_test.sql     # اختبارات pgTAP لعزل الصلاحيات
└── functions/             # Edge Functions (توقيع التراخيص، redeem-code، الإشعارات)
```

## التشغيل المحلي الكامل (بلا حساب سحابي)
```bash
# يتطلب Docker على جهازك
supabase start                # يرفع Postgres + Auth + Storage + Realtime محلياً
supabase db reset             # يطبق الهجرات + seed.sql
supabase test db              # اختبارات pgTAP لسياسات RLS
supabase gen types typescript --local > ../src/types/supabase.ts   # أنواع الواجهة
```
ثم ضبط متغيرات البيئة:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<يطبعها supabase start>
```

## قواعد أمنية إلزامية (مطبقة في 0002)
1. **RLS مفعّل + مفروض (`force`) على كل جدول** — اختبار pgTAP يفشل إن وُجد جدول بلا RLS.
2. **الأدوار من الجداول** (`league_members`, `platform_admins`, `club_coaches`) عبر دوال
   `security definer` (`is_league_member`, `has_league_role`, `is_club_coach`) —
   لا اعتماد على `user_metadata` القابلة للتعديل.
3. **تجزئة أكواد وضع المنافسة فقط** (`code_hash`) — الكود الأصلي يُعرض مرة واحدة
   من Edge Function عند الإصدار، ولا يُقرأ التجزئة من العميل إلا لأعضاء الرابطة.
4. **كل تعديل رسمي يُسجَّل تلقائياً** في `audit_log` بمشغّلات قاعدية (`audit_entity`).
5. **Views عامة** للزوار بأعمدة عامة فقط — لا تاريخ ميلاد كامل للقاصرين.
6. **MFA (AAL2)** يُفرض في سياسات العمليات الحساسة للمدير التنفيذي ومدير المنصة.

## حدود الخطة المجانية
- راجع صفحة الأسعار الرسمية قبل الاعتماد على أي رقم (تتغير دورياً).
- المشاريع المجانية تتوقف عند الخمول وبلا نسخ احتياطي مضمون:
  شغّل `scripts/backup` دورياً وزر "تصدير كامل للتظاهرة" من لوحة المدير.
- **لا تُجرَ بطولة رسمية على خطة بلا نسخ احتياطية.**
