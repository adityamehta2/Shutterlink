require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('./db');
const { auth, photographerOnly } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const tokenFor = u => jwt.sign(publicUser(u), JWT_SECRET, { expiresIn: '7d' });

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'ShutterLink API', database: 'connected' });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role === 'photographer' ? 'photographer' : 'client';
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Name must be 2–100 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const hash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [name,email,hash,role]);
    if (role === 'photographer') {
      await conn.execute(
        'INSERT INTO photographer_profiles (user_id,headline,bio,city,categories,price_from,cover_image) VALUES (?,?,?,?,?,?,?)',
        [result.insertId, 'Independent photographer', 'Tell clients about your style and experience.', 'Mumbai', JSON.stringify(['Portraits']), 2500, 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1200&q=80']
      );
    }
    await conn.commit();
    const user = { id: result.insertId, name, email, role };
    res.status(201).json({ user, token: tokenFor(user) });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists.' });
    throw e;
  } finally { conn.release(); }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [rows] = await pool.execute('SELECT id,name,email,password_hash,role FROM users WHERE email=?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const user = publicUser(rows[0]);
  res.json({ user, token: tokenFor(user) });
}));

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

const photographerSelect = `
  SELECT p.id, u.id AS user_id, u.name, u.email, p.headline, p.bio, p.city,
         p.categories, p.price_from, p.rating, p.review_count, p.cover_image
  FROM photographer_profiles p JOIN users u ON u.id=p.user_id`;

app.get('/api/photographers', asyncRoute(async (req, res) => {
  const { search = '', category = '', city = '', maxPrice = '', minRating = '', date = '' } = req.query;
  const where = [];
  const args = [];
  if (search) {
    where.push('(u.name LIKE ? OR p.headline LIKE ? OR p.bio LIKE ? OR p.city LIKE ?)');
    const term = `%${String(search).slice(0,80)}%`;
    args.push(term,term,term,term);
  }
  if (city) { where.push('p.city LIKE ?'); args.push(`%${String(city).slice(0,80)}%`); }
  if (category) { where.push('JSON_CONTAINS(p.categories, JSON_QUOTE(?))'); args.push(String(category)); }
  if (maxPrice !== '' && Number.isFinite(Number(maxPrice))) { where.push('p.price_from <= ?'); args.push(Number(maxPrice)); }
  if (minRating !== '' && Number.isFinite(Number(minRating))) { where.push('p.rating >= ?'); args.push(Number(minRating)); }
  let sql = `${photographerSelect} ${where.length ? 'WHERE '+where.join(' AND ') : ''}`;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    sql += ` AND p.id NOT IN (SELECT photographer_id FROM bookings WHERE event_date=? AND status IN ('pending','confirmed'))`.replace(' AND p.id NOT IN', where.length ? ' AND p.id NOT IN' : ' WHERE p.id NOT IN');
    args.push(date);
  }
  sql += ' ORDER BY p.rating DESC, p.review_count DESC, p.price_from ASC';
  const [rows] = await pool.execute(sql, args);
  const ids = rows.map(r => r.id);
  let portfolios = {};
  if (ids.length) {
    const [items] = await pool.query(`SELECT id,photographer_id,title,image_url,category FROM portfolio_items WHERE photographer_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id DESC`, ids);
    for (const item of items) (portfolios[item.photographer_id] ||= []).push(item);
  }
  res.json({ photographers: rows.map(p => ({ ...p, categories: typeof p.categories === 'string' ? JSON.parse(p.categories) : p.categories, portfolio: portfolios[p.id] || [] })) });
}));

app.get('/api/photographers/:id', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`${photographerSelect} WHERE p.id=?`, [Number(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Photographer not found.' });
  const [portfolio] = await pool.execute('SELECT id,title,image_url,category FROM portfolio_items WHERE photographer_id=? ORDER BY id DESC', [Number(req.params.id)]);
  const p = rows[0];
  res.json({ photographer: { ...p, categories: typeof p.categories === 'string' ? JSON.parse(p.categories) : p.categories, portfolio } });
}));

app.put('/api/photographers/me', auth(), photographerOnly, asyncRoute(async (req, res) => {
  const city = String(req.body.city || '').trim().slice(0,100);
  const headline = String(req.body.headline || '').trim().slice(0,180);
  const bio = String(req.body.bio || '').trim().slice(0,3000);
  const categories = Array.isArray(req.body.categories) ? req.body.categories.filter(c => typeof c === 'string').slice(0,10) : [];
  const price = Number(req.body.price_from);
  const cover = String(req.body.cover_image || '').trim().slice(0,500);
  if (!city || !headline || !categories.length || !Number.isFinite(price) || price < 0 || price > 10000000) {
    return res.status(400).json({ error: 'City, headline, at least one category, and a valid price are required.' });
  }
  await pool.execute('UPDATE photographer_profiles SET city=?,headline=?,bio=?,categories=?,price_from=?,cover_image=? WHERE user_id=?',
    [city,headline,bio,JSON.stringify(categories),price,cover || null,req.user.id]);
  res.json({ ok: true });
}));

