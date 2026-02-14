# LH2 Holdings - AOP Dashboard

A shared Annual Operating Plan (AOP) dashboard for LH2 Holdings with real-time collaboration and persistent data storage.

## Features

- 📊 **Consolidated P&L Overview** with interactive charts
- 📝 **Syndication Brands** - Programmatic + Syndication + MSN Videos
- 🔍 **Discover Brands** - Traffic × RPM model
- 👥 **Hiring Plans** per brand
- ⚙️ **Configurable Settings** - RPM seasonality, overhead costs
- 💾 **Auto-save** - Changes sync automatically
- 👥 **Multi-user** - All users see the same data

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + Recharts
- **Backend:** Express.js
- **Storage:** JSON file (persistent on Render disk)

---

## 🚀 Deploy to Render (Recommended)

### Option 1: One-Click Deploy (Easiest)

1. Push this code to a GitHub repository
2. Go to [render.com](https://render.com) and sign up/login
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and deploy!

### Option 2: Manual Deploy

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repo
5. Configure:
   - **Name:** `lh2-aop-dashboard`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
6. Add a **Disk:**
   - **Name:** `data`
   - **Mount Path:** `/opt/render/project/src/data`
   - **Size:** 1 GB
7. Click **"Create Web Service"**

Your app will be live at: `https://lh2-aop-dashboard.onrender.com`

---

## 💻 Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd lh2-aop-dashboard

# Install dependencies
npm install

# Run frontend + backend together
npm run dev:full
```

Or run them separately:

```bash
# Terminal 1: Frontend (Vite dev server)
npm run dev

# Terminal 2: Backend (Express server)
npm run dev:server
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## 📁 Project Structure

```
lh2-aop-dashboard/
├── src/
│   ├── App.jsx          # Main React app
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind CSS
├── data/
│   └── state.json       # Persistent data storage
├── server.js            # Express backend
├── package.json
├── vite.config.js
├── tailwind.config.js
├── render.yaml          # Render deployment config
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/state` | Fetch current dashboard state |
| POST | `/api/state` | Save dashboard state |
| POST | `/api/reset` | Reset to default values |
| GET | `/api/health` | Health check |

---

## ⚠️ Important Notes

1. **Data Persistence:** On Render's free tier with a disk, your data persists. Without a disk, data resets on each deploy.

2. **Concurrent Edits:** This uses simple "last write wins" - if two users edit simultaneously, the last save wins. For real-time collaboration, you'd need WebSockets.

3. **Backups:** Consider periodically downloading your `state.json` for backup.

---

## 🔧 Customization

### Change Default Values

Edit `INITIAL_BASELINE_DATA` in `src/App.jsx` to set different starting values.

### Add Authentication

For private access, you can:
- Add basic auth to the Express server
- Use Render's environment variables for credentials
- Or integrate with Auth0/Firebase Auth

---

## 📝 License

MIT License - Feel free to modify and use for your organization.
"# LH2-AOP-dashboard" 
