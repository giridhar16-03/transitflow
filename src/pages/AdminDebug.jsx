import { useEffect, useState, useRef } from 'react';
import { supabase, hasSupabase } from '../lib/supabase';
import { Button, Card, Badge } from '../components/ui.jsx';
import { BusFront, Database, RefreshCw } from 'lucide-react';

export function AdminDebug() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const chanRef = useRef(null);

  const fetchDrivers = async () => {
    if (!hasSupabase || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('drivers')
      .select('id,display_name,bus_code,latitude,longitude,last_seen,trip_status')
      .order('last_seen', { ascending: false })
      .limit(200);
    if (error) console.error('fetch drivers', error);
    setDrivers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    fetchDrivers();

    if (!hasSupabase || !supabase) return;

    const chan = supabase
      .channel('admin:drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
        const evt = payload.eventType || payload.event;
        const record = payload.new || payload.record;
        if (!record || !mounted) return;
        setDrivers((prev) => {
          if (evt === 'INSERT') return [record, ...prev];
          if (evt === 'DELETE') return prev.filter((d) => d.id !== record.id);
          return prev.map((d) => (d.id === record.id ? record : d));
        });
      })
      .subscribe();
    chanRef.current = chan;

    return () => {
      mounted = false;
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Header */}
      <header className="border-b border-[rgba(232,232,227,0.06)] bg-[rgba(8,8,7,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
          <Button variant="ghost" to="/" className="px-0 hover:bg-transparent">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
              <Database className="h-4 w-4" />
            </div>
            <span className="hidden font-display text-lg sm:inline text-foreground">TransitFlow Admin</span>
            <span className="font-display text-base sm:hidden text-foreground">Admin</span>
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${hasSupabase ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
              {hasSupabase ? 'Connected' : 'No Supabase'}
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchDrivers} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl text-foreground sm:text-2xl">Driver Debug Panel</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Live view of all registered drivers · Updates in real-time
            </p>
          </div>
          <Badge>{drivers.length} drivers</Badge>
        </div>

        {!hasSupabase ? (
          <Card className="p-6 text-center">
            <Database className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
            <div className="text-sm font-medium text-foreground">Supabase not configured</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to see live driver data.
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(232,232,227,0.08)] bg-[rgba(232,232,227,0.03)]">
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">ID</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Name</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Bus Code</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Status</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Latitude</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Longitude</th>
                    <th className="p-3 text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className="border-b border-[rgba(232,232,227,0.06)] transition-colors hover:bg-[rgba(232,232,227,0.03)]">
                      <td className="p-3 align-top text-xs text-muted-foreground break-all" style={{ maxWidth: 200 }}>{d.id}</td>
                      <td className="p-3 align-top font-medium text-foreground">{d.display_name || '—'}</td>
                      <td className="p-3 align-top">
                        <Badge>{d.bus_code || '—'}</Badge>
                      </td>
                      <td className="p-3 align-top">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${d.trip_status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                          {d.trip_status === 'active' ? 'Active' : 'Idle'}
                        </span>
                      </td>
                      <td className="p-3 align-top text-xs text-muted-foreground">{d.latitude ?? '—'}</td>
                      <td className="p-3 align-top text-xs text-muted-foreground">{d.longitude ?? '—'}</td>
                      <td className="p-3 align-top text-xs text-muted-foreground">
                        {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {drivers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <BusFront className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                        <div className="text-sm text-muted-foreground">No drivers found</div>
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="h-6 w-6 mx-auto rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                        <div className="mt-2 text-xs text-muted-foreground">Loading drivers…</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

export default AdminDebug;
