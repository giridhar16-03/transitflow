import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

export function setupTelegramBot(db) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is not set in environment variables. Telegram bot will not be started.");
    return;
  }

  // Initialize the bot (polling mode)
  const bot = new TelegramBot(token, { polling: true });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  let supabase = null;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn("Supabase credentials not found. Bot will not be able to fetch live locations from DB.");
  }

  console.log("Telegram Bot successfully started in polling mode.");

  // Handle /start and /help commands
  bot.onText(/\/(start|help)/, (msg) => {
    const chatId = msg.chat.id;
    const response = `Welcome to TransitFlow Bot! 🚌\n\nTo find a bus, just send me a message like:\n"Where is bus 25P?"\nor simply send the bus code, like "25P" or "ST12".`;
    bot.sendMessage(chatId, response);
  });

  // Handle all other messages
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands like /start
    if (!text || text.startsWith('/')) {
      return;
    }

    // Extract potential bus code. 
    // Examples: "Where is bus 25P?", "25P", "bus ST12"
    const normalizedText = text.trim().toUpperCase();
    
    // Find if any word matches a bus code
    const words = normalizedText.split(/[\s?]+/); // Split by space or question mark
    let targetBusCode = null;
    let targetVehicle = null;

    for (const word of words) {
      const vehicle = db.vehicles.find(v => v.busCode.toUpperCase() === word);
      if (vehicle) {
        targetBusCode = vehicle.busCode;
        targetVehicle = vehicle;
        break;
      }
    }

    if (!targetVehicle) {
      bot.sendMessage(chatId, `Sorry, I couldn't find a bus with that code in our system. Please try a valid bus code (e.g., 25P).`);
      return;
    }

    // Now look for the latest live location of this bus in Supabase
    if (!supabase) {
      bot.sendMessage(chatId, `Live location tracking is currently disabled due to missing configuration.`);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('bus_code', targetBusCode)
        .order('last_seen', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        bot.sendMessage(chatId, `Bus ${targetVehicle.busCode} (${targetVehicle.routeName}) is currently inactive or hasn't reported its location recently.`);
        return;
      }

      const latestLocation = data[0];
      const googleMapsLink = `https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}`;
      
      // Calculate a rough "time ago" string
      const msAgo = Date.now() - new Date(latestLocation.last_seen).getTime();
      const minutesAgo = Math.floor(msAgo / 60000);
      const timeString = minutesAgo <= 1 ? "Just now" : `${minutesAgo} minutes ago`;

      const response = `🚌 *Bus ${targetVehicle.busCode}*\nRoute: ${targetVehicle.routeName}\n\n📍 Last seen: ${timeString}\nSpeed: ${latestLocation.speedKmh || 0} km/h\n\nMap Link: ${googleMapsLink}`;

      bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error("Supabase query error:", error);
      bot.sendMessage(chatId, `Oops! I encountered an error checking the live location. Please try again later.`);
    }
  });

  return bot;
}
