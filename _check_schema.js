const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!(key in process.env)) process.env[key] = value;
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Check if report_tasks table has any columns at all (means it exists)
  const { data: cols, error: colErr } = await supabase
    .rpc('get_columns', { tbl_name: 'report_tasks' })
    .catch(() => ({ data: null, error: 'rpc not available' }));

  console.log('--- columns via rpc ---');
  console.log(cols, colErr);

  // Try a simpler check: just do count(*)
  const { count, error: countErr } = await supabase
    .from('report_tasks')
    .select('*', { count: 'exact', head: true });

  console.log('--- count(*) on report_tasks ---');
  console.log('count:', count, 'error:', JSON.stringify(countErr));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
