import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import VIZAG_ROUTES from '../src/data/vizagRoutes.js';

// Build the mock vehicle list exactly like the Express server did
const mockVehicles = [
  { busCode: "25P", routeName: "Central Station → Tech Park" },
  { busCode: "ST12", routeName: "Campus Loop" }
];

VIZAG_ROUTES.forEach(route => {
  mockVehicles.push({
    busCode: route.routeNumber,
    routeName: route.routeName
  });
});

export default async function handler(req, res) {
  try {
    // Only accept POST requests from Telegram
    if (req.method !== 'POST') {
      return res.status(200).send('Telegram Webhook Endpoint is Active');
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("TELEGRAM_BOT_TOKEN missing.");
      return res.status(500).send("Server configuration error: Token missing");
    }

    // Initialize bot with NO polling
    const bot = new TelegramBot(token, { polling: false });

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    let supabase = null;
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    const msg = req.body?.message;
    if (!msg || !msg.text) {
      return res.status(200).send('No text message');
    }

    const chatId = msg.chat.id;
    const text = msg.text;

    // Handle /start and /help
    if (text.match(/\/(start|help)/)) {
      const response = `Welcome to TransitFlow Bot! 🚌\n\nTo find a bus, just send me a message like:\n"Where is bus 25P?"\nor simply send the bus code, like "25P" or "ST12".\n\nYou can also use /routes to see all available routes.`;
      await bot.sendMessage(chatId, response);
      return res.status(200).send('OK');
    }

    // Handle /routes
    if (text.match(/\/routes/)) {
      const uniqueRoutes = [...new Set(mockVehicles.map(v => v.busCode))].sort();
      const routeList = uniqueRoutes.map(code => {
        const vehicle = mockVehicles.find(v => v.busCode === code);
        return `🚌 *${code}* - ${vehicle.routeName}`;
      }).join('\n');
      
      const response = `*Available Bus Routes:*\n\n${routeList}\n\nSend a bus code (e.g. 25P) to find its live location!`;
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
      return res.status(200).send('OK');
    }

    if (text.startsWith('/')) {
      await bot.sendMessage(chatId, `Unknown command. Try /help or /routes.`);
      return res.status(200).send('OK');
    }

    // Extract potential bus code
    const normalizedText = text.trim().toUpperCase();
    const words = normalizedText.split(/[\s?]+/);
    
    let targetBusCode = null;
    let targetVehicle = null;

    for (const word of words) {
      const vehicle = mockVehicles.find(v => v.busCode.toUpperCase() === word);
      if (vehicle) {
        targetBusCode = vehicle.busCode;
        targetVehicle = vehicle;
        break;
      }
    }

    if (!targetVehicle) {
      await bot.sendMessage(chatId, `Sorry, I couldn't find a bus with that code in our system. Please try a valid bus code (e.g., 25P).`);
      return res.status(200).send('OK');
    }

    if (!supabase) {
      await bot.sendMessage(chatId, `Live location tracking is currently disabled due to missing configuration.`);
      return res.status(200).send('OK');
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('bus_code', targetBusCode)
      .order('last_seen', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      await bot.sendMessage(chatId, `Bus ${targetVehicle.busCode} (${targetVehicle.routeName}) is currently inactive or hasn't reported its location recently.`);
      return res.status(200).send('OK');
    }

    const latestLocation = data[0];
    
    // Automatically detect the Vercel domain from the incoming webhook request
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const frontendUrl = process.env.FRONTEND_URL || (host ? `${protocol}://${host}` : 'http://localhost:5173');
    
    const trackingLink = `${frontendUrl}/public?bus=${targetBusCode}`;
    
    const msAgo = Date.now() - new Date(latestLocation.last_seen).getTime();
    const minutesAgo = Math.floor(msAgo / 60000);
    const timeString = minutesAgo <= 1 ? "Just now" : `${minutesAgo} minutes ago`;

    const response = `🚌 *Bus ${targetVehicle.busCode}*\nRoute: ${targetVehicle.routeName}\n\n📍 Last seen: ${timeString}\nSpeed: ${latestLocation.speed_kmh || latestLocation.speedKmh || 0} km/h\n\n🟢 Live Tracking Link:\n${trackingLink}`;

    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    return res.status(200).send('OK');

  } catch (error) {
    console.error("Vercel Webhook Crash:", error);
    // Return the actual error message so we can see it in the ping
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
