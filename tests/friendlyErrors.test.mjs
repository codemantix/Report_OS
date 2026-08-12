import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../utils/friendlyErrors.js', import.meta.url),
  'utf8'
);
const module = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const {
  friendlyErrorMessage,
  isNetworkError,
  isResponseParseError,
  isSessionError,
  safeParseJsonResponse,
  NETWORK_ERROR_MESSAGE,
  RESPONSE_PARSE_ERROR_MESSAGE,
  SESSION_ERROR_MESSAGE,
} = module;

test('network failures produce a clear connectivity message, never raw jargon', () => {
  const dnsError = new TypeError('fetch failed');
  dnsError.cause = { code: 'ENOTFOUND', hostname: 'vrsxdrcusfuaplttphwu.supabase.co', message: 'getaddrinfo ENOTFOUND' };

  assert.equal(isNetworkError(dnsError), true);
  assert.equal(friendlyErrorMessage(dnsError), NETWORK_ERROR_MESSAGE);
  assert.doesNotMatch(friendlyErrorMessage(dnsError), /ENOTFOUND|fetch failed|getaddrinfo/i);
});

test('supabase-style network errors are recognized', () => {
  const error = { message: 'Failed to fetch', code: 'ERR_NETWORK' };
  assert.equal(isNetworkError(error), true);
  assert.equal(friendlyErrorMessage(error), NETWORK_ERROR_MESSAGE);
});

test('missing or expired sessions produce a sign-in message', () => {
  assert.equal(isSessionError(new Error('Authentication is required.')), true);
  assert.equal(friendlyErrorMessage(new Error('Authentication is required.')), SESSION_ERROR_MESSAGE);
  assert.equal(friendlyErrorMessage(new Error('Your session has expired. Please sign in again.')), SESSION_ERROR_MESSAGE);
});

test('readable server messages pass through unchanged', () => {
  assert.equal(friendlyErrorMessage(new Error('Employee evaluation was not found.')), 'Employee evaluation was not found.');
  assert.equal(friendlyErrorMessage('Evaluation period is locked.'), 'Evaluation period is locked.');
});

test('HTML responses served where JSON was expected produce a clear message, not a JSON parse error', () => {
  const parseError = new SyntaxError('Unexpected token \'<\', "<!DOCTYPE html>..." is not valid JSON');

  assert.equal(isResponseParseError(parseError), true);
  assert.equal(friendlyErrorMessage(parseError), RESPONSE_PARSE_ERROR_MESSAGE);
  assert.doesNotMatch(friendlyErrorMessage(parseError), /Unexpected token|DOCTYPE|not valid JSON/i);
});

test('non-JSON fetch responses parse safely without throwing', async () => {
  const htmlResponse = {
    ok: false,
    status: 404,
    json: async () => { throw new SyntaxError('Unexpected token \'<\', "<!DOCTYPE html>" is not valid JSON'); },
  };
  const result = await safeParseJsonResponse(htmlResponse);

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.data, null);
  assert.equal(result.parseError, RESPONSE_PARSE_ERROR_MESSAGE);
});

test('valid JSON responses parse normally', async () => {
  const jsonResponse = {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { id: 'abc' } }),
  };
  const result = await safeParseJsonResponse(jsonResponse);

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { success: true, data: { id: 'abc' } });
  assert.equal(result.parseError, undefined);
});

test('garbage and empty errors fall back to a neutral message', () => {
  assert.equal(friendlyErrorMessage(null), 'Something went wrong. Please try again.');
  assert.equal(friendlyErrorMessage(undefined), 'Something went wrong. Please try again.');
  assert.equal(friendlyErrorMessage(new Error('[object Object]')), 'Something went wrong. Please try again.');
  assert.equal(friendlyErrorMessage(new Error('')), 'Something went wrong. Please try again.');
  assert.equal(friendlyErrorMessage({}), 'Something went wrong. Please try again.');
  assert.equal(friendlyErrorMessage(new Error('x'.repeat(300))), 'Something went wrong. Please try again.');
});
