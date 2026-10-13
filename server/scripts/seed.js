require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

async function seed() {
  const hash = await bcrypt.hash('Demo123!', 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.query('DELETE FROM payments');
    await conn.query('DELETE FROM bookings');
    await conn.query('DELETE FROM portfolio_items');
    await conn.query('DELETE FROM photographer_profiles');
    await conn.query('DELETE FROM users');
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    const [client] = await conn.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Demo Client','client@shutterlink.test',hash,'client']);
    const [maya] = await conn.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Maya Kapoor','maya@shutterlink.test',hash,'photographer']);
    const [arjun] = await conn.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Arjun Rao','arjun@shutterlink.test',hash,'photographer']);
    const [zoya] = await conn.execute('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Zoya Fernandes','zoya@shutterlink.test',hash,'photographer']);

    const profiles = [
      [maya.insertId,'Editorial & wedding storyteller','Candid frames, warm tones, and honest moments. Available for weddings, portraits, and intimate celebrations.','Mumbai',JSON.stringify(['Weddings','Portraits','Events']),8500,4.9,42,'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1400&q=85'],
      [arjun.insertId,'Product photographer with a clean eye','Studio product photography and brand campaigns for growing businesses.','Pune',JSON.stringify(['Products','Fashion','Commercial']),5000,4.8,31,'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1400&q=85'],
      [zoya.insertId,'People, places & little details','Lifestyle portraits and event coverage with a documentary approach.','Mumbai',JSON.stringify(['Portraits','Events','Travel']),3500,4.7,24,'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=85']
    ];
    const profileIds = [];
    for (const p of profiles) {
      const [r] = await conn.execute('INSERT INTO photographer_profiles (user_id,headline,bio,city,categories,price_from,rating,review_count,cover_image) VALUES (?,?,?,?,?,?,?,?,?)',p);
      profileIds.push(r.insertId);
    }
    const portfolio = [
      [profileIds[0],'A golden-hour celebration','https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=80','Weddings'],
      [profileIds[0],'Quiet portrait, loud story','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80','Portraits'],
      [profileIds[0],'The details matter','https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=80','Weddings'],
      [profileIds[1],'Objects in soft light','https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1000&q=80','Products'],
      [profileIds[1],'A little bit of texture','https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80','Fashion'],
      [profileIds[1],'Everyday essentials','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80','Products'],
      [profileIds[2],'Sunlit and unposed','https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1000&q=80','Portraits'],
      [profileIds[2],'A day worth remembering','https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1000&q=80','Events']
    ];
    for (const item of portfolio) await conn.execute('INSERT INTO portfolio_items (photographer_id,title,image_url,category) VALUES (?,?,?,?)',item);
    await conn.commit();
    console.log('Seed complete. Demo password for all accounts: Demo123!');
    console.log('client@shutterlink.test, maya@shutterlink.test, arjun@shutterlink.test, zoya@shutterlink.test');
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); await pool.end(); }
}
seed().catch(e => { console.error(e); process.exit(1); });
