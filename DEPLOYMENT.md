# 🚀 Befit Deployment Guide

This guide walks you through deploying Befit to GitHub, Render, and Netlify.

---

## Step 1: Initialize GitHub Repository

```bash
cd ~/projects/befit

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit: Befit wellness assistant"

# Create a new repository on GitHub at https://github.com/professordnyc/befit
# Then push:
git remote add origin https://github.com/professordnyc/befit.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

### 2a. Create Render Account & Connect GitHub
1. Go to https://render.com
2. Sign up or sign in
3. Click **"New +"** → **"Web Service"**
4. Select **"Connect a repository"** → choose your `befit` repo

### 2b. Configure Web Service
- **Name:** `befit-backend`
- **Environment:** `Python 3`
- **Build Command:** `uv sync --all-groups`
- **Start Command:** `uv run uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Plan:** Free (or paid for production)

### 2c. Set Environment Variables
In Render dashboard, go to **Environment** and add:

```env
BEFIT_ENV=production
OPENAI_API_KEY=your-openrouter-key-here
ELEVENLABS_API_KEY=your-elevenlabs-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
ALLOWED_ORIGINS=https://getbefit.netlify.app,https://your-custom-domain.com
```

### 2d. Deploy
Click **"Deploy"** and wait ~2–3 minutes. Your backend URL will be:
```
https://befit-backend-z9q1.onrender.com/
```

---

## Step 3: Deploy Frontend to Netlify

### 3a. Create Netlify Account & Connect GitHub
1. Go to https://netlify.com
2. Sign up or sign in
3. Click **"Add new site"** → **"Import an existing project"**
4. Choose **GitHub** → select `befit` repository

### 3b. Configure Build Settings
- **Base directory:** (leave empty)
- **Build command:** (leave empty — static site)
- **Publish directory:** `frontend`

### 3c. Set Environment Variables (Optional)
Go to **Site settings** → **Build & deploy** → **Environment**

```env
PUBLIC_API_BASE_URL=[https://befit-backend-z9q1.onrender.com](https://befit-backend-z9q1.onrender.com/)
PUBLIC_APP_BASE_URL=https://getbefit.netlify.app 
```

### 3d. Deploy
Netlify auto-deploys on push to `main`. Your frontend URL will be:
```
https://getbefit.netlify.app
```

Or use a custom domain:
- Buy a domain (GoDaddy, Namecheap, etc.)
- Point NS records to Netlify
- Add domain in Netlify dashboard

---

## Step 4: Set Up GitHub Actions (CI/CD)

### 4a. Configure GitHub Secrets
Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value | Where to Find |
|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL | Render dashboard → Web Service → Settings → Deploy Hook |
| `NETLIFY_BUILD_HOOK_URL` | Netlify build hook URL | Netlify → Site settings → Build & deploy → Build hooks (add when Netlify is set up) |

### 4b. Workflows
The following GitHub Actions run automatically:

- **tests.yml** (on every push):
  - Runs on Python 3.10, 3.11, 3.12
  - Lint with `ruff` and `black`
  - Run pytest tests
  - Generate coverage report

- **deploy.yml** (on push to `main`):
  - Trigger Render deployment
  - Trigger Netlify build

---

## Step 5: Verify Deployment

### Backend Health Check
```bash
curl https://befit-backend-z9q1.onrender.com/health
```

Expected response:
```json
{"status": "ok"}
```

### Test `/scan-and-plan` Endpoint
See [backend/README.md](backend/README.md) for API docs.

### Frontend
Open **https://getbefit.netlify.app** in your browser.

---

## Troubleshooting

### Backend won't start on Render
- Check build logs: Render dashboard → Service → Logs
- Ensure all environment variables are set
- Verify `uv` is installed: `uv sync` must complete successfully

### Frontend shows 404 or blank page
- Check Netlify build logs: Netlify → Deploys
- Verify `frontend` directory exists and contains `index.html`
- Clear browser cache

### CORS errors when calling the backend
- In `.env.example`, set `ALLOWED_ORIGINS` to include your Netlify domain
- Deploy backend with updated env var

### TTS not working
- Verify `ELEVENLABS_API_KEY` is set in Render environment
- Check browser console for errors
- WebSpeech fallback should activate if the key is missing

---

## Next Steps

1. **Configure custom domain** (optional)
   - Purchase domain
   - Point to Netlify (frontend)
   - Update CORS in backend

2. **Add monitoring & logs**
   - Render: View logs in dashboard
   - Netlify: View build logs
   - Consider: Sentry, DataDog, or CloudWatch for errors

3. **Set up database** (optional, for future features)
   - Render offers free Postgres
   - Update `DATABASE_URL` in environment

4. **Enable auto-scaling** (paid plans)
   - Render: Upgrade to Standard plan
   - Netlify: Pro plan for analytics

---

## Support
- [Render docs](https://render.com/docs)
- [Netlify docs](https://docs.netlify.com)
- [Befit docs](./AGENTS.md)
