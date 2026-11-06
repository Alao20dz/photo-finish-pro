#!/usr/bin/env python3
"""
مشغّل اختبارات RLS السحابية — Photo Finish Pro
يقرأ supabase/tests/rls_cloud_test.sql (وr_anon_test.sql) وينفّذهما عبر
Management API endpoint ‏/database/query، ثم يفكّ الحُكم من رسالة الاستثناء.
كل الاختبارات داخل معاملة واحدة تتراجع تلقائياً — صفر أثر على الإنتاج.

الاستخدام: python3 scripts/run_cloud_rls_tests.py
يتطلب: متغير البيئة SUPABASE_ACCESS_TOKEN (أو القيمة داخل الملف أدناه للتجارب المحلية)
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

REF = 'qavifeuyhqyldbjwoqdn'
BASE = str(__import__("pathlib").Path(__file__).resolve().parents[2])

TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()
if not TOKEN:
    print('❌ SUPABASE_ACCESS_TOKEN غير مضبوط')
    sys.exit(2)


def run_query(sql: str):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def parse_verdict(message: str):
    """يستخرج الحُكم من رسالة الخطأ: PFP_TESTS_PASSED/FAILED"""
    m = re.search(r'PFP_TESTS_PASSED total=(\d+)', message)
    if m:
        return 'PASSED', int(m.group(1)), []
    m = re.search(r'PFP_TESTS_FAILED total=(\d+) failed=(\d+) failures=(\[.*?\])\s*$', message, re.S)
    if m:
        total, failed = int(m.group(1)), int(m.group(2))
        try:
            failures = json.loads(m.group(3))
        except json.JSONDecodeError:
            failures = [{'test': '?', 'detail': message[:400]}]
        return 'FAILED', total, failures
    return 'ERROR', 0, [{'test': 'runner', 'detail': message[:400]}]


def main():
    grand_total = 0
    grand_failures = []

    suites = [
        ('الاختبارات الرئيسية', f'{BASE}/supabase/tests/rls_cloud_test.sql'),
        ('اختبارات الزائر المجهول', f'{BASE}/supabase/tests/rls_anon_test.sql'),
        ('اختبارات النتائج الرسمية (المرحلة 6)', f'{BASE}/supabase/tests/results_cloud_test.sql'),
        ('اختبارات الإشارات اللحظية (المرحلة 7)', f'{BASE}/supabase/tests/realtime_cloud_test.sql'),
    ]

    for label, path in suites:
        try:
            sql = open(path, encoding='utf-8').read()
        except FileNotFoundError:
            if 'anon' in path:
                continue  # اختياري
            raise
        code, body = run_query(sql)
        verdict, total, failures = parse_verdict(body)
        grand_total += total
        grand_failures += failures
        status = '✅' if verdict == 'PASSED' else '❌'
        print(f'{status} {label}: verdict={verdict} total={total}')
        for f in failures:
            print(f'   • {f["test"]}: {f["detail"][:220]}')
        if verdict == 'ERROR':
            print(f'   raw: {body[:400]}')

    print('─' * 60)
    if grand_failures:
        print(f'❌ النتيجة النهائية: {grand_total - len(grand_failures)}/{grand_total} — THERE ARE FAILURES')
        sys.exit(1)
    print(f'✅ النتيجة النهائية: {grand_total}/{grand_total} — ALL TESTS PASSED')


if __name__ == '__main__':
    main()
