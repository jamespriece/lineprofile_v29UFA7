
# 📦 LINE OA Monitor (Custom Display Name + Compact Alert + Parallel + Multi Accounts)

✅ ตรวจสอบชื่อ LINE ตาม expectedDisplayName ใน config  
✅ ตรวจสอบหลายบัญชีพร้อมกัน (parallel) → เร็วขึ้นมาก  
✅ ตัวอย่าง `config.json` รองรับหลาย LINE Bot แล้ว  
✅ ถ้าชื่อหรือรูปเปลี่ยน → แจ้ง Telegram แบบกระชับทันที  
✅ รองรับ Docker Desktop (Local) และ Render Deploy

---

## 🚀 วิธีใช้งานบน Local (Docker Compose)
1. ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. แตกไฟล์ ZIP นี้
3. แก้ไข `config.json`:
   - เพิ่มบัญชี LINE Bot ตามตัวอย่าง
   - ใส่ `channelAccessToken`, `telegramBotToken`, `telegramChatId`, และ `expectedDisplayName` สำหรับแต่ละบัญชี
4. เปิด Terminal แล้วรัน:
   ```bash
   docker-compose up --build
   ```

---

## ☁️ วิธี Deploy บน Render (Docker)
1. เข้า [Render Dashboard](https://dashboard.render.com)
2. คลิก **New Web Service** → เลือก **Deploy an existing Dockerfile**
3. อัปโหลดไฟล์ ZIP นี้ หรือเชื่อม GitHub Repository
4. ตั้งค่า:
   - **Environment**: Docker
   - **Port**: 3000
5. คลิก **Create Web Service** และรอ Render Build
