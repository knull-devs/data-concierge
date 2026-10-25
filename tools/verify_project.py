#!/usr/bin/env python3
"""Dependency-free sanity checks for the Date Concierge standalone project."""
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
required = [
    'index.html','register.html','login.html','dashboard.html','terms.html','privacy.html',
    'assets/css/site.css','assets/js/site.js','assets/js/dashboard.js','assets/js/register-redirect.js','assets/js/login-redirect.js','assets/img/hero-couple.webp',
    'api/_lib/auth.js','api/auth/register.js','api/auth/login.js','api/auth/me.js','api/auth/logout.js',
    'api/health.js','db/schema.sql','package.json','vercel.json','README.md','tools/smoke-auth.mjs'
]
missing=[item for item in required if not (ROOT/item).exists()]
errors=[]
if missing: errors.append('Missing required files: '+', '.join(missing))
if not errors:
    index=(ROOT/'index.html').read_text(encoding='utf-8')
    for phrase in ['How it works','About','Pricing','T&amp;C','auth-modal','login-form','register-form','data-auth-open','mobile-nav-toggle','auth-provider-row','data-auth-provider']:
        if phrase not in index: errors.append(f'index.html missing expected UI marker: {phrase}')
    for asset in re.findall(r'(?:src|href)="(/[^"#?]+)', index):
        if asset.startswith('/api/') or asset in ['/','/dashboard.html','/terms.html','/privacy.html','/register.html','/login.html']:
            continue
        clean=asset.lstrip('/')
        if not (ROOT/clean).exists(): errors.append(f'Broken local asset reference: {asset}')
    pkg=json.loads((ROOT/'package.json').read_text())
    if '@neondatabase/serverless' not in pkg.get('dependencies',{}): errors.append('Missing Neon serverless driver dependency')
    schema=(ROOT/'db/schema.sql').read_text()
    for table in ['dc_auth_users','dc_auth_sessions','dc_auth_rate_limits']:
        if f'CREATE TABLE IF NOT EXISTS {table}' not in schema: errors.append(f'Schema missing table {table}')
    auth=(ROOT/'api/_lib/auth.js').read_text()
    for token in ['HttpOnly','SameSite=Lax','timingSafeEqual','scrypt','DATABASE_URL','if (!origin || !hostHeader) return false']:
        if token not in auth: errors.append(f'Auth helper missing expected security feature: {token}')
    login_api=(ROOT/'api/auth/login.js').read_text()
    if 'createSession(sql, user.id, res, body.remember !== false)' not in login_api: errors.append('Login API does not respect the remember-me selection')
    if 'pH7' in index or 'pH7Builder' in index: errors.append('UI accidentally references upstream framework')
    if 'style=' in (ROOT/'terms.html').read_text() or 'style=' in (ROOT/'privacy.html').read_text(): errors.append('Inline styles found on legal pages while strict CSP is enabled')
if errors:
    print('FAIL')
    print('\n'.join('- '+e for e in errors))
    sys.exit(1)
print(f'PASS: {len(required)} required files exist; page markers, local asset references, DB schema and auth security checks passed.')
