import fetch from 'node-fetch';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables if run locally
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ Error: TELEGRAM_BOT_TOKEN is not set in your .env file.");
  process.exit(1);
}

console.log("TransitFlow Telegram Webhook Setup\n");
console.log("Your Vercel deployment URL should look like: https://transitflow.vercel.app");

rl.question('Please enter your live Vercel URL: ', async (url) => {
  const cleanUrl = url.trim().replace(/\/$/, ""); // Remove trailing slash if present
  const webhookUrl = `${cleanUrl}/api/telegram`;
  
  console.log(`\nSetting Webhook to: ${webhookUrl}...`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
    const data = await response.json();
    
    if (data.ok) {
      console.log("✅ Success! Telegram has been linked to your Vercel deployment.");
      console.log("Your bot will now automatically respond to messages on Vercel.");
    } else {
      console.error("❌ Failed to set webhook:", data.description);
    }
  } catch (error) {
    console.error("❌ Network error:", error.message);
  }
  
  rl.close();
});
