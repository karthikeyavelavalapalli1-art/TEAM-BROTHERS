const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
  auth: {
    persistSession: false
  },
  realtime: {
    transport: WebSocket
  }
}) : null;

const app = express();
// Using port from .env or fallback to 4000 for the admin dashboard
const PORT = process.env.ADMIN_PORT || 4000;
// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Cookie Parser Utility
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

// Cookie Auth Middleware
const cookieAuth = (req, res, next) => {
  // Allow login page, assets, and login API
  if (req.path === '/login.html' || req.path === '/admin.css' || req.path === '/api/login') {
    return next();
  }

  const cookies = parseCookies(req);
  const token = cookies.admin_auth;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // { username, role }
      return next();
    } catch (err) {
      console.error('JWT Verification failed', err.message);
    }
  }

  // Not authenticated: redirect or error
  if (req.path === '/' || req.path === '/index.html') {
    return res.redirect('/login.html');
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Middleware
app.use(cors());
app.use(express.json()); // Need to parse JSON before login route
app.use(cookieAuth); // Protect all routes below this line
app.use(express.static(path.join(__dirname, 'admin-public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Multer Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Media API (admin only)
app.post('/api/upload-media', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase Storage is not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.' });
  }

  try {
    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;

    const { data, error } = await supabase
      .storage
      .from('TB')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('TB')
      .getPublicUrl(fileName);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Supabase upload error:', err);
    res.status(500).json({ error: 'Failed to upload to Supabase' });
  }
});

// List Media API — reads files from Supabase Storage
app.get('/api/media', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase.storage.from('TB').list();
    if (error) throw error;
    
    const files = data
      .filter(item => item.name !== '.emptyFolderPlaceholder')
      .map(item => {
        const ext = path.extname(item.name).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].includes(ext);
        const { data: { publicUrl } } = supabase.storage.from('TB').getPublicUrl(item.name);
        
        return {
          name: item.name,
          url: publicUrl,
          isVideo: isVideo,
          size: item.metadata ? item.metadata.size : 0,
          createdAt: item.created_at
        };
      });
      
    // Sort by newest first
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(files);
  } catch (err) {
    console.error('Failed to list media from Supabase:', err);
    res.status(500).json({ error: 'Failed to list media' });
  }
});

