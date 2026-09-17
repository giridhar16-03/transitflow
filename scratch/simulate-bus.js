import http from 'http';

// Coordinates roughly starting near RK Beach and moving towards VUDA Park
const START_LAT = 17.7145;
const START_LNG = 83.3236;
const BUS_CODE = '10K'; // Change this to test other buses

let currentLat = START_LAT;
let currentLng = START_LNG;
let step = 0;

console.log(`Starting location simulation for Bus ${BUS_CODE}...`);
console.log('Press Ctrl+C to stop.');

function sendLocationUpdate() {
  // Move the bus slightly north-east
  currentLat += 0.0005;
  currentLng += 0.0002;
  step++;

  const payload = JSON.stringify({
    driverKeyId: 'DRV-SIMULATED',
    tripId: 'TRIP-SIM',
    busCode: BUS_CODE,
    latitude: currentLat,
    longitude: currentLng,
    speedKmh: 40 + Math.floor(Math.random() * 10), // Random speed between 40-50
    heading: 45 // North-East
  });

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/driver/location',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 201) {
        console.log(`[Step ${step}] Pushed location for ${BUS_CODE}: Lat ${currentLat.toFixed(5)}, Lng ${currentLng.toFixed(5)}`);
      } else {
        console.error(`Failed to push location. Status: ${res.statusCode}, Body: ${data}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}. Is the server running?`);
  });

  req.write(payload);
  req.end();
}

// Send an update immediately, then every 10 seconds
sendLocationUpdate();
setInterval(sendLocationUpdate, 10000);
