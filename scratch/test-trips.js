import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sqnexwoxccgjjrnwlzef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbmV4d294Y2NnampybndsemVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDEzMDUwNiwiZXhwIjoyMDk1NzA2NTA2fQ.ah5nMb2WB5k8y7jtIUdCEA4erkFbWSZRn7_WmtewzSU'; // Using service role to bypass RLS and fetch policies, or we can use anon key if we log in.

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
  const payload = {
    user_id: 'fcdf0876-b392-4924-8649-d1d46a9ba984',
    display_name: 'roshan',
    email: '10k@gmail.com',
    bus_code: '10K',
    bus_number: '10K',
    latitude: 12.9718,
    longitude: 77.5946,
    last_seen: new Date().toISOString(),
    driver_key_id: 'DRV-FCDF0876B392'
  };
  const { data, error } = await supabase.from('drivers').upsert(payload, { onConflict: 'user_id' });
  console.log('Upsert result:', error ? error : 'Success', data);
}
testUpsert();
