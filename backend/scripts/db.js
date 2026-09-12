// backend/scripts/db.js
//
// Shared connection handling for migrate.js and seed.js.
//
// The Supabase CLI cannot run on this machine — Windows Smart App Control
// blocks its unsigned binary on every install channel — so both scripts talk
// to the hosted Postgres directly with node-postgres. `pg` is the only
// dependency; the .env parser below is deliberately minimal so it stays that
// way.

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const BACKEND_DIR = join(__dirname, '..');
const ENV_PATH = join(BACKEND_DIR, '.env.local');
const CONNECT_TIMEOUT_MS = 10_000;

function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function resolveConnectionString() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const get = (k) => process.env[k] || fileEnv[k] || '';

  let url = get('SUPABASE_DB_URL') || get('DATABASE_URL');
  if (!url) return '';

  // Convenience: paste the dashboard URI verbatim (it keeps a password
  // placeholder) and put the raw password in SUPABASE_DB_PASSWORD — we
  // URL-encode it so special characters cannot break the connection string.
  const placeholder = /\[YOUR-PASSWORD\]|<db-password>|\[db-password\]/i;
  if (placeholder.test(url)) {
    const password = get('SUPABASE_DB_PASSWORD');
    if (!password) {
      throw new Error(
        'SUPABASE_DB_URL still contains a password placeholder. ' +
          'Replace it with the database password, or set SUPABASE_DB_PASSWORD in backend/.env.local.',
      );
    }
    url = url.replace(placeholder, encodeURIComponent(password));
  }
  return url;
}

function missingConnMessage() {
  return [
    '',
    'x  No database connection string found.',
    '',
    '   Copy the exact PostgreSQL URI from Supabase dashboard -> Connect -> "Session pooler"',
    '   into SUPABASE_DB_URL in backend/.env.local. Do not use the HTTPS project API URL.',
    '',
    '   Use the SESSION pooler (port 5432), not the transaction pooler (6543): each',
    '   migration runs inside its own BEGIN/COMMIT. The <db-password> is the database',
    '   password (Settings -> Database), NOT the service_role key.',
    '',
  ].join('\n');
}

function validateConnectionString(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch {
    throw new Error('SUPABASE_DB_URL must be a valid PostgreSQL connection URI copied from Supabase dashboard -> Connect -> Session pooler.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(
      'SUPABASE_DB_URL contains a non-PostgreSQL URL. The HTTPS project URL is for the Supabase API, not database migrations. ' +
      'Copy the exact postgresql:// URI from Supabase dashboard -> Connect -> Session pooler into backend/.env.local, including its database username and password.',
    );
  }
  if (!url.hostname || !url.username || !url.pathname || url.pathname === '/') {
    throw new Error('SUPABASE_DB_URL must include the database host, username and database name. Copy the complete Session pooler URI from Supabase dashboard -> Connect.');
  }
  if (url.hash) {
    throw new Error('SUPABASE_DB_URL contains an unescaped # character. URL-encode the database password, or use the password placeholder with SUPABASE_DB_PASSWORD.');
  }
  return url;
}

/** Node may throw AggregateError with an empty message and useful child errors. */
function describeConnectionError(error, connectionString = '') {
  const secrets = [connectionString];
  try {
    const password = new URL(connectionString).password;
    if (password) secrets.push(password, decodeURIComponent(password));
  } catch { /* An invalid URI is already rejected before a connection is opened. */ }
  const redact = (value) => {
    let text = String(value);
    for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
    return text.replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi, '[redacted connection URI]');
  };

  const lines = [];
  const codes = new Set();
  const seen = new Set();
  function visit(item, depth = 0) {
    if (item == null || depth > 4 || seen.has(item)) return;
    seen.add(item);
    if (typeof item !== 'object') {
      lines.push(redact(item));
      return;
    }
    const code = typeof item.code === 'string' ? item.code : '';
    const message = typeof item.message === 'string' ? item.message.trim() : '';
    if (code) codes.add(code);
    const address = typeof item.address === 'string' ? item.address : '';
    const endpoint = address ? `${address}${item.port ? `:${item.port}` : ''}` : '';
    if (message || code || endpoint) {
      lines.push(redact([code ? `[${code}]` : '', message, endpoint && !message.includes(endpoint) ? `(${endpoint})` : ''].filter(Boolean).join(' ')));
    }
    if (Array.isArray(item.errors)) item.errors.slice(0, 8).forEach((child) => visit(child, depth + 1));
    if (item.cause) visit(item.cause, depth + 1);
  }
  visit(error);
  const detail = [...new Set(lines)].filter(Boolean).join('\n   ') || 'Unknown connection error (no message or error code was provided).';
  let hint = 'Verify the exact host, port and database password in the Session pooler URI copied from Supabase dashboard -> Connect.';
  if (codes.has('28P01')) hint = 'The database rejected authentication. Use the database password, not an anon or service-role API key.';
  else if (codes.has('ENOTFOUND') || codes.has('EAI_AGAIN')) hint = 'The configured database hostname could not be resolved. Verify the copied hostname and your DNS connection.';
  else if (codes.has('ENETUNREACH') || codes.has('EHOSTUNREACH')) hint = 'The database address is unreachable from this network. If the direct database endpoint requires unavailable IPv6, copy the Session pooler URI from the dashboard.';
  else if (codes.has('ETIMEDOUT') || /timeout/i.test(detail)) hint = 'The connection timed out. Check database availability and whether this network permits the configured PostgreSQL port.';
  return `${detail}\n\n   ${hint}`;
}

/** Connects or rejects with an actionable, credential-redacted error. */
async function connect() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(missingConnMessage());
  }
  validateConnectionString(connectionString);

  let client;
  try {
    client = new Client({
      connectionString,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      // Supabase requires TLS and the pooler's chain is not in Node's store.
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
  } catch (err) {
    if (client) await client.end().catch(() => {});
    throw new Error(`Could not connect to the database:\n   ${describeConnectionError(err, connectionString)}`);
  }

  return client;
}

module.exports = { BACKEND_DIR, loadEnvFile, resolveConnectionString, missingConnMessage, validateConnectionString, describeConnectionError, connect };
