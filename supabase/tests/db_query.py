#!/usr/bin/env python3
"""أداة استعلام (أدوات التشغيل المحلية في scripts/ غير متتبعة) سريعة عبر Management API — python3 scripts/db_query.py "<sql>" """
import json, os, sys, urllib.request, urllib.error

REF = 'qavifeuyhqyldbjwoqdn'
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()
if not TOKEN:
    sys.exit('SUPABASE_ACCESS_TOKEN غير مضبوط')

sql = sys.argv[1]
req = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{REF}/database/query',
    data=json.dumps({'query': sql}).encode(),
    headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
    method='POST')
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.status, r.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
