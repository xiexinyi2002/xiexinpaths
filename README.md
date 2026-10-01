# XieXinpaths 🐋🌊 — Stories Beneath the Surface

Node.js + Express + SQLite (better-sqlite3). หน้าเว็บ render ฝั่งเซิร์ฟเวอร์ URL สะอาด มี sitemap.xml / robots.txt

## รัน
    npm install
    SESSION_SECRET="สตริงสุ่มยาว ๆ" SITE_URL="https://โดเมนของคุณ" npm start
เปิด http://localhost:3000 → /register (ผู้ใช้คนแรกคือ Owner/Admin แล้วปิดการสมัครอัตโนมัติ) → /login → /admin

## แก้ค่าที่จุดเดียว: `config.js`
ชื่อเว็บ, tagline, ชื่อเจ้าของ, socialLinks (ว่าง = ไม่แสดง), หมวดหมู่ 4 หมวด, My Journey

## ความปลอดภัยที่มี
bcrypt, session cookie httpOnly/sameSite (secure เมื่อ NODE_ENV=production), CSRF token, escape ทุก output (กัน XSS), prepared statements (กัน SQL injection), CSP, rate limit login/comment, honeypot กันสแปม, draft ไม่ public และ noindex

## ยังไม่ได้ทำ (ตั้งใจตัดเพื่อให้รันได้ก่อน)
อัปโหลดรูปปก / Open Graph image, Like/Bookmark/Share, Reset Password ทางอีเมล, จัดการ Category/Tag แบบ CRUD (ตอนนี้หมวดตายตัวใน config.js, tag พิมพ์ในบทความ), Users หลายคน, สัตว์ทะเลอื่นนอกจากวาฬ, Session store ถาวร (ตอนนี้อยู่ใน memory — ล็อกอินหลุดเมื่อรีสตาร์ต)
