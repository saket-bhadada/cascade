# Cascade AI - Quick Deployment Reference

## Step-by-Step Deployment Order

### Phase 1: Hugging Face Model Deployment (Day 1)

```bash
# 1. Create HF Space
# Go to https://huggingface.co/spaces/create
# - Name: cascade-ai-engine
# - SDK: Docker
# - Visibility: Public

# 2. Push model code
cd hf_model
git clone https://huggingface.co/spaces/YOUR_USERNAME/cascade-ai-engine
# Copy files from hf_model/ to cloned directory
git add .
git commit -m "Initial commit"
git push

# 3. Wait for deployment (2-5 min)
# URL: https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

**Test:** `curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/`

---

### Phase 2: Koyeb Backend Deployment (Day 2)

```bash
# 1. Go to https://koyeb.com → Create Service
# 2. Select GitHub repository
# 3. Build directory: server
# 4. Environment variables:
#    PORT=3001
#    NODE_ENV=production
#    HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
# 5. Deploy!

# OR via CLI:
koyeb services create cascade-backend \
  --git YOUR_USERNAME/cascade \
  --git-branch main \
  --buildpack node \
  --git-working-dir server \
  --env PORT=3001 \
  --env NODE_ENV=production \
  --env HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

**Test:** `curl https://cascade-backend-YOUR_ID.koyeb.app/api/health`

---

### Phase 3: Vercel Frontend Deployment (Day 3)

```bash
# 1. Go to https://vercel.com → Add Project
# 2. Import GitHub repository
# 3. Root directory: client
# 4. Environment variable:
#    VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
# 5. Deploy!

# OR via CLI:
vercel --env VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

**Result:** `https://cascade-frontend.vercel.app`

---

## Environment Variables Cheat Sheet

### HF Spaces (Python Model)

```
No configuration needed!
API auto-runs on port 7860
```

### Koyeb Backend

```env
PORT=3001
NODE_ENV=production
HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

### Vercel Frontend

```env
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

---

## Deployment Checklist

- [ ] **HF Model Ready**
  - [ ] Account created at huggingface.co
  - [ ] Space created (cascade-ai-engine)
  - [ ] Code pushed to HF Space
  - [ ] Model API responds at `/`
  - [ ] Got HF Space URL

- [ ] **Backend Ready**
  - [ ] Account created at koyeb.com
  - [ ] Repository pushed to GitHub
  - [ ] `server/package.json` has start script
  - [ ] Environment variables configured
  - [ ] Service deployed
  - [ ] `/api/health` responds with `{"status": "ok"}`
  - [ ] Got Koyeb backend URL

- [ ] **Frontend Ready**
  - [ ] Account created at vercel.com
  - [ ] `VITE_API_URL` environment variable set
  - [ ] Deployed to Vercel
  - [ ] Accessing API endpoints successfully
  - [ ] Got Vercel frontend URL

---

## Testing Workflow

### 1. Test Each Service Individually

```bash
# Test HF Model
curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/

# Test Backend
curl https://cascade-backend-YOUR_ID.koyeb.app/api/health

# Visit Frontend
https://cascade-frontend.vercel.app
```

### 2. Test API Integration

```bash
# Via Backend proxy to HF Model
curl "https://cascade-backend-YOUR_ID.koyeb.app/api/simulate?days=5"

# LSTM Prediction
curl -X POST https://cascade-backend-YOUR_ID.koyeb.app/api/predict_lstm \
  -H "Content-Type: application/json" \
  -d '{
    "live_scan_rate": 50.0,
    "inbound_truck_eta": 6.0,
    "current_inventory": 75.0,
    "growth_multiplier": 1.2,
    "is_peak_window": false,
    "hist_t4": 60.0,
    "hist_t8": 65.0
  }'
```

### 3. Test Frontend Integration

- Open `https://cascade-frontend.vercel.app`
- Use browser developer tools (F12)
- Check Network tab for API calls
- Verify all features work

---

## Troubleshooting Guide

| Problem                 | Solution                                                  |
| ----------------------- | --------------------------------------------------------- |
| HF Space won't deploy   | Check Dockerfile, view Space logs                         |
| Backend can't reach HF  | Verify HF_MODEL_URL, test with curl                       |
| Frontend shows blank    | Check VITE_API_URL, browser console                       |
| 500 errors from backend | Check backend logs: `koyeb services logs cascade-backend` |
| CORS errors             | Ensure backend/frontend URLs match exactly                |
| Can't access endpoints  | Verify services are running, check firewall               |

---

## Post-Deployment

1. **Monitor Logs**
   - Koyeb: `koyeb services logs cascade-backend --follow`
   - Vercel: Dashboard → Deployments → View logs
   - HF: Space → Settings → Logs

2. **Set Up Custom Domain** (Optional)
   - Vercel: Project Settings → Domains
   - Koyeb: Service → Domains

3. **Configure CI/CD**
   - Automatic deploys on git push
   - Preview URLs for pull requests

4. **Performance Monitoring**
   - Vercel Analytics dashboard
   - Koyeb service metrics

---

## File Locations

```
cascade/
├── .env.example                    # Template for env vars
├── DEPLOYMENT.md                   # Full deployment guide
├── KOYEB_DEPLOYMENT.md            # Koyeb-specific guide
├── VERCEL_DEPLOYMENT.md           # Vercel-specific guide
├── API_INTEGRATION.md             # Backend↔HF integration
├── koyeb.yaml                      # Koyeb configuration
├── deploy-setup.sh                # Setup script (Linux/Mac)
├── deploy-setup.bat               # Setup script (Windows)
│
├── client/
│   ├── vercel.json                # Vercel configuration
│   ├── .env.local                 # Frontend env vars (local)
│   ├── package.json               # Frontend dependencies
│   └── vite.config.js             # Vite build config
│
├── server/
│   ├── server.js                  # Backend entry point
│   ├── package.json               # Backend dependencies
│   └── .env                       # Backend env vars (local)
│
└── hf_model/
    ├── main.py                    # FastAPI app
    ├── Dockerfile                 # Docker config
    ├── requirements.txt           # Python dependencies
    ├── lstm_predictor.py          # Model implementation
    ├── api_runner.py              # Simulation runner
    ├── README.md                  # HF Space readme
    └── simulation.py              # Simulation logic
```

---

## Success Indicators

✅ **All systems working when:**

- Frontend loads at Vercel URL
- Can call `/api/health` successfully
- Simulation returns data via `/api/simulate`
- LSTM prediction works via `/api/predict_lstm`
- Admin notifications trigger via `/api/notify_admin`
- No CORS errors in browser console
- No 500 errors in backend logs

---

## Support Resources

- [Hugging Face Docs](https://huggingface.co/docs)
- [Koyeb Docs](https://docs.koyeb.com)
- [Vercel Docs](https://vercel.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Express.js Docs](https://expressjs.com)
- [Vite Docs](https://vitejs.dev)
