import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPreferredDisplayName } from '../lib/authAccess';

// lightweight haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function useDriverLocation({ enabled = true, busCode, busNumber, driverKeyId, onError } = {}) {
  const watchIdRef = useRef(null);
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // not signed in
        return;
      }

      const upsertDriver = async (lat, lng) => {
        try {
          const payload = {
            user_id: user.id,
            display_name: getPreferredDisplayName(user),
            email: user.email,
            bus_code: busCode,
            bus_number: busNumber || busCode || '',
            latitude: lat,
            longitude: lng,
            last_seen: new Date().toISOString()
          };
          // Only include driver_key_id if provided (existing drivers already have one in the DB)
          if (driverKeyId) {
            payload.driver_key_id = driverKeyId;
          }
          await supabase.from('drivers').upsert(payload, { onConflict: 'user_id' });
        } catch (e) {
          onError?.(e);
        }
      };

      const success = (pos) => {
        if (!mounted) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();
        const last = lastPosRef.current;
        if (last) {
          const movedKm = haversineKm(last.lat, last.lng, lat, lng);
          if (movedKm < 0.01 && now - last.t < 5000) return; // skip small moves
        }
        lastPosRef.current = { lat, lng, t: now };
        upsertDriver(lat, lng);
      };

      const fail = (err) => onError?.(err);

      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(success, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
      } else {
        onError?.(new Error('Geolocation not supported'));
      }
    };

    start();

    return () => {
      mounted = false;
      if (watchIdRef.current != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, busCode, busNumber, driverKeyId, onError]);
}

export default useDriverLocation;