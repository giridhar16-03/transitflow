import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TelegramBotModule = require('node-telegram-bot-api');

console.log('TelegramBotModule type:', typeof TelegramBotModule);
const { Bot } = require('node-telegram-bot-api');
console.log('Bot prototype keys:', Object.getOwnPropertyNames(Bot.prototype));
