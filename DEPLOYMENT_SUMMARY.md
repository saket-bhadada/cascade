# Cascade AI - Complete Deployment Summary

## What's Been Set Up

Your Cascade AI application is now configured for production deployment across three platforms:

### ✅ Frontend (React + Vite) → Vercel

- **Status:** Ready to deploy
- **Files Created:**
  - `client/vercel.json` - Vercel build configuration
  - `client/.env.local` - Environment variables for local/production
  - `VERCEL_DEPLOYMENT.md` - Detailed Vercel guide

### ✅ Backend (Node.js + Express) → Koyeb

- **Status:** Ready to deploy
- **Files Created:**
  - `server/package.json` - Updated with start script
  - `koyeb.yaml` - Koyeb deployment configuration
  - `KOYEB_DEPLOYMENT.md` - Detailed Koyeb guide

### ✅ Python Model (FastAPI) → Hugging Face Spaces

- **Status:** Ready to deploy
- **Files Created:**
  - `hf_model/Dockerfile` - Docker configuration
  - `hf_model/README.md` - HF Space documentation
  - Updated existing: `requirements.txt`, `main.py`

### ✅ API Integration

- **Status:** Fully configured
- **Files Created:**
  - `API_INTEGRATION.md` - API endpoint documentation
  - Backend already configured to proxy HF Model API

---

## Architecture

```
                    Vercel (Frontend)
                           ↓
    https://cascade-frontend.vercel.app
                           ↓
                  Koyeb (Backend API)
                           ↓
    https://cascade-backend-xxx.koyeb.app
                           ↓
            Hugging Face (ML Model API)
                           ↓
    https://username-cascade-ai-engine.hf.space
```

---

## Deployment Timeline

### Day 1: Deploy Python Model to Hugging Face

1. Create Hugging Face account
2. Create new Space (Docker)
3. Push `hf_model/` directory
4. Wait 2-5 minutes for build
5. Get your Space URL: `https://YOUR_USERNAME-cascade-ai-engine.hf.space`

**Time: ~10 minutes**

### Day 2: Deploy Backend to Koyeb

1. Create Koyeb account
2. Connect GitHub repository
3. Set environment variables (including HF Space URL from Day 1)
4. Deploy
5. Get your backend URL: `https://cascade-backend-YOUR_ID.koyeb.app`

**Time: ~5 minutes**

### Day 3: Deploy Frontend to Vercel

1. Create Vercel account
2. Import GitHub repository
3. Set `VITE_API_URL` to backend URL from Day 2
4. Deploy
5. Get your frontend URL: `https://cascade-frontend.vercel.app`

**Time: ~2 minutes**

---

## Key Configuration Files

### 1. Frontend Build Config

**File:** `client/vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "Backend API endpoint"
  }
}
```

### 2. Backend Configuration

**File:** `server/package.json`

```json
{
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2"
  }
}
```

**File:** `server/server.js` (already configured)

- Proxies `/api/simulate` → HF Model
- Proxies `/api/predict_lstm` → HF Model
- Serves frontend static files
- Handles admin notifications

### 3. Backend Koyeb Config

**File:** `koyeb.yaml`

```yaml
services:
  - name: cascade-backend
    git:
      repository: https://github.com/YOUR_USERNAME/cascade
      buildpack: node
    env:
      - key: PORT
        value: "3001"
      - key: HF_MODEL_URL
        value: https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

### 4. Model Docker Config

**File:** `hf_model/Dockerfile`

```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN pip install -r requirements.txt
COPY . .
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

---

## Environment Variables

### Koyeb Backend (.env or Dashboard)

```bash
PORT=3001
NODE_ENV=production
HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

### Vercel Frontend (.env or Dashboard)

```bash
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

### Hugging Face Spaces

- No configuration needed
- Automatically exposed at port 7860

---

## API Endpoints

Once deployed, your application exposes these endpoints:

### Backend API (Koyeb)

```
GET  https://cascade-backend.koyeb.app/api/health
GET  https://cascade-backend.koyeb.app/api/simulate?days=10
POST https://cascade-backend.koyeb.app/api/predict_lstm
POST https://cascade-backend.koyeb.app/api/notify_admin
GET  https://cascade-backend.koyeb.app/  (serves frontend)
```

### Model API (HF Spaces)

```
GET  https://username-cascade-ai-engine.hf.space/
GET  https://username-cascade-ai-engine.hf.space/api/simulate?days=10
POST https://username-cascade-ai-engine.hf.space/api/predict_lstm
```

---

## Testing Your Deployment

### 1. Test HF Model

```bash
curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/
# Should return: {"status": "ok", "service": "cascade_ai_engine"}
```

### 2. Test Backend Health

```bash
curl https://cascade-backend-YOUR_ID.koyeb.app/api/health
# Should return: {"status": "ok"}
```

