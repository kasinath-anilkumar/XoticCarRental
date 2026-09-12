// Import the former embedded service definitions without overwriting admin edits.
const { connect } = require('./db');
const services = require('../service-seed-data.json');

async function main() {
  const db = await connect();
  try {
    await db.query('begin');
    let inserted = 0;
    for (const [sort, service] of services.entries()) {
      const result = await db.query(`insert into public.services (slug, definition, is_active, sort)
        values ($1, $2::jsonb, true, $3) on conflict (slug) do nothing`, [service.slug, JSON.stringify(service), sort]);
      inserted += result.rowCount;
    }
    await db.query('commit');
    console.log(`Imported ${inserted} service(s); existing service content was preserved.`);
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
