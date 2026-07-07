import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export function AdminDebug() {
  const [drivers, setDrivers] = useState([]);
  const chanRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const fetchInitial = async () => {
      const { data, error } = await supabase.from('drivers').select('id,display_name,bus_code,latitude,longitude,last_seen').order('last_seen', { ascending: false }).limit(200);
      if (error) return console.error('fetch drivers', error);
      if (mounted) setDrivers(data || []);
    };

    fetchInitial();

    const subscribe = () => {
      // subscribe to all changes on drivers table
      const chan = supabase.channel('admin:drivers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
          const evt = payload.eventType || payload.event;
          const record = payload.new || payload.record;
          setDrivers(prev => {
            if (evt === 'INSERT') return [record, ...prev];
            if (evt === 'DELETE') return prev.filter(d => d.id !== record.id);
            // UPDATE
            return prev.map(d => d.id === record.id ? record : d);
          });
        })
        .subscribe();
      chanRef.current = chan;
    };

    subscribe();

    return () => {
      mounted = false;
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Admin Debug — Drivers (live)</h2>
      <div className="overflow-auto max-h-[70vh] border rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Bus Code</th>
              <th className="p-2 text-left">Latitude</th>
              <th className="p-2 text-left">Longitude</th>
              <th className="p-2 text-left">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="odd:bg-white even:bg-slate-50">
                <td className="p-2 align-top break-all" style={{maxWidth:240}}>{d.id}</td>
                <td className="p-2 align-top">{d.display_name}</td>
                <td className="p-2 align-top">{d.bus_code}</td>
                <td className="p-2 align-top">{d.latitude ?? '—'}</td>
                <td className="p-2 align-top">{d.longitude ?? '—'}</td>
                <td className="p-2 align-top">{d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">No drivers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDebug;
