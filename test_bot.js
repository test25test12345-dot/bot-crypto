const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Prova con ALERTS_BOT_TOKEN visto che è quello che invia
const bot = new TelegramBot(process.env.ALERTS_BOT_TOKEN, {polling: false});

async function test() {
  const chatId = '-1002359004329'; // Metti l'ID ESATTO del primo gruppo
  
  try {
    const chat = await bot.getChat(chatId);
    console.log('Chat trovata:', chat.title);
    
    await bot.sendMessage(chatId, 'Test message');
    console.log('Messaggio inviato!');
  } catch(err) {
    console.log('Errore:', err.response?.body || err.message);
  }
}

test();
