import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Usage: node server/scripts/create_test_users.js
// Creates exactly ONE test driver and ONE test commuter (public user)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const TEST_ACCOUNTS = [
  {
    type: 'driver',
    email: 'testdriver@transitflow.local',
    password: 'Test1234!',
    display_name: 'Test Driver',
    bus_code: '25P',
    bus_number: '25P-001',
    // Initial GPS coordinates (Bangalore city centre - will be overwritten by real GPS when trip starts)
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    type: 'user',
    email: 'testuser@transitflow.local',
    password: 'Test1234!',
    display_name: 'Test Commuter',
  },
];

async function findOrCreateUser(supabase, account) {
  const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (listData?.users || []).find(u => u.email === account.email);

  if (existing) {
    console.log(`  ↳ Already exists: ${account.email} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.display_name },
  });

  if (error) {
    console.error(`  ✗ Failed to create ${account.email}:`, error.message);
    return null;
  }

  console.log(`  ✓ Created ${account.email} (${data.user.id})`);
  return data.user.id;
}

async function seed() {
  console.log('\n🚌 TransitFlow — seeding test accounts\n');

  for (const account of TEST_ACCOUNTS) {
    console.log(`[${account.type.toUpperCase()}] ${account.email}`);
    const userId = await findOrCreateUser(supabase, account);
    if (!userId) continue;

    // Upsert auth_accounts record
    const { error: accErr } = await supabase.from('auth_accounts').upsert({
      user_id: userId,
      email: account.email,
      role: account.type === 'driver' ? 'public-driver' : 'public-user',
      provider: 'password',
      has_password: true,
      display_name: account.display_name,
      bus_code: account.bus_code || null,
    }, { onConflict: 'user_id' });

    if (accErr) console.warn(`  ⚠ auth_accounts upsert warning:`, accErr.message);

    // If driver, upsert drivers record
    if (account.type === 'driver') {
      const driverKeyId = `DRV-${account.bus_code}-001`;
      const { error: drvErr } = await supabase.from('drivers').upsert({
        user_id: userId,
        driver_key_id: driverKeyId,
        display_name: account.display_name,
        email: account.email,
        bus_code: account.bus_code,
        bus_number: account.bus_number,
        latitude: account.latitude,
        longitude: account.longitude,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (drvErr) console.warn(`  ⚠ drivers upsert warning:`, drvErr.message);
      else console.log(`  ↳ Driver row seeded — bus: ${account.bus_code} / ${account.bus_number}`);
    }

    console.log(`  ↳ Password: ${account.password}\n`);
  }

  console.log('✅ Done!\n');
  console.log('Test credentials:');
  console.log('  Driver  → testdriver@transitflow.local / Test1234!');
  console.log('  Commuter → testuser@transitflow.local  / Test1234!\n');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
