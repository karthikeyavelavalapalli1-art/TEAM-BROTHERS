const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL || 'https://yrfhqexuuzjkikhjhrxk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
}) : null;

const app = express();
const PORT = process.env.PORT || 3001;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parseCookies = (req) => {
  const list = {};
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
};

const cookieAuth = (req, res, next) => {
  const isPublicApi = 
    req.path === '/api/login' || 
    req.path === '/api/logout' ||
    req.path.startsWith('/api/analytics') ||
    (req.method === 'GET' && (
      req.path.startsWith('/api/past-works') ||
      req.path.startsWith('/api/ongoing-events') ||
      req.path.startsWith('/api/categories') ||
      req.path.startsWith('/api/site-content') ||
      req.path.startsWith('/api/statistics')
    ));

  if (isPublicApi) {
    return next();
  }

  const cookies = parseCookies(req);
  const token = cookies.admin_auth;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      console.error('JWT Verification failed', err.message);
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

app.use(cors());
app.use(express.json());
app.use(cookieAuth);
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ----------------------------------------
// Analytics
// ----------------------------------------
app.post('/api/analytics/start', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'Session ID required' });
  try {
    await pool.query('INSERT INTO analytics_sessions (session_id) VALUES ($1) ON CONFLICT (session_id) DO NOTHING', [session_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Analytics start error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/analytics/interaction', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'Session ID required' });
  try {
    await pool.query('UPDATE analytics_sessions SET interactions = interactions + 1, last_activity_time = CURRENT_TIMESTAMP WHERE session_id = $1', [session_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Analytics interaction error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/analytics/heartbeat', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'Session ID required' });
  try {
    await pool.query('UPDATE analytics_sessions SET last_activity_time = CURRENT_TIMESTAMP WHERE session_id = $1', [session_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Analytics heartbeat error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ----------------------------------------
// Auth
// ----------------------------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const masterUsername = process.env.ADMIN_USERNAME;
  const masterPassword = process.env.ADMIN_PASSWORD;

  if (username === masterUsername && password === masterPassword) {
    const token = jwt.sign({ username, role: 'master' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('admin_auth', token, { httpOnly: true, path: '/' });
    return res.json({ message: 'Login successful (Master)' });
  }

  try {
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (isValid) {
        const token = jwt.sign({ username: user.username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.cookie('admin_auth', token, { httpOnly: true, path: '/' });
        return res.json({ message: 'Login successful (Admin)' });
      }
    }
  } catch (err) {
    console.error('DB Login check error:', err);
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_auth', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------
// Admins
// ----------------------------------------
app.post('/api/create-admin', async (req, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Only the Master Admin can create new admins.' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [username, hash]);
    res.status(201).json({ message: 'Admin user created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

app.get('/api/admins', async (req, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Only the Master Admin can view admins.' });
  try {
    const result = await pool.query('SELECT id, username, created_at FROM admin_users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Only the Master Admin can delete admins.' });
  try {
    await pool.query('DELETE FROM admin_users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

app.put('/api/admins/:id', async (req, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Only the Master Admin can edit admins.' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query('UPDATE admin_users SET username = $1, password_hash = $2 WHERE id = $3', [username, hash, req.params.id]);
    res.json({ message: 'Admin updated successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

// ----------------------------------------
// Media (Supabase)
// ----------------------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/upload-media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedTypes.includes(req.file.mimetype)) return res.status(400).json({ error: 'Invalid file type. Only images and videos are allowed.' });
  if (!supabase) return res.status(500).json({ error: 'Supabase Storage is not configured.' });
  try {
    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    const { error } = await supabase.storage.from('TB').upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype, cacheControl: '3600', upsert: false
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('TB').getPublicUrl(fileName);
    res.json({ url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload to Supabase' });
  }
});

app.get('/api/media', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase.storage.from('TB').list();
    if (error) throw error;
    const files = data.filter(item => item.name !== '.emptyFolderPlaceholder').map(item => {
      const ext = path.extname(item.name).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].includes(ext);
      const { data: { publicUrl } } = supabase.storage.from('TB').getPublicUrl(item.name);
      return {
        name: item.name, url: publicUrl, isVideo: isVideo,
        size: item.metadata ? item.metadata.size : 0, createdAt: item.created_at
      };
    });
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list media' });
  }
});

app.delete('/api/media/:filename', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).json({ error: 'Invalid filename' });
    const { error } = await supabase.storage.from('TB').remove([filename]);
    if (error) throw error;
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ----------------------------------------
// Dashboard & Stats
// ----------------------------------------
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const projectsCount = await pool.query('SELECT COUNT(*) FROM past_works');
    const publishedCount = await pool.query("SELECT COUNT(*) FROM thoughts WHERE published = true");
    const categoriesCount = await pool.query('SELECT COUNT(*) FROM categories');
    const eventsCount = await pool.query('SELECT COUNT(*) FROM ongoing_events');
    const newMessagesCount = await pool.query('SELECT COUNT(*) FROM messages WHERE read_status = false');
    const latestEnquiries = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5');

    res.json({
      stats: {
        projects: parseInt(projectsCount.rows[0].count),
        published: parseInt(publishedCount.rows[0].count),
        categories: parseInt(categoriesCount.rows[0].count),
        events: parseInt(eventsCount.rows[0].count),
        newMessages: parseInt(newMessagesCount.rows[0].count)
      },
      latestEnquiries: latestEnquiries.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const visits = await pool.query('SELECT COUNT(DISTINCT session_id) as count FROM analytics_sessions');
    const interactions = await pool.query('SELECT SUM(interactions) as sum FROM analytics_sessions');
    const duration = await pool.query('SELECT AVG(EXTRACT(EPOCH FROM (last_activity_time - start_time))) as avg FROM analytics_sessions');

    let avgDurationSeconds = Math.round(duration.rows[0].avg || 0);
    let durationStr = `${Math.floor(avgDurationSeconds / 60)}m ${avgDurationSeconds % 60}s`;

    res.json([
      { id: 'visits', label: 'Members Visited', value: visits.rows[0].count },
      { id: 'interactions', label: 'Number of Interactions', value: interactions.rows[0].sum || 0 },
      { id: 'duration', label: 'Average Duration', value: durationStr }
    ]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ----------------------------------------
// Site Content
// ----------------------------------------
const SITE_CONTENT_PATH = path.join(__dirname, 'site-content.json');

app.get('/api/site-content', async (req, res) => {
  try {
    const data = await fsPromises.readFile(SITE_CONTENT_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'Site content not found' });
    else res.status(500).json({ error: 'Failed to read site content' });
  }
});

app.post('/api/site-content', async (req, res) => {
  try {
    if (typeof req.body !== 'object' || req.body === null) return res.status(400).json({ error: 'Invalid JSON body' });
    await fsPromises.writeFile(SITE_CONTENT_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ message: 'Site content updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write site content' });
  }
});

// ----------------------------------------
// Past Works
// ----------------------------------------
app.get('/api/past-works', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM past_works ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch past works' });
  }
});

app.get('/api/past-works/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM past_works WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/upload', async (req, res) => {
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) return res.status(400).json({ error: 'All fields are required.' });
  try {
    const query = `INSERT INTO past_works (title, category, image, description, prize_pool) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null]);
    await pool.query('INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)', [category]);
    res.status(201).json({ message: 'Tournament uploaded successfully', tournament: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload tournament to database' });
  }
});

app.delete('/api/past-works/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM past_works WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tournament not found' });
    const deletedProject = result.rows[0];
    if (deletedProject && deletedProject.image) {
      if (deletedProject.image.startsWith('uploads/')) {
        const imagePath = path.join(__dirname, 'public', deletedProject.image);
        if (fs.existsSync(imagePath)) {
          try { fs.unlinkSync(imagePath); } catch (unlinkErr) {}
        }
      } else if (deletedProject.image.includes('supabase.co/storage/v1/object/public/TB/')) {
        if (supabase) {
          try {
            const urlParts = deletedProject.image.split('/');
            const filename = urlParts[urlParts.length - 1];
            await supabase.storage.from('TB').remove([filename]);
          } catch (err) {}
        }
      }
    }
    res.json({ message: 'Tournament deleted successfully', deleted: deletedProject });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

app.put('/api/past-works/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) return res.status(400).json({ error: 'All fields are required.' });
  try {
    const query = `UPDATE past_works SET title = $1, category = $2, image = $3, description = $4, prize_pool = $5 WHERE id = $6 RETURNING *;`;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ message: 'Tournament updated successfully', tournament: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// ----------------------------------------
// Ongoing Events
// ----------------------------------------
app.get('/api/ongoing-events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ongoing_events ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ongoing events' });
  }
});

app.post('/api/ongoing-events', async (req, res) => {
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) return res.status(400).json({ error: 'All fields are required.' });
  try {
    const query = `INSERT INTO ongoing_events (title, category, image, description, prize_pool) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null]);
    await pool.query('INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)', [category]);
    res.status(201).json({ message: 'Event created successfully', event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ongoing event' });
  }
});

app.delete('/api/ongoing-events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ongoing_events WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.put('/api/ongoing-events/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) return res.status(400).json({ error: 'All fields are required.' });
  try {
    const query = `UPDATE ongoing_events SET title = $1, category = $2, image = $3, description = $4, prize_pool = $5 WHERE id = $6 RETURNING *;`;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    await pool.query('INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)', [category]);
    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.post('/api/ongoing-events/:id/done', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eventRes = await client.query('SELECT * FROM ongoing_events WHERE id = $1', [id]);
    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventRes.rows[0];
    await client.query('INSERT INTO past_works (title, category, image, description, prize_pool) VALUES ($1, $2, $3, $4, $5)', [event.title, event.category, event.image, event.description, event.prize_pool]);
    await client.query('DELETE FROM ongoing_events WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Event successfully transferred to projects' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to transfer event' });
  } finally {
    client.release();
  }
});

// ----------------------------------------
// Categories
// ----------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const oldRes = await pool.query('SELECT name FROM categories WHERE id = $1', [id]);
    if (oldRes.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    const oldName = oldRes.rows[0].name;
    const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    await pool.query('UPDATE past_works SET category = $1 WHERE category = $2', [name, oldName]);
    await pool.query('UPDATE ongoing_events SET category = $1 WHERE category = $2', [name, oldName]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Fallback for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
});