app.post('/api/photographers/me/portfolio', auth(), photographerOnly, asyncRoute(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0,150);
  const image_url = String(req.body.image_url || '').trim().slice(0,500);
  const category = String(req.body.category || '').trim().slice(0,80);
  if (!title || !category || !/^https?:\/\//i.test(image_url)) return res.status(400).json({ error: 'Title, category, and a valid http(s) image URL are required.' });
  const [p] = await pool.execute('SELECT id FROM photographer_profiles WHERE user_id=?', [req.user.id]);
  if (!p.length) return res.status(404).json({ error: 'Photographer profile not found.' });
  const [result] = await pool.execute('INSERT INTO portfolio_items (photographer_id,title,image_url,category) VALUES (?,?,?,?)', [p[0].id,title,image_url,category]);
  res.status(201).json({ id: result.insertId, title, image_url, category });
}));

app.post('/api/bookings', auth(), asyncRoute(async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Use a client account to book a photographer.' });
  const photographerId = Number(req.body.photographer_id);
  const date = String(req.body.event_date || '');
  const time = String(req.body.event_time || '10:00');
  const location = String(req.body.location || '').trim().slice(0,180);
  const category = String(req.body.category || '').trim().slice(0,80);
  const notes = String(req.body.notes || '').trim().slice(0,2000);
  if (!Number.isInteger(photographerId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0,10) || !/^\d{2}:\d{2}$/.test(time) || !location || !category) {
    return res.status(400).json({ error: 'Choose a valid future date, time, location, and category.' });
  }
  const [profiles] = await pool.execute('SELECT id,price_from FROM photographer_profiles WHERE id=?', [photographerId]);
  if (!profiles.length) return res.status(404).json({ error: 'Photographer not found.' });
  const [busy] = await pool.execute("SELECT id FROM bookings WHERE photographer_id=? AND event_date=? AND status IN ('pending','confirmed')", [photographerId,date]);
  if (busy.length) return res.status(409).json({ error: 'This photographer already has a booking on that date. Choose another date.' });
  const [result] = await pool.execute(
    'INSERT INTO bookings (client_id,photographer_id,event_date,event_time,location,category,notes,total_amount) VALUES (?,?,?,?,?,?,?,?)',
    [req.user.id,photographerId,date,time,location,category,notes,profiles[0].price_from]
  );
  res.status(201).json({ booking: { id: result.insertId, event_date: date, status: 'pending', total_amount: profiles[0].price_from } });
}));

app.get('/api/bookings/mine', auth(), asyncRoute(async (req, res) => {
  const sql = req.user.role === 'client'
    ? `SELECT b.*, u.name AS photographer_name, p.city AS photographer_city FROM bookings b JOIN photographer_profiles p ON p.id=b.photographer_id JOIN users u ON u.id=p.user_id WHERE b.client_id=? ORDER BY b.event_date DESC`
    : `SELECT b.*, u.name AS client_name, p.city AS photographer_city FROM bookings b JOIN photographer_profiles p ON p.id=b.photographer_id JOIN users u ON u.id=b.client_id WHERE p.user_id=? ORDER BY b.event_date DESC`;
  const [rows] = await pool.execute(sql, [req.user.id]);
  res.json({ bookings: rows });
}));

app.post('/api/bookings/:id/demo-payment', auth(), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.execute('SELECT * FROM bookings WHERE id=? AND client_id=?', [id,req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
  const booking = rows[0];
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Only pending bookings can be paid in this demo.' });
  const reference = 'DEMO-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("INSERT INTO payments (booking_id,amount,provider,status,reference_code) VALUES (?,?,'DEMO','demo_paid',?) ON DUPLICATE KEY UPDATE status='demo_paid',reference_code=VALUES(reference_code)", [id,booking.total_amount,reference]);
    await conn.execute("UPDATE bookings SET status='confirmed' WHERE id=?", [id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ ok: true, reference, message: 'Demo payment recorded. No real money was charged.' });
}));

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Invalid related record.' });
  res.status(500).json({ error: 'Something went wrong on the server. Check server logs.' });
});

app.listen(PORT, () => console.log(`ShutterLink API listening on http://localhost:${PORT}`));