// Delete Media API — deletes a single file from Supabase Storage
app.delete('/api/media/:filename', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const filename = req.params.filename;
    if (!filename) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const { error } = await supabase.storage.from('TB').remove([filename]);
    if (error) throw error;
    
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Failed to delete media from Supabase:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Get Dashboard Stats API
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
    console.error('Failed to fetch dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get Current User API
app.get('/api/me', (req, res) => {
  res.json({ user: req.user });
});

// Login API Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const masterUsername = process.env.ADMIN_USERNAME;
  const masterPassword = process.env.ADMIN_PASSWORD;

  // 1. Check Master Admin (from .env)
  if (username === masterUsername && password === masterPassword) {
    const token = jwt.sign({ username, role: 'master' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('admin_auth', token, { httpOnly: true, path: '/' });
    return res.json({ message: 'Login successful (Master)' });
  }

  // 2. Check Sub-Admins (from DB)
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

// Logout API Endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_auth', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

// Create Sub-Admin Endpoint
app.post('/api/create-admin', async (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Only the Master Admin can create new admins.' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO admin_users (username, password_hash, plain_password) VALUES ($1, $2, $3)',
      [username, hash, password]
    );

    res.status(201).json({ message: 'Admin user created successfully' });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation in Postgres
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Error creating admin:', err);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Get Sub-Admins Endpoint
app.get('/api/admins', async (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Only the Master Admin can view admins.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, plain_password, created_at FROM admin_users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admins:', err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Delete Sub-Admin Endpoint
app.delete('/api/admins/:id', async (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Only the Master Admin can delete admins.' });
  }

  const adminId = req.params.id;

  try {
    await pool.query('DELETE FROM admin_users WHERE id = $1', [adminId]);
    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    console.error('Error deleting admin:', err);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// Edit Sub-Admin Endpoint
app.put('/api/admins/:id', async (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Only the Master Admin can edit admins.' });
  }

  const adminId = req.params.id;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await pool.query(
      'UPDATE admin_users SET username = $1, password_hash = $2, plain_password = $3 WHERE id = $4',
      [username, hash, password, adminId]
    );

    res.json({ message: 'Admin updated successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Error updating admin:', err);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

const fsPromises = require('fs/promises');

// Site Content API
const SITE_CONTENT_PATH = path.join(__dirname, 'site-content.json');

app.get('/api/site-content', async (req, res) => {
  try {
    const data = await fsPromises.readFile(SITE_CONTENT_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Site content not found' });
    } else {
      res.status(500).json({ error: 'Failed to read site content' });
    }
  }
});

app.post('/api/site-content', async (req, res) => {
  try {
    // Basic validation that body is an object
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    await fsPromises.writeFile(SITE_CONTENT_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ message: 'Site content updated successfully' });
  } catch (err) {
    console.error('Error writing site content:', err);
    res.status(500).json({ error: 'Failed to write site content' });
  }
});

// Upload API Endpoint
app.post('/api/upload', async (req, res) => {
  const { title, category, image, description, prize_pool } = req.body;

  // Basic validation
  if (!title || !category || !image || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const query = `
      INSERT INTO past_works (title, category, image, description, prize_pool)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null]);

    // Automatically add category if it doesn't exist
    await pool.query(
      'INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)',
      [category]
    );

    res.status(201).json({
      message: 'Tournament uploaded successfully',
      tournament: result.rows[0]
    });
  } catch (err) {
    console.error('Database insertion error:', err);
    res.status(500).json({ error: 'Failed to upload tournament to database' });
  }
});

// Fetch all past works (for admin dashboard)
app.get('/api/past-works', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM past_works ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Failed to fetch past works' });
  }
});

// Delete a past work by ID
app.delete('/api/past-works/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM past_works WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const deletedProject = result.rows[0];
    if (deletedProject && deletedProject.image) {
      if (deletedProject.image.startsWith('uploads/')) {
        // Local fallback cleanup
        const imagePath = path.join(__dirname, 'public', deletedProject.image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
          } catch (unlinkErr) {
            console.error('Failed to delete local image file:', unlinkErr);
          }
        }
      } else if (deletedProject.image.includes('supabase.co/storage/v1/object/public/TB/')) {
        // Supabase cleanup
        if (supabase) {
          try {
            // Extract filename from URL
            const urlParts = deletedProject.image.split('/');
            const filename = urlParts[urlParts.length - 1];
            await supabase.storage.from('TB').remove([filename]);
          } catch (err) {
            console.error('Failed to delete Supabase image:', err);
          }
        }
      }
    }

    res.json({ message: 'Tournament deleted successfully', deleted: deletedProject });
  } catch (err) {
    console.error('Database deletion error:', err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

// Update a past work by ID
app.put('/api/past-works/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, image, description, prize_pool } = req.body;

  if (!title || !category || !image || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const query = `
      UPDATE past_works 
      SET title = $1, category = $2, image = $3, description = $4, prize_pool = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({ message: 'Tournament updated successfully', tournament: result.rows[0] });
  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// GET all statistics (computed dynamically)
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
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ---- ONGOING EVENTS API ----

// Fetch all ongoing events
app.get('/api/ongoing-events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ongoing_events ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Failed to fetch ongoing events' });
  }
});

// Create ongoing event
app.post('/api/ongoing-events', async (req, res) => {
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const query = `
      INSERT INTO ongoing_events (title, category, image, description, prize_pool)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null]);
    
    // Auto-insert category
    await pool.query(
      'INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)',
      [category]
    );

    res.status(201).json({ message: 'Event created successfully', event: result.rows[0] });
  } catch (err) {
    console.error('Database insertion error:', err);
    res.status(500).json({ error: 'Failed to create ongoing event' });
  }
});

// Delete ongoing event
app.delete('/api/ongoing-events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ongoing_events WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Edit ongoing event
app.put('/api/ongoing-events/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, image, description, prize_pool } = req.body;
  if (!title || !category || !image || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const query = `
      UPDATE ongoing_events 
      SET title = $1, category = $2, image = $3, description = $4, prize_pool = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [title, category, image, description, prize_pool || null, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    await pool.query(
      'INSERT INTO categories (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)',
      [category]
    );

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Mark ongoing event as done (transfer to past_works)
app.post('/api/ongoing-events/:id/done', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Fetch the event
    const eventRes = await client.query('SELECT * FROM ongoing_events WHERE id = $1', [id]);
    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventRes.rows[0];
    
    // Insert into past_works
    await client.query(
      'INSERT INTO past_works (title, category, image, description, prize_pool) VALUES ($1, $2, $3, $4, $5)',
      [event.title, event.category, event.image, event.description, event.prize_pool]
    );
    
    // Delete from ongoing_events
    await client.query('DELETE FROM ongoing_events WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Event successfully transferred to projects' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error transferring event:', err);
    res.status(500).json({ error: 'Failed to transfer event' });
  } finally {
    client.release();
  }
});

// ---- END ONGOING EVENTS API ----

// GET all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST new category
app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// DELETE category
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// EDIT category
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    // 1. Get old name
    const oldRes = await pool.query('SELECT name FROM categories WHERE id = $1', [id]);
    if (oldRes.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const oldName = oldRes.rows[0].name;

    // 2. Update categories table
    const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    
    // 3. Cascade update to past_works & ongoing_events
    await pool.query('UPDATE past_works SET category = $1 WHERE category = $2', [name, oldName]);
    await pool.query('UPDATE ongoing_events SET category = $1 WHERE category = $2', [name, oldName]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Database update error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Fallback to serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'admin-public', 'index.html'));
});

// Start Admin Server
app.listen(PORT, async () => {
  console.log(`Admin Server is running on http://localhost:${PORT}`);
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
});
