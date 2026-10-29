#!/usr/bin/env python3
"""Dependency-free sanity checks for the Date Concierge standalone project."""
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
required = [
    'index.html','register.html','login.html','dashboard.html','terms.html','privacy.html',
    'discover.html','introductions.html','profile.html','account.html','messages.html','notifications.html','settings.html','date-plans.html',
    'assets/css/site.css','assets/css/profile.css','assets/css/discovery.css','assets/css/account.css','assets/css/messages.css','assets/css/dashboard.css','assets/css/member-tools.css',
    'assets/js/site.js','assets/js/dashboard.js','assets/js/register-redirect.js','assets/js/login-redirect.js',
    'assets/js/profile.js','assets/js/discover.js','assets/js/introductions.js','assets/js/account.js','assets/js/messages.js','assets/js/notifications.js','assets/js/settings.js','assets/js/date-plans.js','assets/js/dashboard.js','assets/img/hero-couple.webp',
    'api/_lib/auth.js','api/_lib/profile.js','api/_lib/matchmaking.js','api/_lib/account.js','api/_lib/messages.js','api/_lib/notifications.js','api/_lib/date-plans.js','api/account/me.js','api/account/password.js','api/messages.js','api/notifications.js','api/settings.js','api/date-plans.js',
    'api/auth/register.js','api/auth/login.js','api/auth/me.js','api/auth/logout.js',
    'api/health.js','api/profile/me.js','api/matches/recommendations.js','api/introductions.js',
    'db/schema.sql','db/migrations/001_member_profiles.sql','db/migrations/002_discovery_matching.sql','db/migrations/003_messages.sql','db/migrations/004_notifications_settings.sql','db/migrations/005_date_plans.sql',
    'package.json','vercel.json','README.md','THIRD_PARTY_NOTICES.md',
    'tools/smoke-auth.mjs','tools/smoke-profile.mjs','tools/smoke-matches.mjs','tools/smoke-account-messages.mjs','tools/smoke-notifications-dateplans.mjs',
    'docs/PH7-REUSE-MAP.md'
]
missing = [item for item in required if not (ROOT/item).exists()]
errors = []
if missing:
    errors.append('Missing required files: '+', '.join(missing))

root_routes = {'/', '/dashboard.html', '/terms.html', '/privacy.html', '/register.html', '/login.html',
               '/profile.html', '/discover.html', '/introductions.html', '/account.html', '/messages.html',
               '/notifications.html', '/settings.html', '/date-plans.html'}

def check_assets(page_name):
    page_path = ROOT / page_name
    if not page_path.exists():
        return
    text = page_path.read_text(encoding='utf-8')
    for asset in re.findall(r'(?:src|href)="(/[^"#?]+)', text):
        if asset.startswith('/api/') or asset in root_routes:
            continue
        # User-selected hero.mp4 is an optional media asset. The homepage keeps
        # its poster fallback until the owner adds the actual video file.
        if asset == '/assets/video/hero.mp4' and not (ROOT/'assets/video/hero.mp4').exists():
            continue
        clean = asset.lstrip('/')
        if not (ROOT/clean).exists():
            errors.append(f'Broken local asset reference in {page_name}: {asset}')

