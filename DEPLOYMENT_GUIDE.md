# 🚀 PathFinder Pro - Deployment Guide

Complete guide to deploy your PathFinder Pro career guidance platform for **FREE**.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Backend Deployment Options](#backend-deployment)
3. [Frontend Deployment Options](#frontend-deployment)
4. [Environment Variables Setup](#environment-variables)
5. [Troubleshooting](#troubleshooting)

---

## ⚡ Quick Start

### What You Need:
- ✅ Backend API (FastAPI/Python)
- ✅ Frontend (React/Vite)
- ✅ Supabase account (already configured)
- ✅ Google Gemini API key (already configured)
- ✅ JSearch API key (already configured)

### Recommended Free Stack:
- **Backend**: Render.com (Free tier)
- **Frontend**: Netlify or Vercel (Free tier)
- **Database**: Supabase (Free tier - already set up)

---

## 🔧 Backend Deployment

### Option 1: Render.com (RECOMMENDED - Easiest)

**Steps:**

1. **Create Account**
   - Go to https://render.com
   - Sign up with GitHub (recommended) or email

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder as root

3. **Configure Settings**
   ```
   Name: pathfinder-pro-backend
   Region: Oregon (closest to you)
   Branch: main
   Root Directory: backend
   Runtime: Python 3
   ```

4. **Build & Start Commands**
   ```bash
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

5. **Add Environment Variables**
   In Render dashboard, add these env vars:
   ```
   GOOGLE_API_KEY=AIzaSyAEeoKJWSFHczC154P3V_VjDwHH3nGy0o8
   SUPABASE_URL=https://vqslnjuewhbqonbfpfjb.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxc2xuanVld2hicW9uYmZwZmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODczNjgsImV4cCI6MjA4MTY2MzM2OH0.QKne1OckclAcTlUdu0n9nN3xQyUM7lqFzX-JXcdcqos
   JSEARCH_API_KEY=7f7148bf4amshf30da1151d49697p13f75ajsn33f28c1acde9
   SEARCHAPI_KEY=3X1FJ4ZULzH5zewC4Vsm1DVy
   ```

6. **Deploy**
   - Click "Create Web Service"
   - Wait 3-5 minutes for deployment
   - Your backend will be live at: `https://pathfinder-pro-backend.onrender.com`

**Note**: Render free tier spins down after 15 minutes of inactivity. First request may take 30-50 seconds.

---

### Option 2: Railway.app

**Steps:**

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Set root directory to `backend`
6. Add environment variables (same as above)
7. Deploy!

---

### Option 3: Heroku

**Steps:**

1. Install Heroku CLI:
   ```bash
   npm install -g heroku
   ```

2. Login and create app:
   ```bash
   heroku login
   cd backend
   heroku create pathfinder-pro-backend
   ```

3. Set buildpack:
   ```bash
   heroku buildpacks:set heroku/python
   ```

4. Add environment variables:
   ```bash
   heroku config:set GOOGLE_API_KEY=your_key
   heroku config:set SUPABASE_URL=your_url
   heroku config:set SUPABASE_KEY=your_key
   heroku config:set JSEARCH_API_KEY=your_key
   ```

5. Deploy:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

**Note**: Heroku no longer offers free tier, but provides $5 credit for new accounts.

---

## 🎨 Frontend Deployment

### Option 1: Netlify (RECOMMENDED - Easiest)

**Steps:**

1. **Build Your Frontend**
   ```bash
   cd Frontend/frontend
   npm install
   npm run build
   ```

2. **Deploy via Drag & Drop** (Easiest)
   - Go to https://app.netlify.com/drop
   - Drag the `Frontend/frontend/dist` folder
   - Your site is live!

3. **Or Deploy via GitHub** (Better for updates)
   - Sign up at https://netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect GitHub and select your repo
   - Configure build settings:
     ```
     Base directory: Frontend/frontend
     Build command: npm run build
     Publish directory: Frontend/frontend/dist
     ```
   - Add environment variables:
     ```
     VITE_SUPABASE_URL=https://vqslnjuewhbqonbfpfjb.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxc2xuanVld2hicW9uYmZwZmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODczNjgsImV4cCI6MjA4MTY2MzM2OH0.QKne1OckclAcTlUdu0n9nN3xQyUM7lqFzX-JXcdcqos
     ```
   - Click "Deploy site"

4. **Update Backend URL**
   After deploying backend, update your frontend API calls. Create `.env.production`:
   ```bash
   VITE_BACKEND_URL=https://pathfinder-pro-backend.onrender.com
   ```

---

### Option 2: Vercel

**Steps:**

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd Frontend/frontend
   vercel
   ```

3. Follow prompts:
   - Set framework to Vite
   - Build command: `npm run build`
   - Output directory: `dist`

4. Link to backend by updating API calls in your code.

---

### Option 3: GitHub Pages

**Steps:**

1. Install gh-pages:
   ```bash
   cd Frontend/frontend
   npm install --save-dev gh-pages
   ```

2. Add to `package.json`:
   ```json
   {
     "homepage": "https://yourusername.github.io/pathfinder-pro",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. Update `vite.config.js`:
   ```javascript
   export default defineConfig({
     base: '/pathfinder-pro/',
     plugins: [react()],
   })
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

---

## 🔑 Environment Variables

### Backend (.env)
```env
GOOGLE_API_KEY=AIzaSyAEeoKJWSFHczC154P3V_VjDwHH3nGy0o8
SUPABASE_URL=https://vqslnjuewhbqonbfpfjb.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxc2xuanVld2hicW9uYmZwZmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODczNjgsImV4cCI6MjA4MTY2MzM2OH0.QKne1OckclAcTlUdu0n9nN3xQyUM7lqFzX-JXcdcqos
JSEARCH_API_KEY=7f7148bf4amshf30da1151d49697p13f75ajsn33f28c1acde9
SEARCHAPI_KEY=3X1FJ4ZULzH5zewC4Vsm1DVy
```

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://vqslnjuewhbqonbfpfjb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxc2xuanVld2hicW9uYmZwZmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODczNjgsImV4cCI6MjA4MTY2MzM2OH0.QKne1OckclAcTlUdu0n9nN3xQyUM7lqFzX-JXcdcqos
VITE_BACKEND_URL=http://localhost:8000  # Change this to your deployed backend URL
```

---

## 🔗 Connect Frontend to Backend

After deploying both, update your frontend API configuration.

**Option 1: Environment Variable**
Create `.env.production`:
```env
VITE_BACKEND_URL=https://pathfinder-pro-backend.onrender.com
```

**Option 2: Update api.js directly**
Edit `Frontend/src/api.js`:
```javascript
const API_BASE_URL = 'https://pathfinder-pro-backend.onrender.com';
// Instead of http://localhost:8000
```

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: "Module not found" errors
```bash
# Solution: Ensure all dependencies are installed
cd backend
pip install -r requirements.txt
```

**Problem**: CORS errors
```python
# Already configured in main.py - check allow_origins includes your frontend URL
```

**Problem**: Port binding errors
```python
# Use --host 0.0.0.0 --port $PORT
# Render automatically sets $PORT environment variable
```

**Problem**: Slow first load on Render
```
# Normal for free tier - service spins down after 15 min
# Consider upgrading to paid plan for always-on service
```

---

### Frontend Issues

**Problem**: White screen after deployment
```bash
# Check browser console for errors
# Usually caused by wrong API base URL
# Update VITE_BACKEND_URL in .env.production
```

**Problem**: 404 on refresh
```toml
# Already fixed in netlify.toml with redirects
# For Vercel, check vercel.json rewrites configuration
```

**Problem**: Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend is accessible at your Render URL
- [ ] Frontend is accessible at your Netlify/Vercel URL
- [ ] Frontend can call backend API (check network tab)
- [ ] Supabase authentication works
- [ ] Job search API returns results
- [ ] Google Gemini AI responses work
- [ ] All pages load without errors
- [ ] Mobile responsive design works

---

## 🎯 Quick Test Commands

### Test Backend Locally
```bash
cd backend
uvicorn main:app --reload
# Visit: http://localhost:8000/docs
```

### Test Frontend Locally
```bash
cd Frontend/frontend
npm run dev
# Visit: http://localhost:5173
```

### Test Production Build
```bash
cd Frontend/frontend
npm run build
npm run preview
```

---

## 📊 Free Tier Limits

| Service      | Free Tier Limit                          |
|--------------|------------------------------------------|
| Render       | 750 hours/month, spins down after 15 min |
| Netlify      | 100GB bandwidth/month                    |
| Vercel       | Unlimited deployments, 100GB bandwidth   |
| Supabase     | 500MB database, 50K monthly active users |
| Google Gemini| 60 requests/minute (free tier)           |

---

## 🎉 Success!

Your PathFinder Pro is now live and ready to help users discover their dream careers!

**Share your links:**
- Frontend: `https://your-app.netlify.app`
- Backend: `https://pathfinder-pro-backend.onrender.com`

---

## 📞 Support

If you encounter issues:
1. Check deployment logs on your hosting platform
2. Verify all environment variables are set correctly
3. Test backend endpoints at `/docs` route
4. Check browser console for frontend errors

Good luck with your career guidance platform! 🚀
