# Cascade AI - Deployment Checklist

Use this checklist to track your deployment progress step by step.

## Pre-Deployment Setup

### Accounts & Prerequisites

- [ ] Created GitHub account (repository is public or accessible)
- [ ] Created Hugging Face account (huggingface.co)
- [ ] Created Koyeb account (koyeb.com)
- [ ] Created Vercel account (vercel.com)
- [ ] Cloned/have access to cascade repository on GitHub

### Local Setup

- [ ] Node.js installed (v16+)
- [ ] Python installed (v3.10+)
- [ ] Git configured
- [ ] Read `QUICK_START.md`
- [ ] Read deployment guide for your platform

---

## Phase 1: Deploy Python Model to Hugging Face

**Timeline: ~10 minutes**

### HF Space Creation

- [ ] Go to https://huggingface.co/spaces/create
- [ ] Clicked "Create new Space"
- [ ] Filled in:
  - [ ] Space name: `cascade-ai-engine`
  - [ ] License: OpenRAIL
  - [ ] Space SDK: **Docker** (not Gradio or Streamlit!)
  - [ ] Visibility: Public

### Push Model Code

- [ ] Cloned HF Space repository
  ```bash
  git clone https://huggingface.co/spaces/YOUR_USERNAME/cascade-ai-engine
  cd cascade-ai-engine
  ```
- [ ] Copied files from `hf_model/`:
  - [ ] `main.py`
  - [ ] `lstm_predictor.py`
  - [ ] `api_runner.py`
  - [ ] `simulation.py`
  - [ ] `requirements.txt`
  - [ ] `Dockerfile`
- [ ] Committed and pushed:
  ```bash
  git add .
  git commit -m "Initial Cascade AI Engine deployment"
  git push
  ```

### Verification

- [ ] Waited 2-5 minutes for build
- [ ] Space shows "Running" status
- [ ] Tested health endpoint:
  ```bash
  curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/
  ```
- [ ] Should return: `{"status": "ok", "service": "cascade_ai_engine"}`

### Record URLs

- [ ] HF Space URL: `https://YOUR_USERNAME-cascade-ai-engine.hf.space`
  - Save this for Step 2!

---

## Phase 2: Deploy Backend to Koyeb

**Timeline: ~5 minutes**

### Koyeb Service Creation

- [ ] Went to https://koyeb.com
- [ ] Clicked "Create Service"
- [ ] Selected GitHub and authenticated
- [ ] Chose repository: `cascade`
- [ ] Set configuration:
  - [ ] Buildpack: `Node`
  - [ ] Build directory: `server`
  - [ ] Run command: `npm start`

### Environment Variables

- [ ] Added environment variable:
  ```
  PORT=3001
  ```

  - [ ] Clicked "Add"
- [ ] Added:
  ```
  NODE_ENV=production
  ```

  - [ ] Clicked "Add"
- [ ] Added:
  ```
  HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
  ```
  (Use the URL from Phase 1!)
  - [ ] Clicked "Add"

### Service Creation

- [ ] Set service name: `cascade-backend`
- [ ] Selected instance type: Free (or Standard)
- [ ] Clicked "Create Service"
- [ ] Waited for deployment (2-5 minutes)
- [ ] Status shows "Running" ✓

### Verification

- [ ] Got service URL: `https://cascade-backend-YOUR_ID.koyeb.app`
- [ ] Tested health endpoint:
  ```bash
  curl https://cascade-backend-YOUR_ID.koyeb.app/api/health
  ```
- [ ] Should return: `{"status": "ok"}`

### Record URLs

- [ ] Koyeb Backend URL: `https://cascade-backend-YOUR_ID.koyeb.app`
  - Save this for Step 3!

---

## Phase 3: Deploy Frontend to Vercel

**Timeline: ~2-3 minutes**

### Vercel Project Creation

- [ ] Went to https://vercel.com
- [ ] Clicked "Add New" → "Project"
- [ ] Clicked "Import Git Repository"
- [ ] Selected GitHub account
- [ ] Selected repository: `cascade`
- [ ] Set configuration:
  - [ ] Framework Preset: `Vite`
  - [ ] Root Directory: `./client`
  - [ ] Build Command: `npm run build` (auto-detected ✓)
  - [ ] Output Directory: `dist` (auto-detected ✓)
  - [ ] Install Command: `npm install` (auto-detected ✓)

### Environment Variables

- [ ] Clicked "Environment" section
- [ ] Added environment variable:
  ```
  VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
  ```
  (Use the URL from Phase 2!)
- [ ] Clicked "Add"

### Deployment

- [ ] Reviewed settings
- [ ] Clicked "Deploy"
- [ ] Waited for build (~1-2 minutes)
- [ ] Deployment complete ✓

### Verification

- [ ] Got frontend URL: `https://cascade-frontend.vercel.app`
- [ ] Opened in browser
- [ ] Checked that page loaded (not blank)
- [ ] Opened Developer Tools (F12)
- [ ] Checked Network tab for successful API calls
- [ ] Clicked through main features:
  - [ ] SmartTriage loads
  - [ ] PreDepartureSimulator loads
  - [ ] LstmPredictor loads
  - [ ] ControlTower loads

