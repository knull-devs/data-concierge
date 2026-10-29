import assert from 'node:assert/strict';
import { normalizeAccountInput, validatePasswordChange } from '../api/_lib/account.js';
import { isValidIntroductionId, normalizeMessage, MAX_MESSAGE_LENGTH } from '../api/_lib/messages.js';

const account = normalizeAccountInput({ displayName: '  Deven   Kashyap ', city: ' Delhi   NCR ' });
assert.equal(account.ok, true);
assert.deepEqual(account.account, { displayName: 'Deven Kashyap', city: 'Delhi NCR' });
assert.equal(normalizeAccountInput({ displayName: 'D', city: 'Delhi' }).ok, false);
assert.equal(normalizeAccountInput({ displayName: 'Deven', city: 'D' }).ok, false);
assert.equal(normalizeAccountInput({ displayName: 'Deven\nInjected', city: 'Delhi' }).account.displayName, 'Deven Injected');
assert.equal(normalizeAccountInput([]).ok, false);

assert.equal(validatePasswordChange({ currentPassword: 'oldPassword!123', newPassword: 'newPassword!456', remember: true }).ok, true);
assert.equal(validatePasswordChange({ currentPassword: '', newPassword: 'newPassword!456' }).ok, false);
assert.equal(validatePasswordChange({ currentPassword: 'samePassword123', newPassword: 'samePassword123' }).ok, false);
assert.equal(validatePasswordChange({ currentPassword: 'oldPassword123', newPassword: 'short' }).ok, false);

assert.equal(normalizeMessage('  Hello there!  ').message, 'Hello there!');
assert.equal(normalizeMessage('line 1\r\nline 2').message, 'line 1\nline 2');
assert.equal(normalizeMessage('   ').ok, false);
assert.equal(normalizeMessage('not\u0000safe').ok, false);
assert.equal(normalizeMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1)).ok, false);
assert.equal(isValidIntroductionId('1d8b6a2f-5e63-4a12-9b44-1098457ba1cd'), true);
assert.equal(isValidIntroductionId('../../auth'), false);
assert.equal(isValidIntroductionId(''), false);

console.log('PASS: account field validation, password change checks, safe message normalization and conversation ID validation.');