if not missing:
    index = (ROOT/'index.html').read_text(encoding='utf-8')
    for phrase in ['How it works','About','Pricing','T&amp;C','auth-modal','login-form','register-form',
                   'data-auth-open','mobile-nav-toggle','auth-provider-row','data-auth-provider']:
        if phrase not in index:
            errors.append(f'index.html missing expected UI marker: {phrase}')
    for page in ['index.html','profile.html','discover.html','introductions.html','dashboard.html','account.html','messages.html','notifications.html','settings.html','date-plans.html']:
        check_assets(page)

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
    if any('style=' in (ROOT/page).read_text(encoding='utf-8') for page in ['terms.html','privacy.html','notifications.html','settings.html','date-plans.html']):
        errors.append('Inline styles found on member/legal pages while strict CSP is enabled')

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

    account_api = (ROOT/'api/account/me.js').read_text(encoding='utf-8')
    for token in ['requestHasValidOrigin','getSessionUser','enforceRateLimit','UPDATE dc_auth_users']:
        if token not in account_api:
            errors.append(f'Account API missing expected safeguard/behavior: {token}')
    password_api = (ROOT/'api/account/password.js').read_text(encoding='utf-8')
    for token in ['verifyPassword','hashPassword','DELETE FROM dc_auth_sessions','createSession']:
        if token not in password_api:
            errors.append(f'Password API missing expected security behavior: {token}')
    messages_api = (ROOT/'api/messages.js').read_text(encoding='utf-8')
    for token in ['getSessionUser',"status = 'accepted'",'requestHasValidOrigin','enforceRateLimit','INSERT INTO dc_messages']:
        if token not in messages_api:
            errors.append(f'Messages API missing expected safeguard/behavior: {token}')
    messages_migration = (ROOT/'db/migrations/003_messages.sql').read_text(encoding='utf-8')
    for token in ['dc_messages','REFERENCES dc_introduction_requests','dc_messages_conversation_created_idx']:
        if token not in messages_migration:
            errors.append(f'Messages migration missing expected schema item: {token}')
    dashboard = (ROOT/'dashboard.html').read_text(encoding='utf-8')
    for token in ['href="/messages.html"','href="/account.html"','href="/notifications.html"','href="/date-plans.html"','dashboard-recent-messages-list']:
        if token not in dashboard:
            errors.append(f'Dashboard is missing new route/data marker: {token}')
    intro_message = 'Your private conversation is now available in Messages.'
    if intro_message not in intro_api:
        errors.append('Introduction acceptance message has not been updated for the Messages module')
    account_page = (ROOT/'account.html').read_text(encoding='utf-8')
    for token in ['account-form','password-form','account-city','account-email']:
        if token not in account_page:
            errors.append(f'Account page missing form marker: {token}')
    messages_page = (ROOT/'messages.html').read_text(encoding='utf-8')
    for token in ['conversation-list','message-form','message-list','messages-workspace']:
        if token not in messages_page:
            errors.append(f'Messages page missing UI marker: {token}')

    notification_api = (ROOT/'api/notifications.js').read_text(encoding='utf-8')
    for token in ['getSessionUser','requestHasValidOrigin','markAllRead','dc_notifications','WHERE user_id = ${user.id}']:
        if token not in notification_api:
            errors.append(f'Notifications API missing expected safeguard/behavior: {token}')
    settings_api = (ROOT/'api/settings.js').read_text(encoding='utf-8')
    for token in ['getSessionUser','requestHasValidOrigin','dc_member_settings','isDiscoveryReady','body.discoverable']:
        if token not in settings_api:
            errors.append(f'Settings API missing expected safeguard/behavior: {token}')
    date_api = (ROOT/'api/date-plans.js').read_text(encoding='utf-8')
    for token in ['getSessionUser','requestHasValidOrigin','normalizeDateProposal',"status = 'accepted'",'createNotificationBestEffort']:
        if token not in date_api:
            errors.append(f'Date plans API missing expected safeguard/behavior: {token}')
    notifications_migration = (ROOT/'db/migrations/004_notifications_settings.sql').read_text(encoding='utf-8')
    for token in ['dc_member_settings','dc_notifications','introduction_updates','date_updates']:
        if token not in notifications_migration:
            errors.append(f'Notifications migration missing expected schema item: {token}')
    date_migration = (ROOT/'db/migrations/005_date_plans.sql').read_text(encoding='utf-8')
    for token in ['dc_date_plans','dc_introduction_requests','dc_date_plans_one_active_per_intro_idx']:
        if token not in date_migration:
            errors.append(f'Date-plans migration missing expected schema item: {token}')
    for page, markers in {
        'notifications.html': ['notifications-list','notifications-mark-all','/api/notifications'],
        'settings.html': ['settings-form','setting-discoverable','/api/settings'],
        'date-plans.html': ['date-proposal-form','date-plans-list','/api/date-plans']
    }.items():
        page_text = (ROOT/page).read_text(encoding='utf-8')
        for marker in markers:
            if marker not in page_text and marker not in (ROOT/'assets/js'/page.replace('.html','.js')).read_text(encoding='utf-8'):
                errors.append(f'{page} missing expected feature marker: {marker}')

if errors:
    print('FAIL')
    print('\n'.join('- '+e for e in errors))
    sys.exit(1)
print(f'PASS: {len(required)} required files exist; page assets, profile/discovery security, account/password flows, accepted-introduction messaging and migration checks passed.')
