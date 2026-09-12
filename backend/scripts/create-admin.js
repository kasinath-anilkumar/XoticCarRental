// backend/scripts/create-admin.js
//
// Creates — or re-points — a login for /admin.
//
//   npm run create-admin -- <email> <password> [--name "Full Name"]
//
// requireAdmin() in lib/admin/auth.ts demands two separate things, so this
// script does two separate things:
//
//   1. a Supabase auth user, created through the Auth admin API because only
//      GoTrue can hash the password and write the matching identity row;
//   2. a public.staff row with is_admin = true, written over the direct
//      Postgres connection the migrations already use.
//
// Re-running it on an existing email resets that user's password and re-grants
// admin rather than failing, which is what "I locked myself out" needs.
//
// Credentials come from the app's .env.local (NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY) and the database URL from backend/.env.local.
// Real environment variables win over both. Nothing secret is ever printed.

const { join } = require('node:path');
const { BACKEND_DIR, loadEnvFile, connect } = require('./db');

const ROOT_ENV = join(BACKEND_DIR, '..', '.env.local');

function parseArgs(argv) {
  const positional = [];
  let fullName = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--name') {
      fullName = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith('--name=')) {
      fullName = arg.slice('--name='.length);
    } else {
      positional.push(arg);
    }
  }

  const email = (positional[0] || process.env.ADMIN_EMAIL || '').trim();
  const password = positional[1] || process.env.ADMIN_PASSWORD || '';
  return { email, password, fullName };
}

function apiCredentials() {
  const fileEnv = loadEnvFile(ROOT_ENV);
  const get = (k) => process.env[k] || fileEnv[k] || '';

  const url = get('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');

  const missing = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(
      `${missing.join(' and ')} must be set in .env.local (project root) before an admin can be created.`,
    );
  }
  return { url, serviceKey };
}

async function authAdmin({ url, serviceKey }, path, init = {}) {
  const res = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  return { ok: res.ok, status: res.status, body };
}

function describeAuthError(result) {
  const b = result.body || {};
  return b.msg || b.message || b.error_description || b.error || `HTTP ${result.status}`;
}

/**
 * GoTrue's admin list endpoint takes a `filter` (a partial email match), but it
 * is a search, not a lookup: the exact address still has to be picked out of
 * the page it returns.
 */
async function findUserByEmail(creds, email) {
  const wanted = email.toLowerCase();
  const query = `?per_page=200&filter=${encodeURIComponent(email)}`;
  const result = await authAdmin(creds, `/users${query}`);
  if (!result.ok) {
    throw new Error(`Could not look up existing users: ${describeAuthError(result)}`);
  }
  const users = result.body?.users || [];
  return users.find((u) => (u.email || '').toLowerCase() === wanted) || null;
}

async function createOrUpdateUser(creds, email, password) {
  const created = await authAdmin(creds, '/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (created.ok) return { user: created.body, existed: false };

  const message = describeAuthError(created);
  const alreadyRegistered =
    created.status === 422 ||
    created.body?.error_code === 'email_exists' ||
    /already been registered|already registered|already exists/i.test(message);

  if (!alreadyRegistered) {
    throw new Error(`Could not create the auth user: ${message}`);
  }

  const existing = await findUserByEmail(creds, email);
  if (!existing) {
    throw new Error(
      `Supabase says ${email} is already registered, but it was not returned by the admin user search. ` +
        'Check Authentication -> Users in the dashboard.',
    );
  }

  const updated = await authAdmin(creds, `/users/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!updated.ok) {
    throw new Error(`Could not reset the password for ${email}: ${describeAuthError(updated)}`);
  }

  return { user: updated.body || existing, existed: true };
}

async function grantStaff(user, email, fullName) {
  const client = await connect();
  try {
    const { rows } = await client.query(
      `insert into public.staff (user_id, email, full_name, is_admin)
       values ($1, $2, $3, true)
       on conflict (user_id) do update
         set email     = excluded.email,
             full_name = coalesce(excluded.full_name, public.staff.full_name),
             is_admin  = true
       returning is_admin`,
      [user.id, email, fullName],
    );
    return rows[0];
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const { email, password, fullName } = parseArgs(process.argv.slice(2));

  if (!email || !password) {
    console.error(
      [
        '',
        'x  Usage: npm run create-admin -- <email> <password> [--name "Full Name"]',
        '',
        '   Or set ADMIN_EMAIL and ADMIN_PASSWORD in the environment to keep the',
        '   password out of your shell history.',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const creds = apiCredentials();

  const { user, existed } = await createOrUpdateUser(creds, email, password);
  console.log(existed ? `~  Existing auth user found; password reset: ${email}` : `+  Auth user created: ${email}`);

  await grantStaff(user, email, fullName);
  console.log(`+  staff row set to is_admin = true (user_id ${user.id})`);
  console.log('\nDone. Sign in at /admin/login.');
}

main().catch((err) => {
  console.error(`\nx  ${err.message}\n`);
  process.exitCode = 1;
});
