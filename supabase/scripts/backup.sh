#!/usr/bin/env bash
# ==============================================================================
# backup.sh — نسخة احتياطية لمشروع Supabase (ثلاثة مسارات حسب البيئة)
# ==============================================================================
# المبدأ: **المخطط مصدره حقيقةً ملفات supabase/migrations في git** (مُغطى أصلًا).
# ما تحتاج حماية إضافية هو **البيانات** — ولهذا المسارات الثلاثة:
#
#   1) docker  (الأشمل): supabase db dump → roles.sql + schema.sql + data.sql
#      يتطلب Docker + SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.
#   2) pg      (بلا Docker): pg_dump مباشر ضد SUPABASE_DB_URL.
#      يتطلب pg_dump مثبتاً (postgresql-client).
#   3) api     (صفر اعتماديات — curl فقط): تصدير كل جداول public إلى JSON
#      عبر Management API. لا يتطلب Docker ولا psql ولا كلمة مرور قاعدة —
#      يكفي SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.
#      ملاحظة: لا يُصدِّر auth.users (هوية Supabase مُدارة سحابياً ولا يجب
#      تسرّب مُجزّئات كلمات المرور إلى ملفات) ولا الـ views (محسوبة).
#
# الاستخدام:
#   bash supabase/scripts/backup.sh            # تلقائي: docker ثم pg ثم api
#   bash supabase/scripts/backup.sh --api      # فرض مسار API
#   bash supabase/scripts/backup.sh --docker   # فرض مسار CLI (يتطلب Docker)
#   bash supabase/scripts/backup.sh --pg       # فرض pg_dump (يتطلب SUPABASE_DB_URL)
#   bash supabase/scripts/backup.sh --data-only|all   # لمسارَي docker/pg
#
# المخرجات: backups/<YYYY-MM-DD_HHMMSS>/ + MANIFEST.txt
# الاحتفاظ: يُحذف ما هو أقدم من KEEP_DAYS يوماً (افتراضي 30) — 0 يعطّل التنظيف.
#
# ملاحظة أمنية: النسخ تحتوي بيانات حقيقية — النمط backups/ مستثنى من git،
# ولا تُشارك إلا عبر قناة موثوقة (artifact مفاتيح المستودع المُقيَّدة مثلاً).

set -euo pipefail

MODE_REQ="auto"; DUMP_SCOPE="all"
for a in "$@"; do
  case "$a" in
    --api) MODE_REQ="api" ;;
    --docker) MODE_REQ="docker" ;;
    --pg) MODE_REQ="pg" ;;
    --data-only) DUMP_SCOPE="data" ;;
    --all) DUMP_SCOPE="all" ;;
    -h|--help) sed -n '2,34p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "خطأ: وسيط غير معروف: $a (جرّب --help)" >&2; exit 2 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y-%m-%d_%H%M%S)"
OUT_DIR="$ROOT_DIR/backups/$STAMP"
KEEP_DAYS="${KEEP_DAYS:-30}"
HAS_DOCKER=0; command -v docker >/dev/null 2>&1 && HAS_DOCKER=1
HAS_PG=0; command -v pg_dump >/dev/null 2>&1 && HAS_PG=1

# ------------------------------------------------------------------ مسار API ---
api_backup() {
  echo "▶ مسار API: تصدير جداول public إلى JSON ..."
  mkdir -p "$OUT_DIR"
  API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
  auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H 'Content-Type: application/json')

  # اكتشاف ديناميكي للجداول (لا قائمة ثابتة تتقادم مع الترحيلات الجديدة)
  Q='{"query":"select table_name from information_schema.tables where table_schema='"'"'public'"'"' and table_type='"'"'BASE TABLE'"'"' order by 1"}'
  RESP="$(curl -sS -w '\n%{http_code}' "${auth[@]}" -d "$Q" "$API")"
  CODE="$(printf '%s' "$RESP" | tail -1)"; BODY="$(printf '%s' "$RESP" | sed '$d')"
  case "$CODE" in 200|201) ;; *) echo "خطأ: فشل اكتشاف الجداول (HTTP $CODE): $BODY" >&2; exit 1 ;; esac

  TABLES="$(printf '%s' "$BODY" | python3 -c 'import sys,json;print("\n".join(r["table_name"] for r in json.load(sys.stdin)))')"
  [ -n "$TABLES" ] || { echo "لا جداول public — قاعدة فارغة؟" >&2; exit 1; }

  : > "$OUT_DIR/MANIFEST.txt"
  {
    echo "mode=api (بيانات فقط — المخطط مصدره supabase/migrations في git)"
    echo "project_ref=$SUPABASE_PROJECT_REF"
    echo "created_utc=$STAMP"
    echo
  } >> "$OUT_DIR/MANIFEST.txt"

  while IFS= read -r T; do
    [ -n "$T" ] || continue
    QB="$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' \
      "select coalesce(json_agg(t),'[]'::json) as rows from public.\"$T\" t")"
    RESP="$(curl -sS -w '\n%{http_code}' "${auth[@]}" -d "$QB" "$API")"
    CODE="$(printf '%s' "$RESP" | tail -1)"; BODY="$(printf '%s' "$RESP" | sed '$d')"
    case "$CODE" in 200|201) ;; *) echo "خطأ: فشل تصدير جدول $T (HTTP $CODE): $BODY" >&2; exit 1 ;; esac
    F="$OUT_DIR/$T.json"
    printf '%s' "$BODY" | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)[0]["rows"],ensure_ascii=False))' > "$F"
    N="$(python3 -c 'import sys,json;print(len(json.load(open(sys.argv[1]))))' "$F")"
    H="$(sha256sum "$F" | cut -d' ' -f1)"
    echo "  ✔ $T — $N صف ($H)" | tee -a "$OUT_DIR/MANIFEST.txt"
  done <<< "$TABLES"

  echo "✅ تم (API) — $OUT_DIR"
  echo "   للاستعادة: bash supabase/scripts/restore_api.sh $OUT_DIR"
}

