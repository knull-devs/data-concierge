#!/usr/bin/env node
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, requestHasValidOrigin, readCookie } from '../api/_lib/auth.js';
import registerHandler from '../api/auth/register.js';
import loginHandler from '../api/auth/login.js';

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(body = '') { this.body = String(body); this.ended = true; }
  };
}

async function call(handler, req) {
  const res = responseMock();
  await handler(req, res);
  return { res, body: JSON.parse(res.body || '{}') };
}

const encoded = await hashPassword('correct horse battery staple');
assert.equal(await verifyPassword('correct horse battery staple', encoded), true, 'correct password verifies');
assert.equal(await verifyPassword('incorrect password', encoded), false, 'incorrect password is rejected');

assert.equal(requestHasValidOrigin({ headers: { origin: 'https://dc.example', host: 'dc.example', 'x-forwarded-proto': 'https' } }), true, 'matching HTTPS origin is allowed');
assert.equal(requestHasValidOrigin({ headers: { origin: 'https://attacker.example', host: 'dc.example', 'x-forwarded-proto': 'https' } }), false, 'cross-origin requests are rejected');
assert.equal(requestHasValidOrigin({ headers: { host: 'dc.example' } }), false, 'missing Origin is rejected for state-changing endpoints');
assert.equal(readCookie({ headers: { cookie: 'a=1; dc_session=abc123; other=2' } }, 'dc_session'), 'abc123');

const baseHeaders = { origin: 'https://dc.example', host: 'dc.example', 'x-forwarded-proto': 'https', 'content-type': 'application/json' };
const methodCase = await call(registerHandler, { method: 'GET', headers: baseHeaders });
assert.equal(methodCase.res.statusCode, 405, 'registration only accepts POST');

const noOrigin = await call(registerHandler, {
  method: 'POST', headers: { host: 'dc.example', 'content-type': 'application/json' },
  body: { name: 'Test User', email: 'test@example.com', password: 'long-password-123', birthDate: '1990-01-01', city: 'Jaipur', confirmAdult: true, acceptTerms: true }
});
assert.equal(noOrigin.res.statusCode, 403, 'registration rejects missing origin');

const underage = await call(registerHandler, {
  method: 'POST', headers: baseHeaders,
  body: { name: 'Test User', email: 'test@example.com', password: 'long-password-123', birthDate: '2012-01-01', city: 'Jaipur', confirmAdult: true, acceptTerms: true }
});
assert.equal(underage.res.statusCode, 400, 'registration rejects under-18 users on the server');

const oldDbUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
const validLoginWithoutDb = await call(loginHandler, {
  method: 'POST', headers: baseHeaders,
  body: { email: 'test@example.com', password: 'long-password-123', remember: false }
});
assert.equal(validLoginWithoutDb.res.statusCode, 503, 'login fails clearly rather than pretending auth succeeded without a database');
if (oldDbUrl !== undefined) process.env.DATABASE_URL = oldDbUrl;

console.log('PASS: password hashing, origin checks, cookie parsing, method validation, adult gate and missing-database behavior.');
