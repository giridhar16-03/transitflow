const fs = require('fs');
const path = require('path');

const rawText = fs.readFileSync(path.join(__dirname, 'raw_routes.txt'), 'utf8');
const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '' && l !== 'BUS ROUTES for the Academic year 2023-24');

const routes = [];
let currentRoutes = []; // [ { name, startTime, stops: [] }, ... ]

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if it's a route header
  // Example: A (KURMANNAPALEM) Starts at 6:45am
  // or: M(PENDURTHY Starts at 7:00am)
  const headerMatch = line.match(/^([A-X])\s*\((.*?)\)?\s*(?:Starts at\s*(.*))?$/i) || line.match(/^([A-X])\s*\((.*?)\s*Starts at\s*(.*?)\)$/i);
  
  if (headerMatch && !line.match(/^\d+\./)) {
     // If we find a new header, but we already have some in progress and they have stops, 
     // it means we are starting a new block of routes.
     if (currentRoutes.length > 0 && currentRoutes[0].stops.length > 0) {
        routes.push(...currentRoutes);
        currentRoutes = [];
     }
     
     let letter, name, time;
     if (line.includes('PENDURTHY Starts')) {
         const m = line.match(/^([A-Z])\((.*?)\s+Starts at\s+(.*?)\)$/i);
         letter = m[1];
         name = m[2];
         time = m[3];
     } else {
         const m = line.match(/^([A-Z])\s*\((.*?)\)\s*Starts at\s*(.*)$/i);
         if (m) {
             letter = m[1];
             name = m[2];
             time = m[3];
         } else {
             // Fallback
             letter = line.charAt(0);
             name = line;
             time = "Unknown";
         }
     }
     
     currentRoutes.push({
         route_name: `${letter} (${name})`,
         start_time: time,
         stops: []
     });
  } else if (line.match(/^\d+\./)) {
     // It's a stop
     const stopName = line.replace(/^\d+\./, '').trim();
     
     // Which route does this belong to?
     // Since they are interleaved, the stop number tells us.
     const stopNumStr = line.match(/^(\d+)\./)[1];
     const stopNum = parseInt(stopNumStr, 10);
     
     // We assign it to the route that currently has (stopNum - 1) stops
     // or just round-robin based on who is missing this stop number.
     let assigned = false;
     for (let r of currentRoutes) {
         if (r.stops.length === stopNum - 1) {
             r.stops.push(stopName);
             assigned = true;
             break;
         }
     }
     if (!assigned) {
         // fallback, just add to the last one
         currentRoutes[currentRoutes.length - 1].stops.push(stopName);
     }
  }
}

if (currentRoutes.length > 0) {
    routes.push(...currentRoutes);
}

fs.writeFileSync(path.join(__dirname, 'routes_parsed.json'), JSON.stringify(routes, null, 2));
console.log('Parsed', routes.length, 'routes.');
