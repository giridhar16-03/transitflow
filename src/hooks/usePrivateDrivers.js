import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Returns only drivers whose trip_status is 'active' and belong to the given institutionId.
 * Subscribes to realtime updates on the drivers table so the list stays current.
 */
export function usePrivateDrivers(institutionId) {
  const [drivers, setDrivers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    if (!institutionId) {
      setDrivers([]);
      return;
    }

    const fetchActive = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, display_name, bus_code, bus_number, latitude, longitude, last_seen, trip_status, institution_id')
        .eq('trip_status', 'active')
        .eq('institution_id', institutionId)
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('usePrivateDrivers fetch error:', error);
        return;
      }
      if (mounted) setDrivers(data || []);
    };

    fetchActive();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const chan = supabase.channel(`drivers:private:${institutionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `institution_id=eq.${institutionId}` }, (payload) => {
        const evt = payload.eventType || payload.event;
        const raw = payload.new || payload.record;
        if (!raw) return;

        const record = {
          id: raw.id,
          display_name: raw.display_name,
          bus_code: raw.bus_code,
          bus_number: raw.bus_number,
          latitude: raw.latitude,
          longitude: raw.longitude,
          last_seen: raw.last_seen,
          trip_status: raw.trip_status,
          institution_id: raw.institution_id,
        };

        setDrivers(prev => {
          if (record.institution_id !== institutionId) return prev;

          const isActive = record.trip_status === 'active';
          const exists = prev.some(d => d.id === record.id);

          if (evt === 'DELETE' || !isActive) {
            return prev.filter(d => d.id !== record.id);
          }

          if (exists) {
            return prev.map(d => d.id === record.id ? { ...d, ...record } : d);
          }

          return [...prev, record];
        });
      })
      .subscribe();

    channelRef.current = chan;

    return () => {
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [institutionId]);

  return drivers;
}

export default usePrivateDrivers;
