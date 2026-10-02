const express = require('express'), session = require('express-session'), bcrypt = require('bcryptjs');
const crypto = require('crypto'), Database = require('better-sqlite3'), cfg = require('./config');
const db = new Database(process.env.DB_PATH || 'blog.db'); db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,name TEXT,hash TEXT,role TEXT DEFAULT 'admin');
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,slug TEXT UNIQUE,title TEXT,excerpt TEXT,body TEXT,cat TEXT,tags TEXT DEFAULT '',status TEXT DEFAULT 'draft',publish_at TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,name TEXT,body TEXT,hidden INTEGER DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,name TEXT,email TEXT,subject TEXT,body TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_c ON comments(post_id);`);

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const name = process.env.ADMIN_NAME || 'ซินอี๋';
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);

  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);

  if (exists) {
    db.prepare('UPDATE users SET name=?, hash=?, role=? WHERE email=?')
      .run(name, hash, 'admin', email);
  } else {
    db.prepare("INSERT INTO users(email,name,hash,role) VALUES(?,?,?,'admin')")
      .run(email, name, hash);
  }
}

const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static('public', { maxAge: '7d' }));
app.use(session({ secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 6048e5 } }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; form-action 'self'" });
  req.session.csrf ||= crypto.randomBytes(16).toString('hex');
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) return res.status(403).send(page(req, 'ไม่อนุญาต', '<p>Invalid token. กรุณากลับไปโหลดหน้าใหม่</p>'));
  next();
});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats = Object.fromEntries(cfg.categories), fmt = d => new Date(d.replace(' ','T')+(d.includes('Z')?'':'Z')).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
const readMin = t => Math.max(1, Math.round(t.length / 900));
const body = t => esc(t).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
const slugify = s => (s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'') || 'post') ;
const live = "status='published' AND (publish_at IS NULL OR publish_at<=datetime('now'))";
const csrf = r => `<input type="hidden" name="_csrf" value="${r.session.csrf}">`;
const whale = (w=120) => `<svg class="whale" width="${w}" viewBox="0 0 120 80" role="img" aria-label="ปลาวาฬ"><path d="M8 40c0-20 22-32 48-32 26 0 44 14 50 34 4-6 10-8 12-6-2 12-8 18-14 20-8 14-26 22-46 22C30 78 8 62 8 40z" fill="#7fb3ff"/><path d="M20 52c20 14 60 14 82-6-4 18-24 28-46 28-18 0-32-8-36-22z" fill="#c9dcff"/><circle cx="38" cy="36" r="4" fill="#0b1236"/><path d="M52 6c-2-6 4-8 6-4 2-4 8-2 6 4" fill="none" stroke="#a8d4ff" stroke-width="3" stroke-linecap="round"/></svg>`;
const social = () => Object.entries(cfg.socialLinks).filter(([,u]) => u).map(([k,u]) => `<a class="soc" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${k}">${k}</a>`).join('') || '<span class="muted">ยังไม่ได้ตั้งค่าช่องทางโซเชียล (config.js)</span>';
function page(req, title, main, o = {}) {
  const u = req.session.user, t = o.raw ? title : `${esc(title)} · ${cfg.siteName}`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${o.home ? esc(cfg.title) : t}</title>
<meta name="description" content="${esc(o.desc || cfg.description)}"><meta property="og:title" content="${esc(o.home ? cfg.title : title)}"><meta property="og:description" content="${esc(o.desc || cfg.description)}"><meta property="og:type" content="${o.article ? 'article' : 'website'}">
${o.canon ? `<link rel="canonical" href="${cfg.siteUrl}${o.canon}">` : ''}${o.noindex ? '<meta name="robots" content="noindex">' : ''}<link rel="stylesheet" href="/style.css"></head><body>
<header class="nav"><a class="logo" href="/">${whale(44)}<span>${cfg.siteName}</span></a><input type="checkbox" id="mt" hidden><label for="mt" class="burger" aria-label="เมนู">☰</label>
<nav><a href="/">Home</a><a href="/blog">Blog</a><a href="/about">About Me</a><a href="/contact">Contact</a>${u ? '<a href="/admin">Dashboard</a><a href="/admin/new">Write</a><form method="post" action="/logout">'+csrf(req)+'<button class="lnk">Logout</button></form>' : '<a href="/login">Login</a>'}
<form action="/search" class="sf"><input name="q" placeholder="ค้นหา…" aria-label="ค้นหา"></form></nav></header>
<main class="wrap">${main}</main><footer class="foot"><div class="wrap fgrid"><div>${whale(70)}<h3>${cfg.siteName}</h3><p class="muted">${esc(cfg.description)}</p></div><div><h4>Explore</h4><a href="/blog">Blog</a><a href="/about">About Me</a><a href="/contact">Contact</a></div><div><h4>Find me around the ocean</h4><div class="socs">${social()}</div></div></div><p class="muted center">© ${new Date().getFullYear()} ${cfg.siteName} 🐋</p></footer></body></html>`;
}
const card = p => `<article class="card"><span class="chip">${esc(cats[p.cat] || p.cat)}</span><h3><a href="/post/${encodeURI(p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p><div class="meta">${fmt(p.publish_at || p.created)} · ${readMin(p.body)} นาที · ${esc(cfg.ownerName)} · 💬 ${p.cc ?? 0}</div><a class="btn sm" href="/post/${encodeURI(p.slug)}">Read More</a></article>`;
const list = (where, args = []) => db.prepare(`SELECT p.*,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND hidden=0) cc FROM posts p WHERE ${live} ${where} ORDER BY COALESCE(publish_at,created) DESC`).all(...args);
const grid = ps => ps.length ? `<div class="grid">${ps.map(card).join('')}</div>` : `<div class="empty">${whale(90)}<p>ยังไม่มีบทความ — มหาสมุทรยังเงียบอยู่</p></div>`;
const catNav = () => `<p class="cats">${cfg.categories.map(([k,v]) => `<a class="chip" href="/category/${k}">${v}</a>`).join('')}</p>`;
const need = (req, res, next) => req.session.user ? next() : res.redirect('/login');

app.get('/', (req, res) => res.send(page(req, '', `<section class="hero">${whale(220)}<h1>${esc(cfg.tagline)}</h1><p>Dive into my thoughts.</p><a class="btn" href="/blog">ดำดิ่งสู่บทความ</a><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i></section><h2>บทความล่าสุด</h2>${catNav()}${grid(list('').slice(0, 6))}`, { home: true, canon: '/' })));
app.get('/blog', (req, res) => res.send(page(req, 'Blog', `<h1>Blog</h1>${catNav()}${grid(list(''))}`, { canon: '/blog' })));
app.get('/category/:c', (req, res) => cats[req.params.c] ? res.send(page(req, cats[req.params.c], `<h1>${esc(cats[req.params.c])}</h1>${catNav()}${grid(list('AND cat=?', [req.params.c]))}`, { canon: '/category/' + req.params.c })) : res.status(404).send(nf(req)));
app.get('/tag/:t', (req, res) => res.send(page(req, '#' + req.params.t, `<h1>#${esc(req.params.t)}</h1>${grid(list("AND (','||REPLACE(tags,' ','')||',') LIKE ?", ['%,' + req.params.t + ',%']))}`)));
app.get('/search', (req, res) => { const q = String(req.query.q || '').slice(0, 80), l = '%' + q.replace(/[%_]/g, '') + '%';
  res.send(page(req, 'ค้นหา', `<h1>ค้นหา: ${esc(q)}</h1>${q ? grid(list('AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)', [l, l, l])) : ''}`, { noindex: true })); });
const nf = req => page(req, '404', `<div class="empty">${whale(140)}<h1>404</h1><p>หลงทางใต้ทะเลเสียแล้ว</p><a class="btn" href="/">กลับหน้าแรก</a></div>`, { noindex: true });
app.get('/post/:slug', (req, res) => {
  const p = db.prepare(`SELECT * FROM posts WHERE slug=? AND ${live}`).get(req.params.slug) || (req.session.user && db.prepare('SELECT * FROM posts WHERE slug=?').get(req.params.slug));
  if (!p) return res.status(404).send(nf(req));
  const cm = db.prepare('SELECT * FROM comments WHERE post_id=? AND hidden=0 ORDER BY id').all(p.id);
  const tags = p.tags.split(',').map(t => t.trim()).filter(Boolean);
  res.send(page(req, p.title, `<article class="post">${p.status !== 'published' ? '<p class="chip">ฉบับร่าง (เห็นเฉพาะเจ้าของ)</p>' : ''}<span class="chip">${esc(cats[p.cat])}</span><h1>${esc(p.title)}</h1><div class="meta">${fmt(p.publish_at || p.created)} · ${readMin(p.body)} นาที · ${esc(cfg.ownerName)}</div><div class="prose">${body(p.body)}</div><p>${tags.map(t => `<a class="chip" href="/tag/${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</p></article>
<section><h2>ความคิดเห็น (${cm.length})</h2>${cm.map(c => `<div class="cm"><b>${esc(c.name)}</b> <span class="muted">${fmt(c.created)}</span><p>${esc(c.body)}</p></div>`).join('')}
<form method="post" action="/post/${p.id}/comment" class="form">${csrf(req)}<input name="name" placeholder="ชื่อ" required maxlength="60"><textarea name="body" placeholder="เขียนความคิดเห็น…" required maxlength="2000"></textarea><input name="website" class="hp" tabindex="-1" autocomplete="off"><button class="btn">ส่งความคิดเห็น</button></form></section>`,
    { desc: p.excerpt, article: true, canon: '/post/' + encodeURI(p.slug), noindex: p.status !== 'published' }));
});
const last = new Map();
app.post('/post/:id/comment', (req, res) => {
  const p = db.prepare(`SELECT slug FROM posts WHERE id=? AND ${live}`).get(req.params.id); if (!p) return res.sendStatus(404);
  const n = String(req.body.name || '').trim().slice(0, 60), b = String(req.body.body || '').trim().slice(0, 2000), ip = req.ip;
  if (!req.body.website && n && b && Date.now() - (last.get(ip) || 0) > 15000) { last.set(ip, Date.now()); db.prepare('INSERT INTO comments(post_id,name,body) VALUES(?,?,?)').run(req.params.id, n, b); }
  res.redirect('/post/' + encodeURI(p.slug) + '#comments');
});
app.get('/about', (req, res) => res.send(page(req, 'About Me', `<div class="about">${whale(200)}<div><h1>สวัสดี เราชื่อแบม 👋.</h1><p class="muted">ยินดีต้อนรับเข้าสู่พื้นที่เล็ก ๆ ของเรา ที่นี่คือที่ที่เราอยากแบ่งปันเรื่องราว ความคิด และมุมมองที่มีต่อโลกใบนี้</p></div></div><h2>My Journey</h2>${cfg.journey.length ? `<ul class="tl">${cfg.journey.map(j => `<li><b>${esc(j.year)}</b> ${esc(j.text)}</li>`).join('')}</ul>` : '<p class="muted">เพิ่มเหตุการณ์ใน config.js → journey</p>'}`, { canon: '/about' })));
app.get('/contact', (req, res) => res.send(page(req, 'Contact', `<h1>Let's Talk 💙</h1><p>Have a story to share, a question to ask, or simply want to say hello?</p>${req.query.ok ? '<p class="chip">ส่งข้อความแล้ว ขอบคุณค่ะ/ครับ</p>' : ''}<form method="post" action="/contact" class="form">${csrf(req)}<input name="name" placeholder="Name" required maxlength="80"><input name="email" type="email" placeholder="Email" required maxlength="120"><input name="subject" placeholder="Subject" maxlength="120"><textarea name="body" placeholder="Message" required maxlength="4000"></textarea><input name="website" class="hp" tabindex="-1" autocomplete="off"><button class="btn">Send Message</button></form><div class="socs">${social()}</div>`, { canon: '/contact' })));
app.post('/contact', (req, res) => { const b = req.body; if (!b.website && b.name && b.email && b.body) db.prepare('INSERT INTO messages(name,email,subject,body) VALUES(?,?,?,?)').run(...['name','email','subject','body'].map(k => String(b[k] || '').slice(0, 4000))); res.redirect('/contact?ok=1'); });
// ---- Auth: ผู้ใช้คนแรกที่สมัครคือ Owner/Admin แล้วปิดการสมัคร ----
const tries = new Map();
const authForm = (req, t, act, extra = '', err = '') => page(req, t, `<div class="auth">${whale(100)}<h1>${t}</h1>${err ? `<p class="err">${err}</p>` : ''}<form method="post" action="${act}" class="form">${csrf(req)}${extra}<button class="btn">${t}</button></form></div>`, { noindex: true });
app.get('/login', (req, res) => res.send(authForm(req, 'Login', '/login', '<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>') + (db.prepare('SELECT COUNT(*) c FROM users').get().c ? '' : '<p class="center"><a href="/register">สร้างบัญชีเจ้าของบล็อก</a></p>')));
app.post('/login', (req, res) => {
  const k = req.ip, t = tries.get(k) || { n: 0, at: Date.now() }; if (Date.now() - t.at > 9e5) { t.n = 0; t.at = Date.now(); }
  if (t.n >= 8) return res.status(429).send('ลองใหม่ภายหลัง');
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if (u && bcrypt.compareSync(String(req.body.password || ''), u.hash)) { tries.delete(k); return req.session.regenerate(() => { req.session.user = { id: u.id, name: u.name, role: u.role }; req.session.csrf = crypto.randomBytes(16).toString('hex'); res.redirect('/admin'); }); }
  t.n++; tries.set(k, t); res.status(401).send(authForm(req, 'Login', '/login', '<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
});
const regForm = (req, err) => authForm(req, 'Register', '/register', '<input name="name" placeholder="ชื่อ" required maxlength="60"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password (อย่างน้อย 10 ตัวอักษร)" minlength="10" required>', err);
app.get('/register', (req, res) => db.prepare('SELECT COUNT(*) c FROM users').get().c ? res.redirect('/login') : res.send(regForm(req)));
app.post('/register', (req, res) => {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c) return res.redirect('/login');
  const { name, email, password } = req.body; if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || String(password || '').length < 10) return res.status(400).send(regForm(req, 'ข้อมูลไม่ถูกต้อง (รหัสผ่านอย่างน้อย 10 ตัว)'));
  db.prepare("INSERT INTO users(email,name,hash,role) VALUES(?,?,?,'admin')").run(email.toLowerCase(), name.slice(0, 60), bcrypt.hashSync(password, 12)); res.redirect('/login');
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));
// ---- Admin ----
const admin = [need, (req, res, next) => req.session.user.role === 'admin' ? next() : res.sendStatus(403)];
const shell = (req, t, m) => page(req, t, `<h1>${t}</h1><p class="tabs"><a href="/admin">Posts</a><a href="/admin/comments">Comments</a><a href="/admin/messages">Messages</a><a href="/admin/profile">Profile</a></p>${m}`, { noindex: true });
const act = (req, url, label, cls = '') => `<form method="post" action="${url}" class="inl">${csrf(req)}<button class="btn sm ${cls}">${label}</button></form>`;
app.get('/admin', admin, (req, res) => { const ps = db.prepare('SELECT * FROM posts ORDER BY id DESC').all();
  res.send(shell(req, 'Dashboard', `<a class="btn" href="/admin/new">+ เขียนบทความ</a><table>${ps.map(p => `<tr><td><a href="/post/${encodeURI(p.slug)}">${esc(p.title)}</a></td><td>${esc(cats[p.cat])}</td><td>${p.status}${p.publish_at ? ' ⏰ ' + esc(p.publish_at) : ''}</td><td><a href="/admin/edit/${p.id}">แก้ไข</a> ${act(req, `/admin/toggle/${p.id}`, p.status === 'published' ? 'Unpublish' : 'Publish')} ${act(req, `/admin/delete/${p.id}`, 'ลบ', 'danger')}</td></tr>`).join('') || '<tr><td>ยังไม่มีบทความ</td></tr>'}</table>`)); });
const editor = (req, p = {}) => `<form method="post" class="form">${csrf(req)}<input name="title" placeholder="Title" value="${esc(p.title)}" required maxlength="200"><input name="slug" placeholder="URL slug (เว้นว่างเพื่อสร้างอัตโนมัติ)" value="${esc(p.slug)}"><input name="excerpt" placeholder="Short description (SEO)" value="${esc(p.excerpt)}" maxlength="300"><select name="cat">${cfg.categories.map(([k, v]) => `<option value="${k}" ${p.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select><input name="tags" placeholder="tags คั่นด้วย ," value="${esc(p.tags)}"><textarea name="body" rows="16" placeholder="เนื้อหา (เว้นบรรทัดเพื่อขึ้นย่อหน้าใหม่)" required>${esc(p.body)}</textarea><label>ตั้งเวลาเผยแพร่ (ไม่บังคับ, UTC) <input name="publish_at" type="datetime-local" value="${esc((p.publish_at || '').replace(' ', 'T'))}"></label><select name="status"><option value="draft" ${p.status !== 'published' ? 'selected' : ''}>Draft</option><option value="published" ${p.status === 'published' ? 'selected' : ''}>Publish</option></select><button class="btn">บันทึก</button></form>`;
app.get('/admin/new', admin, (req, res) => res.send(shell(req, 'Write', editor(req))));
app.get('/admin/edit/:id', admin, (req, res) => { const p = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id); p ? res.send(shell(req, 'Edit', editor(req, p))) : res.sendStatus(404); });
function save(req, res, id) {
  const b = req.body, cat = cats[b.cat] ? b.cat : cfg.categories[0][0]; let slug = slugify(b.slug || b.title);
  if (db.prepare('SELECT id FROM posts WHERE slug=? AND id IS NOT ?').get(slug, id || null)) slug += '-' + Date.now().toString(36);
  const v = [slug, String(b.title).slice(0, 200), String(b.excerpt || b.body).slice(0, 300), String(b.body), cat, String(b.tags || '').slice(0, 200), b.status === 'published' ? 'published' : 'draft', b.publish_at ? b.publish_at.replace('T', ' ') + (b.publish_at.length === 16 ? ':00' : '') : null];
  if (id) db.prepare('UPDATE posts SET slug=?,title=?,excerpt=?,body=?,cat=?,tags=?,status=?,publish_at=? WHERE id=?').run(...v, id); else db.prepare('INSERT INTO posts(slug,title,excerpt,body,cat,tags,status,publish_at) VALUES(?,?,?,?,?,?,?,?)').run(...v);
  res.redirect('/admin');
}
app.post('/admin/new', admin, (req, res) => save(req, res)); app.post('/admin/edit/:id', admin, (req, res) => save(req, res, +req.params.id));
app.post('/admin/toggle/:id', admin, (req, res) => { db.prepare("UPDATE posts SET status=CASE status WHEN 'published' THEN 'draft' ELSE 'published' END WHERE id=?").run(req.params.id); res.redirect('/admin'); });
app.post('/admin/delete/:id', admin, (req, res) => { db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id); res.redirect('/admin'); });
app.get('/admin/comments', admin, (req, res) => res.send(shell(req, 'Comments', `<table>${db.prepare('SELECT c.*,p.title FROM comments c JOIN posts p ON p.id=c.post_id ORDER BY c.id DESC LIMIT 200').all().map(c => `<tr><td><b>${esc(c.name)}</b> on ${esc(c.title)}<br>${esc(c.body)}</td><td>${c.hidden ? 'ซ่อนอยู่' : 'แสดง'}</td><td>${act(req, `/admin/comment/${c.id}/hide`, c.hidden ? 'แสดง' : 'ซ่อน')} ${act(req, `/admin/comment/${c.id}/delete`, 'ลบ', 'danger')}</td></tr>`).join('')}</table>`)));
app.post('/admin/comment/:id/hide', admin, (req, res) => { db.prepare('UPDATE comments SET hidden=1-hidden WHERE id=?').run(req.params.id); res.redirect('/admin/comments'); });
app.post('/admin/comment/:id/delete', admin, (req, res) => { db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id); res.redirect('/admin/comments'); });
app.get('/admin/messages', admin, (req, res) => res.send(shell(req, 'Messages', db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 100').all().map(m => `<div class="cm"><b>${esc(m.name)}</b> &lt;${esc(m.email)}&gt; — ${esc(m.subject)}<p>${esc(m.body)}</p></div>`).join('') || '<p class="muted">ยังไม่มีข้อความ</p>')));
app.get('/admin/profile', admin, (req, res) => res.send(shell(req, 'Profile', `<form method="post" class="form">${csrf(req)}<input name="name" value="${esc(req.session.user.name)}" required><input name="password" type="password" placeholder="รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" minlength="10"><button class="btn">บันทึก</button></form>`)));
app.post('/admin/profile', admin, (req, res) => { const id = req.session.user.id; db.prepare('UPDATE users SET name=? WHERE id=?').run(String(req.body.name).slice(0, 60), id);
  if (req.body.password && req.body.password.length >= 10) db.prepare('UPDATE users SET hash=? WHERE id=?').run(bcrypt.hashSync(req.body.password, 12), id); req.session.user.name = req.body.name; res.redirect('/admin'); });
// ---- SEO ----
app.get('/robots.txt', (q, r) => r.type('text').send(`User-agent: *\nDisallow: /admin\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`));
app.get('/sitemap.xml', (q, r) => r.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/blog', '/about', '/contact'].concat(cfg.categories.map(c => '/category/' + c[0])).map(u => `<url><loc>${cfg.siteUrl}${u}</loc></url>`).join('')}${list('').map(p => `<url><loc>${cfg.siteUrl}/post/${encodeURI(p.slug)}</loc><lastmod>${(p.publish_at || p.created).slice(0, 10)}</lastmod></url>`).join('')}</urlset>`));
app.use((req, res) => res.status(404).send(nf(req)));
app.listen(process.env.PORT || 3000, () => console.log('XieXinpaths running on :' + (process.env.PORT || 3000)));
