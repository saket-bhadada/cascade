# Cascade AI Deployment Guide

This guide covers deploying the Cascade AI multi-tier application across three platforms:

- **Frontend**: Vercel (React + Vite)
- **Backend**: Koyeb (Node.js + Express)
- **ML Model**: Hugging Face Spaces (FastAPI)

---

## 1. Deploy Python Model to Hugging Face Spaces

### Step 1: Create a new Space on Hugging Face

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click **"Create new Space"**
3. Fill in details:
   - **Space name**: `cascade-ai-engine` (or your choice)
   - **License**: OpenRAIL
   - **Space SDK**: Docker
   - **Visibility**: Public or Private

### Step 2: Prepare files for HF Space

The following files should be in the `/hf_model` folder:

```
hf_model/
├── main.py              # FastAPI app with API endpoints
├── requirements.txt     # Python dependencies
├── lstm_predictor.py    # LSTM model implementation
├── api_runner.py        # Simulation script
├── simulation.py        # Simulation logic (if separate)
└── Dockerfile           # Docker configuration
```

### Step 3: Dockerfile for HF Space

Your `hf_model/Dockerfile` should look like this:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### Step 4: Push to Hugging Face

After creating the Space, clone the repo and push your code:

```bash
cd hf_model
git init
git add .
git commit -m "Initial commit"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/cascade-ai-engine
git push -u origin main
```

### Step 5: Get your HF Space URL

Once deployed, your model will be accessible at:

```
https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

**API Endpoints:**

- `GET /` - Health check
- `GET /api/simulate?days=10` - Run simulation
- `POST /api/predict_lstm` - LSTM prediction

---

## 2. Deploy Backend to Koyeb

### Step 1: Prepare backend for deployment

1. Ensure your `server/package.json` has a start script:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2"
  }
}
```

2. Add `.env` file (not committed):

```
PORT=3001
HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

### Step 2: Create koyeb.yaml (optional, for GitOps)

Create `koyeb.yaml` in the root directory:

```yaml
services:
  - name: cascade-backend
    git:
      repository: https://github.com/YOUR_USERNAME/cascade
      branch: main
    buildpack: node
    run:
      command: npm start
    env:
      - key: PORT
        value: "3001"
      - key: HF_MODEL_URL
        value: "${{ env.HF_MODEL_URL }}"
```

### Step 3: Deploy to Koyeb

**Option A: Via Koyeb Dashboard**

1. Go to [koyeb.com](https://koyeb.com)
2. Click **"Create Service"**
3. Connect your GitHub repository
4. Select the root directory (or `/server`)
5. Configure environment variables:
   - `PORT`: `3001`
   - `HF_MODEL_URL`: `https://YOUR_USERNAME-cascade-ai-engine.hf.space`
6. Deploy!

**Option B: Via CLI**

```bash
npm install -g @koyeb/cli
koyeb auth login
koyeb services create cascade-backend \
  --git cascade \
  --buildpack node \
  --env PORT=3001 \
  --env HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space \
  --env NODE_ENV=production
```

### Step 4: Get your Backend URL

Once deployed, your backend will be at:

```
https://cascade-backend-YOUR_ID.koyeb.app
```

---

## 3. Deploy Frontend to Vercel

### Step 1: Update API endpoint

Ensure your frontend's API calls point to the Koyeb backend. Update `client/src/App.jsx` or your API client:

```javascript
const API_BASE =
  import.meta.env.VITE_API_URL || "https://cascade-backend-YOUR_ID.koyeb.app";
```

### Step 2: Deploy to Vercel

**Option A: Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Select `client/` as root directory
5. Set environment variable:
   - `VITE_API_URL`: `https://cascade-backend-YOUR_ID.koyeb.app`
6. Deploy!

**Option B: Vercel CLI**

```bash
npm install -g vercel
cd client
vercel --env VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

### Step 3: Get your Frontend URL

Once deployed:

```
https://cascade-frontend.vercel.app
```

---

## Environment Variables Summary

### Frontend (Vercel)

```
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

### Backend (Koyeb)

```
PORT=3001
HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
NODE_ENV=production
```

### Python Model (HF Spaces)

- No env vars needed
- Automatically exposed at port 7860

---

## Testing the Deployment

Once all services are deployed:

1. **Test HF Model API:**

```bash
curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/
curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/api/simulate?days=10
```

2. **Test Backend API:**

```bash
curl https://cascade-backend-YOUR_ID.koyeb.app/api/health
```

3. **Visit Frontend:**

```
https://cascade-frontend.vercel.app
```

---

## Troubleshooting

### HF Model not responding

- Check HF Space logs: Go to Space settings → Logs
- Ensure `requirements.txt` has all dependencies
- Verify Dockerfile exposes port 7860

### Backend can't reach HF Model

- Verify `HF_MODEL_URL` environment variable is set correctly
- Check CORS headers in FastAPI app
- Test the HF URL manually to ensure it's accessible

### Frontend can't reach Backend

- Verify `VITE_API_URL` is set correctly
- Check browser console for CORS errors
- Ensure backend is listening on correct port

---

## Architecture Diagram

```
┌─────────────────────────┐
│   Vercel Frontend       │
│   (React + Vite)        │
└────────────┬────────────┘
             │ HTTPS
             ▼
┌─────────────────────────┐
│   Koyeb Backend         │
│   (Node.js + Express)   │
└────────────┬────────────┘
             │ HTTPS
             ▼
┌─────────────────────────┐
│   HF Spaces Model       │
│   (FastAPI)             │
└─────────────────────────┘
```

---

## Next Steps

1. Update API endpoints in frontend to use backend
2. Test cross-origin requests
3. Set up monitoring and logging
4. Configure custom domains if needed
5. Set up CI/CD for automatic deployments