### 3. Test Full Integration

```bash
curl "https://cascade-backend-YOUR_ID.koyeb.app/api/simulate?days=10"
# Should return simulation data from HF Model
```

### 4. Test Frontend

- Open `https://cascade-frontend.vercel.app`
- Check Network tab (F12) for successful API calls
- Try each feature (simulation, predictions, etc.)

---

## Documentation Files

All these documents are in your project root:

| File                   | Purpose                                |
| ---------------------- | -------------------------------------- |
| `QUICK_START.md`       | **Start here** - Quick reference guide |
| `DEPLOYMENT.md`        | Complete step-by-step deployment guide |
| `VERCEL_DEPLOYMENT.md` | Detailed Vercel frontend instructions  |
| `KOYEB_DEPLOYMENT.md`  | Detailed Koyeb backend instructions    |
| `API_INTEGRATION.md`   | Backend ↔ HF Model integration details |
| `.env.example`         | Template environment variables         |
| `deploy-setup.sh`      | Automatic setup script (Linux/Mac)     |
| `deploy-setup.bat`     | Automatic setup script (Windows)       |

---

## Next Steps

### Before Deploying

- [ ] Read `QUICK_START.md`
- [ ] Ensure GitHub repo is public or accessible
- [ ] Create accounts (HuggingFace, Koyeb, Vercel)
- [ ] Review environment variable requirements

### During Deployment

- [ ] Follow deployment timeline (HF → Koyeb → Vercel)
- [ ] Note URLs from each platform
- [ ] Test each service individually
- [ ] Test API integration

### After Deployment

- [ ] Set up monitoring in each platform
- [ ] Configure custom domains (optional)
- [ ] Set up CI/CD for auto-deploys
- [ ] Monitor logs and performance

---

## Troubleshooting

### Common Issues

**Frontend can't reach backend:**

- Check `VITE_API_URL` is set correctly
- Verify backend service is running on Koyeb
- Test backend URL directly in browser

**Backend can't reach HF Model:**

- Verify `HF_MODEL_URL` is correct
- Test HF Space URL directly in browser
- Check HF Space is public
- Review backend logs on Koyeb

**Build fails on Vercel:**

- Run `npm run build` locally to test
- Check `package.json` has all dependencies
- Verify `vercel.json` configuration

**API returns 404:**

- Confirm backend is serving frontend static files
- Check correct endpoint is being called
- Review backend logs

See individual deployment docs for detailed troubleshooting.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet Users                          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │   Vercel CDN (Frontend) │
        │  cascade-frontend       │
        │  .vercel.app            │
        └────────────┬────────────┘
                     │ HTTPS
                     │
        ┌────────────▼─────────────┐
        │  Koyeb (Backend API)     │
        │  cascade-backend         │
        │  .koyeb.app              │
        └────────────┬─────────────┘
                     │ HTTPS
                     │
        ┌────────────▼──────────────────────┐
        │  HF Spaces (ML Model)              │
        │  username-cascade-ai-engine        │
        │  .hf.space                         │
        └────────────────────────────────────┘
```

---

## Cost Summary

| Platform      | Free Tier                     | Price             |
| ------------- | ----------------------------- | ----------------- |
| **Vercel**    | 100GB bandwidth/month         | $20+/month (Pro)  |
| **Koyeb**     | 1 instance, limited bandwidth | $12+/month        |
| **HF Spaces** | Free                          | Upgrade available |
| **Total**     | Free-tier works!              | ~$32+/month (Pro) |

All three platforms have generous free tiers suitable for testing and small-scale production.

---

## Support & Resources

- **Hugging Face:** https://huggingface.co/docs
- **Koyeb:** https://docs.koyeb.com
- **Vercel:** https://vercel.com/docs
- **FastAPI:** https://fastapi.tiangolo.com
- **Express.js:** https://expressjs.com
- **React:** https://react.dev

---

## What's Included

✅ **Frontend Ready**

- React + Vite build optimized
- Environment variables configured
- CORS-ready for API calls

✅ **Backend Ready**

- Express server configured
- API proxy to HF Model
- Error handling and logging
- Static file serving

✅ **Model Ready**

- FastAPI endpoints exposed
- Docker containerized
- CORS enabled for API access
- Requirements configured

✅ **Documentation Complete**

- Step-by-step guides
- Troubleshooting sections
- Configuration examples
- Testing procedures

---

## Questions?

Refer to the specific deployment guide for your platform:

- Frontend issues? → `VERCEL_DEPLOYMENT.md`
- Backend issues? → `KOYEB_DEPLOYMENT.md`
- Model issues? → `hf_model/README.md`
- Integration issues? → `API_INTEGRATION.md`
- Quick reference? → `QUICK_START.md`

Good luck with your deployment! 🚀
