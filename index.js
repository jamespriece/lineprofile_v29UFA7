
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const config = require('./config.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const batchSize = 5;  // ตรวจสอบทีละ 5 บัญชี
const delayBetweenBatches = 500; // ms

app.get('/', (req, res) => {
  res.send('✅ LINE OA Monitor (Notify Every Check) is Running');
});

async function sendTelegram(botToken, chatId, message) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("❌ Error sending Telegram message:", err.response?.data || err.message);
  }
}

async function sendStartNotification() {
  const uniqueChatIds = [...new Set(config.accounts.map(acc => acc.telegramChatId))];
  for (const chatId of uniqueChatIds) {
    const botToken = config.accounts.find(acc => acc.telegramChatId === chatId).telegramBotToken;
    await sendTelegram(botToken, chatId, `🕒 เริ่มการตรวจสอบรอบใหม่ (${config.accounts.length} LINE Bots)`);
  }
}

async function checkAccount(account) {
  let log = [];
  try {
    log.push(`👤 ตรวจสอบบัญชี: ${account.name}`);
    // จำลองผลลัพธ์สุ่ม
    const randomNameChanged = Math.random() < 0.2;
    const randomPictureChanged = Math.random() < 0.2;
    if (randomNameChanged) {
      log.push(`🔴 ชื่อ LINE เปลี่ยน!`);
    } else {
      log.push(`🟢 ชื่อ LINE ถูกต้อง`);
    }
    if (randomPictureChanged) {
      log.push(`🔴 รูปโปรไฟล์เปลี่ยน!`);
    } else {
      log.push(`🟢 รูปโปรไฟล์ถูกต้อง`);
    }
  } catch (err) {
    log.push(`❌ Error: ${err.message}`);
  } finally {
    const combinedMessage = log.join("\n");
    await sendTelegram(account.telegramBotToken, account.telegramChatId, combinedMessage);
  }
}

async function checkAllAccounts() {
  console.log(`🕒 แจ้งเตือนเริ่มตรวจสอบรอบใหม่...`);
  await sendStartNotification();
  console.log(`🚀 เริ่มตรวจสอบ LINE Bots (${config.accounts.length} บัญชี)`);
  for (let i = 0; i < config.accounts.length; i += batchSize) {
    const batch = config.accounts.slice(i, i + batchSize);
    await Promise.all(batch.map(checkAccount));
    console.log(`⏳ รอ ${delayBetweenBatches}ms ก่อนตรวจสอบ batch ถัดไป...`);
    await delay(delayBetweenBatches);
  }
  console.log(`✅ ตรวจสอบครบทั้งหมดแล้ว\n`);
}

const intervalMs = config.checkIntervalMinutes * 60 * 1000;
console.log(`⏱️ ระบบจะตรวจสอบทุก ${config.checkIntervalMinutes} นาที (พร้อมแจ้งเตือน)`);
setInterval(() => {
  console.log(`
⏳ เริ่มการตรวจสอบรอบใหม่ (Rate Limited)`);
  checkAllAccounts();
}, intervalMs);

// เริ่มการตรวจสอบรอบแรกทันที
checkAllAccounts();

app.listen(port, () => {
  console.log(`🌐 Web server started on port ${port}`);
});
