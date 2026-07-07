import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Returns only drivers whose trip_status is 'active' (i.e. currently running a trip).
 * Subscribes to realtime updates on the drivers table so the list stays current.
 */
export function usePublicDrivers() {
  const [drivers, setDrivers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchActive = async () => {
      // Only fetch drivers that are actively running a trip
      const { data, error } = await supabase
        .from('public_drivers')
        .select('id, display_name, bus_code, bus_number, latitude, longitude, last_seen, trip_status')
        .eq('trip_status', 'active')
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('usePublicDrivers fetch error:', error);
        return;
      }
      if (mounted) setDrivers(data || []);
    };

    fetchActive();

    // Subscribe to realtime changes on the drivers table
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const chan = supabase.channel('drivers:active-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
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
        };

        setDrivers(prev => {
          const isActive = record.trip_status === 'active';
          const exists = prev.some(d => d.id === record.id);

          if (evt === 'DELETE' || !isActive) {
            // Remove from list if deleted or no longer active
            return prev.filter(d => d.id !== record.id);
          }

          if (exists) {
            // Update existing entry
            return prev.map(d => d.id === record.id ? { ...d, ...record } : d);
          }

          // New active driver — add to list
          return [...prev, record];
        });
      })
      .subscribe();

    channelRef.current = chan;

    return () => {
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return drivers;
}

export default usePublicDrivers;