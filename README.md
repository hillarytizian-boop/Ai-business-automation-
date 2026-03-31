# ◆ NexusAI — AI Business Assistant

A production-ready, full-stack AI Business Assistant with a premium dark UI, GPT-4 powered chat, user authentication, 2-day free trials, and an admin panel for activating paid users.

---

## ✨ Features

- **AI Chat** — GPT-4o-mini powered business assistant that qualifies leads and guides users toward conversion
- **Authentication** — Email/password registration & login with bcrypt-hashed passwords and session management
- **2-Day Free Trial** — Every new user gets a 48-hour full-access trial automatically
- **Admin Panel** — Activate/deactivate users via a web UI at `/admin`
- **Premium Dark UI** — Responsive, mobile-first design with Cormorant Garamond & Sora fonts
- **WhatsApp Integration** — Floating button and CTAs linked to `wa.me/0742251656`
- **Payment Flow** — PayPal payment instructions + WhatsApp support for manual activation

---

## 📁 Project Structure

```
ai-business-assistant/
├── server.js          # Main Express server (routes, auth, chat API)
├── database.js        # SQLite initialisation module
├── package.json       # Dependencies & scripts
├── .env.example       # Required environment variables template
├── render.yaml        # Render.com deployment config
├── data/              # SQLite database (auto-created on first run)
│   └── business_assistant.db
├── views/             # HTML pages (served by Express)
│   ├── index.html     # Landing page
│   ├── login.html     # Login page
│   ├── register.html  # Registration page
│   ├── dashboard.html # Chat dashboard
│   └── admin.html     # Admin panel
└── public/            # Static assets
    ├── style.css      # All styles
    └── app.js         # Landing page JS
```

---

## 🚀 Quick Start (Local)

### 1. Clone / Extract the project

```bash
cd ai-business-assistant
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-super-long-random-secret-here
OPENAI_API_KEY=sk-proj-...
ADMIN_TOKEN=your-admin-token-here
```

**Generate a SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Get an OpenAI API key:** https://platform.openai.com/api-keys

### 4. Start the server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Visit: http://localhost:3000

---

## 🔑 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Landing page |
| GET | `/login` | — | Login page |
| GET | `/register` | — | Register page |
| GET | `/dashboard` | Session | Chat dashboard |
| GET | `/admin` | — | Admin panel (token protected) |
| POST | `/register` | — | Create account + start trial |
| POST | `/login` | — | Authenticate + set session |
| POST | `/logout` | Session | Destroy session |
| GET | `/api/user` | Session | Current user status + access |
| POST | `/api/chat` | Session | Send message to AI |
| GET | `/admin/users` | Token | List all users |
| POST | `/admin/activate` | Token | Activate a user (`is_paid = 1`) |
| POST | `/admin/deactivate` | Token | Deactivate a user |

### Admin API (curl examples)

```bash
# List all users
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" http://localhost:3000/admin/users

# Activate a user
curl -X POST http://localhost:3000/admin/activate \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"email": "user@example.com"}'

# Deactivate a user
curl -X POST http://localhost:3000/admin/deactivate \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"email": "user@example.com"}'
```

---

## 🌐 Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Push your code to a GitHub/GitLab repo
2. Go to https://render.com → New → Blueprint
3. Connect your repo — Render will detect `render.yaml` automatically
4. In the Render dashboard, set these environment variables manually:
   - `OPENAI_API_KEY` — your OpenAI key
   - `ADMIN_TOKEN` — a strong secret token
5. Deploy!

### Option B: Manual Web Service

1. New → Web Service → Connect repo
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. **Environment:** Node
5. Add environment variables (see `.env.example`)
6. Deploy

### ⚠️ Important: Database Persistence

SQLite stores data in a local file (`./data/business_assistant.db`). On Render's free tier, the filesystem is **ephemeral** — data is reset on every deploy.

**For production, use one of these options:**

**Option 1: Render Persistent Disk** (paid plans)
- Uncomment the `disk` section in `render.yaml`
- Set `DB_PATH=/data/business_assistant.db` in env vars

**Option 2: External Database** (recommended for scale)
- Migrate to PostgreSQL using `pg` package
- Render offers a free PostgreSQL database

**For development/testing**, the local SQLite file works perfectly.

---

## 💳 Payment & Activation Flow

1. User registers → gets 2-day free trial
2. Trial expires → user sees locked screen with payment instructions
3. User sends payment via **PayPal to `kingtizian008@gmail.com`**
4. User contacts **WhatsApp 0742251656** with payment proof
5. Admin opens `/admin`, enters `ADMIN_TOKEN`, finds user, clicks **Activate**
6. User refreshes dashboard → full access restored

---

## 🔧 Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ | Long random string for session signing |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `ADMIN_TOKEN` | ✅ | Secret token for admin endpoints |
| `PORT` | Optional | Server port (default: 3000) |
| `NODE_ENV` | Optional | `development` or `production` |
| `DB_PATH` | Optional | Custom SQLite file path |

---

## 🛡️ Security Notes

- Passwords hashed with bcrypt (cost factor 12)
- Sessions use `httpOnly` cookies; `secure` flag auto-enabled in production
- Admin endpoints require a secret token (not session-based)
- Input validation on all API routes
- Message history capped at 20 messages to control context size
- User-submitted content stripped to safe roles only

---

## 📞 Support

- **WhatsApp:** https://wa.me/0742251656
- **PayPal:** kingtizian008@gmail.com
