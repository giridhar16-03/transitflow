import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sqnexwoxccgjjrnwlzef.supabase.co';
// Use anon key
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbmV4d294Y2NnampybndsemVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA1MDYsImV4cCI6MjA5NTcwNjUwNn0.7b966fD3k_67c3WwT3J6D2kG2bL0c9s-j7P6uV9wH_0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealtimeAnon() {
  console.log("Subscribing to drivers table with ANON key...");
  const chan = supabase.channel('test-anon-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
      console.log('Received realtime event with ANON key:', payload.eventType, payload.new?.id, 'lat:', payload.new?.latitude);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        // Trigger an update using the service role key in another process, or just use the local anon key to trigger an error (won't work because RLS prevents anon from updating)
        console.log("Waiting for update...");
      }
    });
}

checkRealtimeAnon();
