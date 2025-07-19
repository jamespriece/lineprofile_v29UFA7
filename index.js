
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const sharp = require('sharp');
const blockhash = require('./blockhash-core');
const app = express();
const port = process.env.PORT || 3000;

const config = require('./config.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const batchSize = 5;  // ตรวจสอบทีละ 5 บัญชี
const delayBetweenBatches = 500; // ms

app.get('/', (req, res) => {
  res.send('✅ LINE OA Monitor (Emoji Alerts) is Running');
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

async function hashImageFromUrl(url) {
  if (!url) throw new Error('Invalid URL');
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const imgBuffer = Buffer.from(response.data);
  const hash = await blockhash.bmvbhash(imgBuffer, 16);
  return hash;
}

function saveExpectedData(accountName, displayName, pictureUrl) {
  const filename = `expectedData_${accountName}.json`;
  const data = {
    displayName: displayName,
    pictureUrl: pictureUrl,
    savedAt: new Date().toISOString()
  };
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`💾 เซฟ expected สำหรับ ${accountName} แล้ว`);
}

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

async function checkAccount(account) {
  let log = [];
  try {
    log.push(`📢 [${account.name}]`);
    const response = await axios.get('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${account.channelAccessToken}` }
    });
    const currentDisplayName = response.data.displayName;
    const currentPictureUrl = response.data.pictureUrl || null;

    let expectedDisplayName = account.expectedDisplayName;
    let expectedPictureUrl;
    const expectedFile = `expectedData_${account.name}.json`;

    if (fs.existsSync(expectedFile)) {
      const expectedData = JSON.parse(fs.readFileSync(expectedFile));
      expectedDisplayName = expectedData.displayName;
      expectedPictureUrl = expectedData.pictureUrl;
    } else {
      if (!currentDisplayName || currentDisplayName === "NONAME") {
        log.push(`⚠️ ไม่สามารถบันทึก expected name ได้ (ชื่อปัจจุบันเป็น "${currentDisplayName}")`);
      } else {
        saveExpectedData(account.name, currentDisplayName, currentPictureUrl);
        log.push(`📸 เซฟ expected ชื่อและรูปอัตโนมัติ`);
      }
      expectedPictureUrl = currentPictureUrl;
    }

    if (expectedDisplayName && currentDisplayName !== expectedDisplayName) {
      log.push(`❌❌❌❌❌ ชื่อ LINE เปลี่ยนจาก "${expectedDisplayName}" → "${currentDisplayName}"`);
    } else {
      log.push(`✅ ชื่อ LINE ถูกต้อง: ${currentDisplayName}`);
    }

    if (!currentPictureUrl) {
      log.push(`⚠️⚠️⚠️⚠️⚠ ไม่มีรูปโปรไฟล์ (pictureUrl = null)⚠️⚠️⚠️⚠️`);
    } else {
      try {
        const expectedHash = await hashImageFromUrl(expectedPictureUrl);
        const currentHash = await hashImageFromUrl(currentPictureUrl);
        const distance = hammingDistance(expectedHash, currentHash);
        const similarity = ((1 - distance / (expectedHash.length * 4)) * 100).toFixed(2);

        if (similarity < 95) {
          log.push(`❌ รูปโปรไฟล์เปลี่ยน!`);
          saveExpectedData(account.name, currentDisplayName, currentPictureUrl);
        } else {
          log.push(`✅ รูปถูกต้อง (${similarity}%)`);
        }
      } catch (imgErr) {
        log.push(`⚠️ ตรวจสอบรูปไม่ได้: ${imgErr.message}`);
      }
    }
  } catch (err) {
    log.push(`❌ เกิดข้อผิดพลาด: ${err.response?.data || err.message}`);
  } finally {
    const combinedMessage = log.join("\n");
    await sendTelegram(account.telegramBotToken, account.telegramChatId, combinedMessage);
    console.log(`✅ ตรวจสอบแล้ว: ${account.name}`);
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
console.log(`⏱️ ระบบจะตรวจสอบทุก ${config.checkIntervalMinutes} นาที (พร้อมอีโมจิแจ้งเตือน)`);
setInterval(() => {
  console.log(`
⏳ เริ่มการตรวจสอบรอบใหม่ (Rate Limited)`);
  checkAllAccounts();
}, intervalMs);

checkAllAccounts();

app.listen(port, () => {
  console.log(`🌐 Web server started on port ${port}`);
});
