import { useEffect, useState } from "react";

function jitter(value, spread) {
  return value + (Math.random() - 0.5) * spread;
}

function refreshVehicle(vehicle) {
  return {
    ...vehicle,
    latitude: Number(jitter(vehicle.latitude, 0.002).toFixed(6)),
    longitude: Number(jitter(vehicle.longitude, 0.002).toFixed(6)),
    speed: Math.max(8, Math.round(jitter(vehicle.speed, 7))),
    etaMinutes: Math.max(1, Math.round(jitter(vehicle.etaMinutes, 2))),
    updatedAt: new Date(),
  };
}

export function useLiveFleet(initialVehicles) {
  const [vehicles, setVehicles] = useState(() =>
    initialVehicles.map((vehicle) => ({
      ...vehicle,
      updatedAt: new Date(),
    })),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setVehicles((current) => current.map(refreshVehicle));
    }, 5000);

    return () => window.clearInterval(id);
  }, []);

  return vehicles;
}
