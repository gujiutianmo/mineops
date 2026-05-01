"""测试所有 API 端点"""
import urllib.request
import json
import sys

BASE = 'http://localhost:8008'

# 先登录获取 token
login_data = json.dumps({"username": "admin", "password": "admin"}).encode()
req = urllib.request.Request(f'{BASE}/auth/login', method='POST', data=login_data)
req.add_header('Content-Type', 'application/json')
try:
    resp = urllib.request.urlopen(req, timeout=10)
    token = json.loads(resp.read())['access_token']
    print(f'[OK] Login: token={token[:30]}...')
except Exception as e:
    print(f'[FAIL] Login: {e}')
    sys.exit(1)

def api(method, path, data=None):
    url = BASE + path
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        if data:
            resp = urllib.request.urlopen(req, json.dumps(data).encode(), timeout=10)
        else:
            resp = urllib.request.urlopen(req, timeout=10)
        body = resp.read().decode()
        return resp.status, body[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return -1, str(e)[:300]

endpoints = {
    '/auth/me': ('GET', None),
    '/mines': ('GET', None),
    '/employees': ('GET', None),
    '/equipment': ('GET', None),
    '/factories': ('GET', None),
    '/plates': ('GET', None),
    '/shipping': ('GET', None),
    '/finance': ('GET', None),
    '/worklogs': ('GET', None),
}

passed = 0
failures = 0
for path, (method, data) in endpoints.items():
    s, b = api(method, path, data)
    ok = 200 <= s < 300
    if ok:
        passed += 1
    else:
        failures += 1
    print(f'[{("OK" if ok else "FAIL")}] {method} {path}: HTTP {s} -> {b[:150]}')

print(f'\n{"="*50}')
print(f'Results: {passed} passed, {failures} failed, {len(endpoints)} total')
if failures == 0:
    print('ALL TESTS PASSED!')
else:
    print(f'{failures} FAILURE(S) DETECTED!')