---

## Integration Testing

### Test Each Endpoint

- [ ] Health check:

  ```bash
  curl https://cascade-backend-YOUR_ID.koyeb.app/api/health
  ```

  Expected: `{"status": "ok"}`

- [ ] Simulation:

  ```bash
  curl "https://cascade-backend-YOUR_ID.koyeb.app/api/simulate?days=5"
  ```

  Expected: JSON with simulation data

- [ ] LSTM Prediction:
  ```bash
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
  Expected: JSON with T4 and T8 predictions

### Frontend Integration

- [ ] Visit: `https://cascade-frontend.vercel.app`
- [ ] Run a simulation in SmartTriage
- [ ] Check browser Network tab (F12) for successful requests
- [ ] Verify no CORS errors
- [ ] Verify no 500 errors
- [ ] Try LSTM prediction with sample data
- [ ] Verify all visualizations load

---

## Post-Deployment

### Monitoring Setup

- [ ] Set up Koyeb monitoring:
  - [ ] Bookmarked service URL
  - [ ] Enabled email alerts
- [ ] Set up Vercel monitoring:
  - [ ] Bookmarked project URL
  - [ ] Checked Analytics dashboard
- [ ] Set up HF monitoring:
  - [ ] Bookmarked Space URL
  - [ ] Checked Space settings

### Update Documentation

- [ ] Updated team with deployed URLs
- [ ] Updated API documentation with live URLs
- [ ] Documented any customizations made

### Optional Enhancements

- [ ] Set up custom domain for frontend
- [ ] Set up custom domain for backend
- [ ] Configure auto-deploy on git push
- [ ] Set up monitoring/alerts
- [ ] Configure error logging (Sentry, DataDog, etc.)
- [ ] Add rate limiting to backend

---

## Troubleshooting Checklist

If something doesn't work, check:

### HF Model Issues

- [ ] Space shows "Running" status
- [ ] Viewed Space logs for errors
- [ ] Dockerfile is correct
- [ ] requirements.txt has all packages
- [ ] main.py has FastAPI app
- [ ] Tested endpoint directly in browser

### Backend Issues

- [ ] `server/package.json` has `start` script
- [ ] `npm start` works locally
- [ ] Environment variables are set in Koyeb dashboard
- [ ] `HF_MODEL_URL` is correct
- [ ] Viewed Koyeb logs: `koyeb services logs cascade-backend`
- [ ] Tested `/api/health` endpoint

### Frontend Issues

- [ ] `client/package.json` is correct
- [ ] `npm run build` works locally
- [ ] `VITE_API_URL` environment variable is set
- [ ] `VITE_API_URL` exactly matches backend URL
- [ ] Cleared browser cache (Ctrl+Shift+Delete)
- [ ] Checked browser console for errors (F12)
- [ ] Checked Network tab for failed requests

### API Integration Issues

- [ ] Both backend and HF are running
- [ ] CORS is enabled on both services
- [ ] URLs are correct and don't have typos
- [ ] Testing with `curl` to isolate issues
- [ ] Checking logs on both services

---

## Success Criteria

✅ **All done when:**

- [ ] Frontend loads at Vercel URL (no blank page)
- [ ] All navigation links work
- [ ] `/api/health` returns `{"status": "ok"}`
- [ ] `/api/simulate?days=5` returns simulation data
- [ ] `/api/predict_lstm` returns predictions
- [ ] Admin notifications work
- [ ] No CORS errors in browser console
- [ ] No 500 errors in backend logs
- [ ] Frontend features display correctly
- [ ] Real-time updates work if applicable

---

## Quick Reference URLs

Once deployed, save these:

```
Frontend (Vercel):    https://cascade-frontend.vercel.app
Backend (Koyeb):      https://cascade-backend-YOUR_ID.koyeb.app
Model (HF Spaces):    https://YOUR_USERNAME-cascade-ai-engine.hf.space

HF Space Admin:       https://huggingface.co/spaces/YOUR_USERNAME/cascade-ai-engine
Koyeb Dashboard:      https://koyeb.com/app/services
Vercel Dashboard:     https://vercel.com/dashboard
```

---

## Support Resources

Stuck? Check these first:

1. `QUICK_START.md` - Quick reference guide
2. `DEPLOYMENT_SUMMARY.md` - Overview and architecture
3. Platform-specific guides:
   - `VERCEL_DEPLOYMENT.md` - Frontend troubleshooting
   - `KOYEB_DEPLOYMENT.md` - Backend troubleshooting
   - `hf_model/README.md` - Model troubleshooting
4. `API_INTEGRATION.md` - API endpoint documentation

---

## Notes

Use this space to track your progress and any issues:

```
Date:        _______________
Issue:       _______________
Resolution:  _______________

Date:        _______________
Issue:       _______________
Resolution:  _______________
```

---

**Last Updated:** April 18, 2026
**Version:** 1.0
