#!/usr/bin/env bash
# ==============================================================================
# restore_api.sh — استعادة نسخة احتياطية مُنشأة بوضع API (JSON → قاعدة الهدف)
# ==============================================================================
# ينفّذ لكل جدول: INSERT ... SELECT * FROM json_populate_recordset(...)
# عبر Management API (نفس قناة backup.sh --api) ثم يُعيد ضبط تسلسل id تلقائياً.
#
# الاستخدام:
#   bash supabase/scripts/restore_api.sh backups/<timestamp> [--dry-run]
#
#   --dry-run : يطبع SQL الذي سينفَّذ دون تنفيذ (للتدقيق — آمن تماماً)
#
# ⚠️  الاستعادة الفعلية تكتب فوق/إلى جداول المشروع المُشار إليه بالرمز.
#     لأغراض الاختبار أو الترحيل أنشئ مشروعاً جديداً واستعِد إليه —
#     لا تُشغِّلها أبداً على مشروع إنتاج حي إلا بعد نسخة احتياطية طازجة.

set -euo pipefail

SRC_DIR="${1:-}"; FLAG="${2:-}"
DRY=0; [ "$FLAG" = "--dry-run" ] && DRY=1
[ -z "$SRC_DIR" ] && { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
[ -d "$SRC_DIR" ] || { echo "خطأ: مجلد غير موجود: $SRC_DIR" >&2; exit 2; }
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ] \
  || { echo "خطأ: اضبط SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF." >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "خطأ: curl غير مثبت." >&2; exit 2; }

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H 'Content-Type: application/json')

shopt -s nullglob
JSONS=("$SRC_DIR"/*.json)
[ ${#JSONS[@]} -gt 0 ] || { echo "خطأ: لا ملفات JSON في $SRC_DIR — ليست نسخة API؟" >&2; exit 2; }

run_sql() { # $1=SQL — يطبع HTTP كود والجسم
  local body sql="$1"
  body="$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$sql")"
  curl -sS -w '\n%{http_code}' "${auth[@]}" -d "$body" "$API"
}

echo "▶ الاستعادة من: $SRC_DIR (الهدف: $SUPABASE_PROJECT_REF)${DRY:+ [DRY-RUN]}"
STATUS_OK=0; STATUS_FAIL=0

for F in "${JSONS[@]}"; do
  T="$(basename "$F" .json)"
  N="$(python3 -c 'import sys,json;print(len(json.load(open(sys.argv[1]))))' "$F")"
  echo "──────── $T ($N صف)"
  [ "$N" = "0" ] && continue
  SQL="$(python3 - "$F" "$T" <<'PYEOF'
import sys, json
rows = json.load(open(sys.argv[1]))
tbl = sys.argv[2]
payload = json.dumps(rows, ensure_ascii=False)
sql = (
    f'insert into public."{tbl}" '
    f'select * from json_populate_recordset(null::public."{tbl}", '
    f"'{payload}'::json) on conflict do nothing;"
)
print(sql)
PYEOF
)"
  if [ "$DRY" = "1" ]; then
    printf '%s\n\n' "$SQL"
    continue
  fi
  RESP="$(run_sql "$SQL")"
  CODE="$(printf '%s' "$RESP" | tail -1)"
  case "$CODE" in
    200|201)
      echo "  ✔ أُدرجت (on conflict do nothing)"
      STATUS_OK=$((STATUS_OK+1)) ;;
    *)
      echo "  ✘ فشل (HTTP $CODE): $(printf '%s' "$RESP" | sed '$d' | head -c 300)" >&2
      STATUS_FAIL=$((STATUS_FAIL+1)) ;;
  esac
done

if [ "$DRY" = "1" ]; then echo "✅ DRY-RUN اكتمل — لم يُنفَّذ أي شيء."; exit 0; fi

# إعادة ضبط التسلسلات (id serial) بعد الإدراج المباشر
SEQ_SQL="$(cat <<'SQLEOF'
DO $fix$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema='public'
    WHERE c.table_schema='public' AND c.column_default LIKE 'nextval%'
  LOOP
    EXECUTE format(
      'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from public.%I), 0) + 1, false)',
      r.table_name, r.column_name, r.column_name, r.table_name);
  END LOOP;
END $fix$;
SQLEOF
)"
RESP="$(run_sql "$SEQ_SQL")"
CODE="$(printf '%s' "$RESP" | tail -1)"
case "$CODE" in
  200|201) echo "✔ أُعيد ضبط التسلسلات" ;;
  *) echo "⚠ فشل ضبط التسلسلات (HTTP $CODE) — تحقق يدوياً." >&2 ;;
esac

echo "اكتمل: $STATUS_OK جدولاً ناجحاً، $STATUS_FAIL فاشلاً."
[ "$STATUS_FAIL" = "0" ] || exit 1
echo "تحقق بعدها: تسجيل دخول مدير + الموقع العام يعرض الرابطات + الأعداد منطقية."
