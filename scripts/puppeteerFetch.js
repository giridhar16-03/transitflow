import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  console.log("Starting Puppeteer to fetch routes...");

  // Load the VIZAG_ROUTES data directly to get the relation IDs
  // Since we can't easily import from the React app context, we'll just read it or inject it.
  // Actually, we can just navigate to a page that evaluates fetchRouteGeometry!
  // But wait, the app is running on localhost:5173!
  
  await page.goto('http://localhost:5173/prefetch.html');
  
  console.log("Navigated to prefetch.html. Clicking start...");
  await page.click('#startBtn');
  
  console.log("Waiting for fetch to complete... this may take a couple of minutes.");
  
  // Wait until the download button becomes visible (which means it's done)
  await page.waitForSelector('#downloadBtn', { visible: true, timeout: 300000 });
  
  console.log("Fetch complete! Extracting data from page...");
  
  const data = await page.evaluate(() => {
    return window.finalData;
  });
  
  if (data && Object.keys(data).length > 0) {
    const outPath = path.join(__dirname, '../src/data/precomputedRoutes.js');
    fs.writeFileSync(outPath, 'export default ' + JSON.stringify(data, null, 2) + ';');
    console.log("Successfully saved routes to " + outPath);
  } else {
    console.error("Failed to fetch routes. Data was empty.");
  }
  
  await browser.close();
}

main().catch(console.error);
