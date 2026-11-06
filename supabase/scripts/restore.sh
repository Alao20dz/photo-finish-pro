#!/usr/bin/env bash
# ==============================================================================
# restore.sh — استعادة نسخة احتياطية إلى مشروع Supabase هدف
# ==============================================================================
# ⚠️  تحذير: الاستعادة تستبدل محتوى المشروع الهدف. لا تُنفَّذ أبداً على مشروع
#     الإنتاج الحي — أنشئ مشروعاً جديداً فارغاً أولاً ثم استعد إليه، ووجّه
#     VITE_SUPABASE_URL إلى المشروع الجديد بعد التحقق.
#
# الاستخدام:
#   bash supabase/scripts/restore.sh backups/<timestamp> TARGET_DB_URL
#
#   TARGET_DB_URL = سلسلة اتصال Postgres للمشروع الهدف (Session pooler من
#   Dashboard → Connect)، يجب أن تملك صلاحية postgres.
#
# الترتيب المُطبَّق (مطابق لترتيب الترحيلات):
#   1) schema.sql   المخطط + RLS + الدوال (يُبنى الجدول قبل البيانات)
#   2) data.sql     البيانات
#   (roles.sql يُترك يدوياً — أدوار الإدارة السحابية خاصية خاصة بالمشروع)
#
# يتطلب: psql مثبتاً محلياً (apt install postgresql-client).

set -euo pipefail

SRC_DIR="${1:-}"
TARGET_URL="${2:-}"

if [ -z "$SRC_DIR" ] || [ -z "$TARGET_URL" ]; then
  echo "الاستخدام: bash supabase/scripts/restore.sh backups/<timestamp> TARGET_DB_URL" >&2
  exit 2
fi
if [ ! -f "$SRC_DIR/schema.sql" ] || [ ! -f "$SRC_DIR/data.sql" ]; then
  echo "خطأ: $SRC_DIR لا يحتوي schema.sql و data.sql — ليست نسخة كاملة." >&2
  exit 2
fi
command -v psql >/dev/null 2>&1 || { echo "خطأ: psql غير مثبت."; exit 2; }

echo "المصدر : $SRC_DIR"
[ -f "$SRC_DIR/MANIFEST.txt" ] && sed -n '1,5p' "$SRC_DIR/MANIFEST.txt"
echo "الهدف  : ${TARGET_URL%%@*}@*** (مخفي)"
echo
echo "⚠️  سيُستبدل محتوى المشروع الهدف. اكتب RESTORE (حروف كبيرة) للمتابعة:"
read -r CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "أُلغيت."; exit 1; }

echo "▶ 1/2 المخطط ..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$SRC_DIR/schema.sql"
echo "▶ 2/2 البيانات ..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$SRC_DIR/data.sql"

echo "✅ الاستعادة اكتملت. تحقق فوراً:"
echo "   - تسجيل دخول مدير رابطة عبر الواجهة"
echo "   - الموقع العام يعرض الرابطات (لا draft)"
echo "   - عدّاد الأعضاء/الأندية مطابق لما قبل الحادثة"
