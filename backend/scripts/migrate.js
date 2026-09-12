// backend/scripts/migrate.js
//
// Applies every backend/supabase/migrations/*.sql to the HOSTED Supabase
// Postgres, in filename order, each file exactly once, inside its own
// transaction. No Supabase CLI required — connects directly with node-postgres
// (the CLI's unsigned binary is blocked by Windows Smart App Control here).
//
//   npm run migrate                 apply pending migrations
//   npm run migrate -- --baseline   mark ALL current files as applied WITHOUT
//                                   running them (use when the schema was
//                                   already created by hand in the dashboard,
//                                   so the tracker starts in sync)
//
// Set SUPABASE_DB_URL in backend/.env.local to the project's **Session pooler**
// URI (Dashboard -> Connect -> Session pooler). Session mode (port 5432) is
// required because each migration runs in an explicit BEGIN/COMMIT spanning
// several statements.

const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { BACKEND_DIR, connect } = require('./db');

const MIGRATIONS_DIR = join(BACKEND_DIR, 'supabase', 'migrations');
const BASELINE = process.argv.includes('--baseline');

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No .sql files in supabase/migrations/. Nothing to do.');
    return;
  }

  const client = await connect();

  try {
    // Tracker lives in a private schema (not `public`, so it is never exposed
    // through PostgREST).
    await client.query('create schema if not exists _migrations');
    await client.query(`
      create table if not exists _migrations.applied (
        version    text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query('select version from _migrations.applied');
    const applied = new Set(rows.map((r) => r.version));

    if (BASELINE) {
      const pending = files.filter((f) => !applied.has(f));
      for (const file of pending) {
        await client.query('insert into _migrations.applied (version) values ($1)', [file]);
        console.log(`[baseline] ${file}`);
      }
      console.log(
        pending.length
          ? `\nMarked ${pending.length} file(s) as applied (not executed).`
          : '\nNothing to baseline — tracker already lists every file.',
      );
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[skip]  ${file}`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`[apply] ${file} ... `);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into _migrations.applied (version) values ($1)', [file]);
        await client.query('commit');
        console.log('ok');
        ran += 1;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        console.log('FAILED');
        console.error(`\nx  ${file} failed and was rolled back:\n   ${err.message}\n`);
        if (/already exists/i.test(err.message)) {
          console.error(
            '   This object already exists — the schema was likely created by hand already.\n' +
              '   If the DB is already up to date, run:  npm run migrate -- --baseline\n',
          );
        } else {
          console.error('   Fix the migration or DB state, then re-run `npm run migrate`.\n');
        }
        process.exitCode = 1;
        return;
      }
    }
    console.log(ran ? `\nDone. Applied ${ran} migration(s).` : '\nDatabase already up to date.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nx  Unexpected error:', err.message);
  process.exit(1);
});
