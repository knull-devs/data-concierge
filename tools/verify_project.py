#!/usr/bin/env python3
"""Dependency-free sanity checks for the Date Concierge standalone project."""
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
required = [
    'index.html','register.html','login.html','dashboard.html','terms.html','privacy.html',
    'discover.html','introductions.html','profile.html',
    'assets/css/site.css','assets/css/profile.css','assets/css/discovery.css',
    'assets/js/story-stack.js',
    'assets/img/story-stack/01-rooftop.webp','assets/img/story-stack/02-cafe.webp',
    'assets/img/story-stack/03-garden.webp','assets/img/story-stack/04-gallery.webp',
    'assets/img/story-stack/05-bookshop.webp',
    'assets/js/site.js','assets/js/dashboard.js','assets/js/register-redirect.js','assets/js/login-redirect.js',
    'assets/js/profile.js','assets/js/discover.js','assets/js/introductions.js','assets/img/hero-couple.webp',
    'api/_lib/auth.js','api/_lib/profile.js','api/_lib/matchmaking.js',
    'api/auth/register.js','api/auth/login.js','api/auth/me.js','api/auth/logout.js',
    'api/health.js','api/profile/me.js','api/matches/recommendations.js','api/introductions.js',
    'db/schema.sql','db/migrations/001_member_profiles.sql','db/migrations/002_discovery_matching.sql',
    'package.json','vercel.json','README.md','THIRD_PARTY_NOTICES.md',
    'tools/smoke-auth.mjs','tools/smoke-profile.mjs','tools/smoke-matches.mjs',
    'docs/PH7-REUSE-MAP.md'
]
missing = [item for item in required if not (ROOT/item).exists()]
errors = []
if missing:
    errors.append('Missing required files: '+', '.join(missing))

root_routes = {'/', '/dashboard.html', '/terms.html', '/privacy.html', '/register.html', '/login.html',
               '/profile.html', '/discover.html', '/introductions.html'}

def check_assets(page_name):
    page_path = ROOT / page_name
    if not page_path.exists():
        return
    text = page_path.read_text(encoding='utf-8')
    for asset in re.findall(r'(?:src|href)="(/[^"#?]+)', text):
        if asset.startswith('/api/') or asset in root_routes:
            continue
        clean = asset.lstrip('/')
        if not (ROOT/clean).exists():
            errors.append(f'Broken local asset reference in {page_name}: {asset}')

if not missing:
    index = (ROOT/'index.html').read_text(encoding='utf-8')
    for phrase in ['How it works','About','Pricing','T&amp;C','auth-modal','login-form','register-form',
                   'data-auth-open','mobile-nav-toggle','auth-provider-row','data-auth-provider','data-story-stack-section','data-story-stack-track','data-stack-card']:
        if phrase not in index:
            errors.append(f'index.html missing expected UI marker: {phrase}')
    for page in ['index.html','profile.html','discover.html','introductions.html','dashboard.html']:
        check_assets(page)
    stack_card_count = len(re.findall(r'data-stack-card(?:\s|>)', index))
    if stack_card_count != 5:
        errors.append(f'Homepage should contain exactly five story-stack cards, found {stack_card_count}')
    if 'story-stack.js?v=1.1.0' not in index or 'site.css?v=1.1.0' not in index:
        errors.append('Homepage story-stack cache-busting versions are missing')
    for token in ['data-stack-cards','story-stack-card-copy','story-stack-card-media','Scroll to reveal']:
        if token not in index:
            errors.append(f'Homepage missing stacked photo-grid markup: {token}')

    pkg = json.loads((ROOT/'package.json').read_text())
    if '@neondatabase/serverless' not in pkg.get('dependencies', {}):
        errors.append('Missing Neon serverless driver dependency')
    schema = (ROOT/'db/schema.sql').read_text()
    for table in ['dc_auth_users','dc_auth_sessions','dc_auth_rate_limits','dc_member_profiles','dc_introduction_requests']:
        if f'CREATE TABLE IF NOT EXISTS {table}' not in schema:
            errors.append(f'Schema missing table {table}')

    profile_html = (ROOT/'profile.html').read_text(encoding='utf-8')
    profile_js = (ROOT/'assets/js/profile.js').read_text(encoding='utf-8')
    for phrase in ['Profile progress','profile-form','Who would you like to meet?','Make my profile discoverable']:
        if phrase not in profile_html and phrase not in profile_js:
            errors.append(f'Profile page missing expected content: {phrase}')
    profile_api = (ROOT/'api/profile/me.js').read_text(encoding='utf-8')
    for token in ['requestHasValidOrigin','getSessionUser','enforceRateLimit','WHERE user_id = ${user.id}','ON CONFLICT (user_id)']:
        if token not in profile_api:
            errors.append(f'Profile API missing expected safeguard: {token}')

    auth = (ROOT/'api/_lib/auth.js').read_text()
    for token in ['HttpOnly','SameSite=Lax','timingSafeEqual','scrypt','DATABASE_URL','if (!origin || !hostHeader) return false']:
        if token not in auth:
            errors.append(f'Auth helper missing expected security feature: {token}')
    login_api = (ROOT/'api/auth/login.js').read_text()
    if 'createSession(sql, user.id, res, body.remember !== false)' not in login_api:
        errors.append('Login API does not respect the remember-me selection')
    if 'pH7' in index or 'pH7Builder' in index:
        errors.append('UI accidentally references upstream framework')
    if 'style=' in (ROOT/'terms.html').read_text() or 'style=' in (ROOT/'privacy.html').read_text():
        errors.append('Inline styles found on legal pages while strict CSP is enabled')

    matchmaking = (ROOT/'api/_lib/matchmaking.js').read_text(encoding='utf-8')
    for token in ['WEIGHT', 'AGE_TOLERANCE_YEARS', 'ACTIVITY_HALF_LIFE_DAYS', 'isMutuallyCompatible', 'rankMatches']:
        if token not in matchmaking:
            errors.append(f'Matchmaking logic missing expected feature: {token}')
    recommendations = (ROOT/'api/matches/recommendations.js').read_text(encoding='utf-8')
    for token in ['getSessionUser','isDiscoveryReady','isMutuallyCompatible','rankMatches','avatarApproved === true']:
        if token not in recommendations:
            errors.append(f'Recommendations API missing expected safeguard/behavior: {token}')
    intro_api = (ROOT/'api/introductions.js').read_text(encoding='utf-8')
    for token in ['requestHasValidOrigin','getSessionUser','isMutuallyCompatible','recipient_id = ${user.id}','accept','decline']:
        if token not in intro_api:
            errors.append(f'Introductions API missing expected safeguard/behavior: {token}')
    migrations = (ROOT/'db/migrations/002_discovery_matching.sql').read_text(encoding='utf-8')
    for token in ['ADD COLUMN IF NOT EXISTS discoverable','dc_introduction_requests','dc_intro_pair_unique_idx']:
        if token not in migrations:
            errors.append(f'Discovery migration missing expected schema item: {token}')

if errors:
    print('FAIL')
    print('\n'.join('- '+e for e in errors))
    sys.exit(1)
print(f'PASS: {len(required)} required files exist; pages/assets, schema, profile ownership, opt-in discovery, mutual-compatibility and authentication security checks passed.')
