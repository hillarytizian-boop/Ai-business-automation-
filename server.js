require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const OpenAI = require('openai');
const { initDB, getDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  next();
}

function requireLoginRedirect(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// ─── View Routes ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', requireLoginRedirect, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// ─── Auth API ─────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const db = getDB();

  try {
    const existing = await dbGet(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const trialEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const result = await dbRun(db,
      'INSERT INTO users (email, password_hash, is_paid, trial_end, created_at) VALUES (?, ?, 0, ?, ?)',
      [email.toLowerCase(), passwordHash, trialEnd, new Date().toISOString()]
    );

    req.session.userId = result.lastID;
    req.session.email = email.toLowerCase();

    return res.status(201).json({ success: true, message: 'Account created successfully.', redirect: '/dashboard' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = getDB();

  try {
    const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;

    return res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/' });
  });
});

// ─── User API ─────────────────────────────────────────────────────────────────
app.get('/api/user', requireLogin, async (req, res) => {
  const db = getDB();
  try {
    const user = await dbGet(db, 'SELECT id, email, is_paid, trial_end, created_at FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      req.session.destroy();
      return res.status(404).json({ error: 'User not found.' });
    }

    const now = new Date();
    const trialExpired = new Date(user.trial_end) < now;
    const hasAccess = user.is_paid === 1 || !trialExpired;

    return res.json({
      id: user.id,
      email: user.email,
      is_paid: user.is_paid === 1,
      trial_end: user.trial_end,
      trial_expired: trialExpired,
      has_access: hasAccess,
      created_at: user.created_at
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Chat API ─────────────────────────────────────────────────────────────────
app.post('/api/chat', requireLogin, async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const db = getDB();
  try {
    const user = await dbGet(db, 'SELECT is_paid, trial_end FROM users WHERE id = ?', [req.session.userId]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const now = new Date();
    const trialExpired = new Date(user.trial_end) < now;
    const hasAccess = user.is_paid === 1 || !trialExpired;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'access_denied',
        message: 'Your trial has expired. Please activate your account to continue.'
      });
    }

    // Sanitize messages – only allow user/assistant roles
    const sanitized = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20) // keep last 20 messages for context
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from the user.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are an elite AI Business Assistant for a premium professional services company. Your role is to:

1. QUALIFY LEADS: Ask smart questions to understand the prospect's business, pain points, budget, and timeline. Be conversational and natural.
2. EDUCATE: Clearly explain how our services solve their specific problems. Use concrete benefits, not vague claims.
3. BUILD TRUST: Be knowledgeable, professional, empathetic, and concise. Never be pushy or salesy.
4. GUIDE TO BOOKING: Once you understand their needs, guide them toward scheduling a consultation or activating their premium account.
5. HANDLE OBJECTIONS: Address concerns with empathy and evidence. Never dismiss objections.
6. FOLLOW UP PROMPTS: Always end with a clear, open-ended question that moves the conversation forward.

Tone: Confident, warm, premium. Think senior business consultant, not sales rep.
Format: Use short paragraphs (2–3 sentences max). Use bullet points sparingly, only for lists of 3+. Never use markdown headers in responses.
Length: Keep replies concise (100–200 words) unless the user asks for detail.

Key services to highlight (adapt naturally to conversation):
- AI-powered lead generation and qualification
- 24/7 automated customer engagement
- Business process automation
- Custom AI chatbot deployment
- Sales funnel optimisation

Payment & activation: If the user asks about pricing or activation, mention they can complete payment via PayPal to kingtizian008@gmail.com and contact WhatsApp at 0742251656 for instant activation.

If unsure about something specific to the company, say you'll connect them with a specialist.`
        },
        ...sanitized
      ]
    });

    const reply = completion.choices[0]?.message?.content || 'I apologise, I was unable to generate a response. Please try again.';
    return res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    if (err.code === 'insufficient_quota') {
      return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again later.' });
    }
    return res.status(500).json({ error: 'Failed to get AI response. Please try again.' });
  }
});

// ─── Admin API ────────────────────────────────────────────────────────────────
// Simple token-based admin protection (set ADMIN_TOKEN in .env)
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.body.admin_token || req.query.admin_token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid admin token.' });
  }
  next();
}

app.post('/admin/activate', requireAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const db = getDB();
  try {
    const user = await dbGet(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await dbRun(db, 'UPDATE users SET is_paid = 1 WHERE email = ?', [email.toLowerCase()]);
    return res.json({ success: true, message: `User ${email} has been activated.` });
  } catch (err) {
    console.error('Activate error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/admin/deactivate', requireAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const db = getDB();
  try {
    await dbRun(db, 'UPDATE users SET is_paid = 0 WHERE email = ?', [email.toLowerCase()]);
    return res.json({ success: true, message: `User ${email} has been deactivated.` });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/admin/users', requireAdmin, async (req, res) => {
  const db = getDB();
  try {
    const users = await dbAll(db, 'SELECT id, email, is_paid, trial_end, created_at FROM users ORDER BY created_at DESC', []);
    const now = new Date();
    const enriched = users.map(u => ({
      ...u,
      is_paid: u.is_paid === 1,
      trial_expired: new Date(u.trial_end) < now,
      has_access: u.is_paid === 1 || new Date(u.trial_end) >= now
    }));
    return res.json({ users: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── DB Helpers (promisified) ─────────────────────────────────────────────────
function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

// ─── Start Server ─────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  AI Business Assistant running on http://localhost:${PORT}`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
