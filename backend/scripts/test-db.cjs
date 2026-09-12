const { afterEach, test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { connect, describeConnectionError, validateConnectionString, resolveConnectionString } = require('./db');

const originalUrl = process.env.SUPABASE_DB_URL;
const originalPassword = process.env.SUPABASE_DB_PASSWORD;
const testUrl = 'postgresql://postgres:private%40password@db.example.test:5432/postgres';
afterEach(() => {
  mock.restoreAll();
  if (originalUrl === undefined) delete process.env.SUPABASE_DB_URL;
  else process.env.SUPABASE_DB_URL = originalUrl;
  if (originalPassword === undefined) delete process.env.SUPABASE_DB_PASSWORD;
  else process.env.SUPABASE_DB_PASSWORD = originalPassword;
});

test('rejects a Supabase HTTPS API URL before making any database connection', async () => {
  process.env.SUPABASE_DB_URL = 'https://project.example.supabase.co';
  const attempt = mock.method(Client.prototype, 'connect', async () => {});
  await assert.rejects(connect(), /HTTPS project URL is for the Supabase API/);
  assert.equal(attempt.mock.callCount(), 0);
});

test('accepts complete PostgreSQL URLs and rejects missing fields without logging their contents', () => {
  assert.equal(validateConnectionString(testUrl).protocol, 'postgresql:');
  assert.equal(validateConnectionString(testUrl.replace('postgresql:', 'postgres:')).port, '5432');
  assert.throws(() => validateConnectionString('postgresql://db.example.test'), /host, username and database name/);
  assert.throws(() => validateConnectionString('not a URI'), /valid PostgreSQL connection URI/);
});

test('expands encoded database passwords from placeholders', () => {
  process.env.SUPABASE_DB_URL = 'postgresql://postgres:[YOUR-PASSWORD]@db.example.test:5432/postgres';
  process.env.SUPABASE_DB_PASSWORD = 'private@pass#word';
  assert.equal(resolveConnectionString(), 'postgresql://postgres:private%40pass%23word@db.example.test:5432/postgres');
});

test('explains the child network failures of an AggregateError with a blank message', () => {
  const error = new AggregateError([
    Object.assign(new Error('connect ECONNREFUSED ::1:5432'), { code: 'ECONNREFUSED', address: '::1', port: 5432 }),
    Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED', address: '127.0.0.1', port: 5432 }),
  ], '');
  const output = describeConnectionError(error, testUrl);
  assert.match(output, /ECONNREFUSED/);
  assert.match(output, /127\.0\.0\.1:5432/);
  assert.match(output, /::1:5432/);
});

test('redacts URI and encoded/raw password values, including nested errors', () => {
  const error = new AggregateError([new Error(`URI ${testUrl}`), new Error('private@password private%40password')], '');
  const output = describeConnectionError(error, testUrl);
  assert.ok(!output.includes(testUrl));
  assert.ok(!output.includes('private@password'));
  assert.ok(!output.includes('private%40password'));
  assert.match(output, /redacted/);
});

test('provides a useful fallback for empty errors and prevents cyclic causes from looping', () => {
  assert.match(describeConnectionError(new Error('')), /Unknown connection error/);
  const error = Object.assign(new Error('DNS failure'), { code: 'ENOTFOUND' });
  error.cause = error;
  assert.match(describeConnectionError(error), /hostname could not be resolved/);
});

test('bounds connection attempts to ten seconds and closes rejected clients', async () => {
  process.env.SUPABASE_DB_URL = testUrl;
  let timeout;
  mock.method(Client.prototype, 'connect', async function () {
    timeout = this._connectionTimeoutMillis;
    throw Object.assign(new Error('timeout expired'), { code: 'ETIMEDOUT' });
  });
  const close = mock.method(Client.prototype, 'end', async () => {});
  await assert.rejects(connect(), /ETIMEDOUT.*timeout expired[\s\S]*connection timed out/);
  assert.equal(timeout, 10_000);
  assert.equal(close.mock.callCount(), 1);
});

test('identifies PostgreSQL authentication errors without exposing passwords', () => {
  const message = describeConnectionError(Object.assign(new Error('password authentication failed'), { code: '28P01' }), testUrl);
  assert.match(message, /database rejected authentication/);
  assert.match(message, /not an anon or service-role API key/);
  assert.ok(!message.includes('private'));
});