# --------------------------------------------------------------- مسار Docker ---
docker_backup() {
  if command -v supabase >/dev/null 2>&1; then SUPA=(supabase); else SUPA=(npx --yes supabase); fi
  dump_args=(--project-ref "$SUPABASE_PROJECT_REF")
  mkdir -p "$OUT_DIR"
  dump_one() { local f="$OUT_DIR/$1"; shift; "${SUPA[@]}" db dump "${dump_args[@]}" --file "$f" "$@" >/dev/null; echo "  ✔ $1 ($(wc -c <"$f" | tr -d ' ') بايت)"; }
  echo "▶ مسار Docker (supabase db dump) ..."
  if [ "$DUMP_SCOPE" = "all" ]; then
    dump_one roles.sql --role-only
    dump_one schema.sql
    dump_one data.sql --data-only
  else
    dump_one data.sql --data-only
  fi
  { echo "mode=docker scope=$DUMP_SCOPE"; echo "project_ref=$SUPABASE_PROJECT_REF"; echo "created_utc=$STAMP"; echo
    (cd "$OUT_DIR" && sha256sum *.sql); } > "$OUT_DIR/MANIFEST.txt"
  echo "✅ تم (Docker) — $OUT_DIR"
  echo "   للاستعادة: bash supabase/scripts/restore.sh $OUT_DIR TARGET_DB_URL"
}

# ------------------------------------------------------------------ مسار pg ----
pg_backup() {
  DB_URL="${SUPABASE_DB_URL:?خطأ: مسار pg يتطلب SUPABASE_DB_URL}"
  mkdir -p "$OUT_DIR"
  echo "▶ مسار pg_dump ..."
  if [ "$DUMP_SCOPE" = "all" ]; then
    if pg_dumpall --roles-only --no-password --file "$OUT_DIR/roles.sql" "$DB_URL" 2>/dev/null; then
      echo "  ✔ roles.sql"
    else
      echo "  ⚠ تخطّي roles.sql (يتطلب صلاحية أعلى — أدوار الإدارة تُنشأ يدوياً في المشروع الهدف)"
      rm -f "$OUT_DIR/roles.sql"
    fi
    pg_dump --schema-only --no-owner --no-privileges --file "$OUT_DIR/schema.sql" "$DB_URL"
    echo "  ✔ schema.sql"
  fi
  pg_dump --data-only --no-owner --no-privileges --file "$OUT_DIR/data.sql" "$DB_URL"
  echo "  ✔ data.sql"
  { echo "mode=pg scope=$DUMP_SCOPE"; echo "created_utc=$STAMP"; echo
    (cd "$OUT_DIR" && sha256sum *.sql 2>/dev/null); } > "$OUT_DIR/MANIFEST.txt"
  echo "✅ تم (pg) — $OUT_DIR"
  echo "   للاستعادة: bash supabase/scripts/restore.sh $OUT_DIR TARGET_DB_URL"
}

# ------------------------------------------------------------------ الاختيار ---
if [ -n "${SUPABASE_DB_URL:-}" ] && [ "$MODE_REQ" = "pg" ]; then pg_backup
elif [ "$MODE_REQ" = "pg" ]; then echo "خطأ: --pg يتطلب SUPABASE_DB_URL." >&2; exit 2
elif [ "$MODE_REQ" = "api" ]; then
  [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ] \
    || { echo "خطأ: --api يتطلب SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF." >&2; exit 2; }
  api_backup
elif [ "$MODE_REQ" = "docker" ]; then
  [ "$HAS_DOCKER" = "1" ] || { echo "خطأ: --docker يتطلب Docker مثبتاً." >&2; exit 2; }
  [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ] \
    || { echo "خطأ: --docker يتطلب SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF." >&2; exit 2; }
  docker_backup
else # auto
  if [ "$HAS_DOCKER" = "1" ] && [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
    docker_backup
  elif [ "$HAS_PG" = "1" ] && [ -n "${SUPABASE_DB_URL:-}" ]; then
    pg_backup
  elif [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
    [ "$HAS_DOCKER" = "1" ] || echo "ℹ Docker غير متوفر — التحويل تلقائياً إلى مسار API (بيانات فقط؛ المخطط في git)."
    api_backup
  else
    echo "خطأ: لا مسار متاح. اضبط SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (أو SUPABASE_DB_URL مع pg_dump)." >&2
    exit 2
  fi
fi

# --- تنظيف النسخ القديمة ---
if [ "$KEEP_DAYS" -gt 0 ] 2>/dev/null; then
  find "$ROOT_DIR/backups" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" \
    -exec rm -rf {} + 2>/dev/null || true
fi
