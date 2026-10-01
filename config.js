// แก้ค่าที่จุดเดียว — ลิงก์ที่ว่างจะไม่แสดง
module.exports = {
  siteName: 'XieXinpaths',
  title: 'XieXinpaths — Stories Beneath the Surface',
  tagline: 'Welcome to my little ocean.',
  description: 'พื้นที่เล็ก ๆ ใต้มหาสมุทร สำหรับเก็บเรื่องราว ความคิด ความทรงจำ และการเดินทางของฉัน',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  ownerName: 'ชื่อเจ้าของบล็อก (แก้ใน config.js)',
  socialLinks: { instagram: '', tiktok: '', facebook: '', youtube: '' },
  categories: [['love','ความรัก'],['goals','เป้าหมาย'],['travel','การเดินทาง'],['society','สังคม']],
  journey: [] // เช่น { year:'2026', text:'เริ่มเขียนบล็อก' }
};
