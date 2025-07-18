
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const sharp = require('sharp');
const blockhash = require('./blockhash-core');
const app = express();
const port = process.env.PORT || 3000;
const config = require('./config.json');

app.get('/', (req, res) => {
  res.send('✅ LINE OA Monitor with Docker is Running');
});

app.get('/check', async (req, res) => {
  console.log(`[HTTP] เรียกตรวจสอบจาก /check`);
  await checkAllAccounts();
  res.send('✅ ตรวจสอบแล้ว (ทุกบัญชี)');
});

app.listen(port, () => {
  console.log(`✅ Web server started on port ${port}`);
});

async function getLineBotInfo(channelAccessToken) {
  const res = await axios.get('https://api.line.me/v2/bot/info', {
    headers: {
      Authorization: `Bearer ${channelAccessToken}`
    }
  });
  return {
    displayName: res.data.displayName,
    pictureUrl: res.data.pictureUrl || null
  };
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
  console.log(`💾 เซฟ expected data สำหรับ ${accountName} แล้ว`);
}

async function sendTelegram(botToken, chatId, message) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message
    });
  } catch (err) {
    console.error("❌ Error sending Telegram message:", err.response?.data || err.message);
  }
}

async function checkAccount(account) {
  let alertMessages = [];
  try {
    console.log(`
🔄 ตรวจสอบบัญชี: ${account.name}`);
    const current = await getLineBotInfo(account.channelAccessToken);
    console.log(`📛 ชื่อ LINE ปัจจุบัน: ${current.displayName}`);

    let expectedDisplayName = account.expectedDisplayName;
    let expectedPictureUrl;
    const expectedFile = `expectedData_${account.name}.json`;

    if (fs.existsSync(expectedFile)) {
      const expectedData = JSON.parse(fs.readFileSync(expectedFile));
      expectedPictureUrl = expectedData.pictureUrl;
    } else {
      saveExpectedData(account.name, current.displayName, current.pictureUrl);
      expectedPictureUrl = current.pictureUrl;
      alertMessages.push(`📸 เซฟ expected ชื่อและรูปอัตโนมัติ`);
    }

    // ตรวจสอบชื่อ LINE
    if (expectedDisplayName) {
      if (current.displayName !== expectedDisplayName) {
        alertMessages.push(`❌ ชื่อ LINE เปลี่ยนจาก "${expectedDisplayName}" → "${current.displayName}"❌❌❌❌❌❌`);
      } else {
        alertMessages.push(`✅ ชื่อ LINE ถูกต้อง: ${current.displayName}`);
      }
    } else {
      if (current.displayName !== expectedData.displayName) {
        alertMessages.push(`❌ ชื่อ LINE เปลี่ยนจาก "${expectedData.displayName}" → "${current.displayName}"`);
        saveExpectedData(account.name, current.displayName, current.pictureUrl);
      } else {
        alertMessages.push(`✅ ชื่อ LINE: ${current.displayName}`);
      }
    }

    // ตรวจสอบรูป LINE
    if (!current.pictureUrl) {
      alertMessages.push(`⚠️ ไม่มีรูปโปรไฟล์ (pictureUrl = null)⚠️⚠️⚠️⚠️⚠️`);
    } else {
      try {
        const expectedHash = await hashImageFromUrl(expectedPictureUrl);
        const currentHash = await hashImageFromUrl(current.pictureUrl);
        const distance = hammingDistance(expectedHash, currentHash);
        const similarity = ((1 - distance / (expectedHash.length * 4)) * 100).toFixed(2);

        if (similarity < 95) {
          alertMessages.push(`❌ รูปเปลี่ยน (ความเหมือน ${similarity}%)❌❌❌❌❌❌`);
          saveExpectedData(account.name, current.displayName, current.pictureUrl);
        } else {
          alertMessages.push(`✅ รูปถูกต้อง (${similarity}%)`);
        }
      } catch (hashErr) {
        alertMessages.push(`⚠️ ตรวจสอบรูปไม่ได้: ${hashErr.message}`);
      }
    }
  } catch (err) {
    alertMessages.push(`❌ เกิดข้อผิดพลาด: ${err.response?.data || err.message}`);
  } finally {
    const msg = `📢 [${account.name}]
` + alertMessages.join("\n");
    await sendTelegram(account.telegramBotToken, account.telegramChatId, msg);
    console.log(`✅ ตรวจสอบแล้ว: ${account.name}`);
  }
}

async function checkAllAccounts() {
  console.log("🔄 กำลังตรวจสอบทุกบัญชี (parallel)...");
  await Promise.all(config.accounts.map(checkAccount));
}

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

const intervalMs = config.checkIntervalMinutes * 60 * 1000;
console.log(`⏱️ ระบบจะตรวจสอบทุก ${config.checkIntervalMinutes} นาที (parallel)`);
setInterval(() => {
  console.log(`
⏳ เริ่มการตรวจสอบอัตโนมัติ (parallel)`);
  checkAllAccounts();
}, intervalMs);

checkAllAccounts();
