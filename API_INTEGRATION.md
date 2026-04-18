# API Integration Guide

## Backend to Hugging Face Model Integration

The backend server (`server/server.js`) is configured to proxy requests to the Hugging Face model API. This document explains how the integration works and how to test it.

### Architecture

```
Frontend (Vercel)
    ↓ HTTP/REST
Backend API (Koyeb)
    ↓ Proxy requests
HF Model API (Hugging Face Spaces)
```

### Configuration

The backend uses the `HF_MODEL_URL` environment variable to point to the deployed model:

```javascript
// In server/server.js
const HF_MODEL_URL = process.env.HF_MODEL_URL || "http://localhost:7860";
```

### API Endpoints

#### 1. Simulation Endpoint

**Frontend → Backend:**

```
GET /api/simulate?days=10
```

**Backend → HF Model:**

```
GET https://YOUR_USERNAME-cascade-ai-engine.hf.space/api/simulate?days=10
```

**Response:**

```json
{
  "simulation_data": { ... },
  "ticks": [ ... ]
}
```

#### 2. LSTM Prediction Endpoint

**Frontend → Backend:**

```
POST /api/predict_lstm
Content-Type: application/json

{
  "live_scan_rate": 50.0,
  "inbound_truck_eta": 6.0,
  "current_inventory": 75.0,
  "growth_multiplier": 1.2,
  "is_peak_window": false,
  "hist_t4": 60.0,
  "hist_t8": 65.0
}
```

**Backend → HF Model:**

```
POST https://YOUR_USERNAME-cascade-ai-engine.hf.space/api/predict_lstm
Content-Type: application/json

{
  "live_scan_rate": 50.0,
  ... (same body)
}
```

**Response:**

```json
{
  "t4": {
    "base": 60.0,
    "mean": 62.5,
    "volatility": 1.2,
    "final": 63.8,
    "breaker_tripped": false
  },
  "t8": {
    "base": 65.0,
    "mean": 67.2,
    "volatility": 1.5,
    "final": 68.9,
    "breaker_tripped": false
  }
}
```

#### 3. Admin Notification Endpoint

**Frontend → Backend:**

```
POST /api/notify_admin
Content-Type: application/json

{
  "urgency": "critical",
  "message": "System alert message",
  "source": "SmartTriage"
}
```

**Response:**

```json
{
  "status": "success",
  "delivered": true,
  "details": "Admin notified via external channel."
}
```

#### 4. Health Check

**Frontend → Backend:**

```
GET /api/health
```

**Response:**

```json
{
  "status": "ok"
}
```

### Error Handling

All errors from the HF model API are caught and returned as HTTP 500 errors:

```javascript
try {
  const response = await fetch(`${HF_MODEL_URL}/api/simulate?days=${days}`);
  if (!response.ok) throw new Error(`HF API responded with ${response.status}`);
  const data = await response.json();
  res.json(data);
} catch (err) {
  console.error("Simulation proxy error:", err.message);
  res.status(500).json({
    error: "Failed to fetch from Hugging Face model API",
    details: err.message,
  });
}
```

### Local Testing

#### 1. Start HF Model locally:

```bash
cd hf_model
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 7860
```

#### 2. In another terminal, start backend:

```bash
cd server
export HF_MODEL_URL=http://localhost:7860
npm install
npm start
```

#### 3. Test endpoints:

```bash
# Health check
curl http://localhost:3001/api/health

# Simulate
curl "http://localhost:3001/api/simulate?days=10"

# LSTM predict
curl -X POST http://localhost:3001/api/predict_lstm \
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

### Production Testing

Once deployed to Koyeb and HF:

```bash
# Test backend health
curl https://cascade-backend-YOUR_ID.koyeb.app/api/health

# Test through proxy
curl "https://cascade-backend-YOUR_ID.koyeb.app/api/simulate?days=10"

# Test LSTM
curl -X POST https://cascade-backend-YOUR_ID.koyeb.app/api/predict_lstm \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

### Frontend Integration

The frontend makes requests to `API` which points to the backend:

```javascript
// From client/src/App.jsx
const API = import.meta.env.PROD
  ? ""
  : import.meta.env.VITE_API_URL || "http://localhost:3001";

// In components:
const response = await fetch(`${API}/api/simulate?days=${days}`);
const data = await response.json();
```

### Troubleshooting

| Issue                        | Solution                                               |
| ---------------------------- | ------------------------------------------------------ |
| HF Model returns 404         | Check that HF_MODEL_URL is correct and Space is public |
| CORS errors                  | Ensure HF model has CORS middleware configured         |
| Connection timeout           | Verify network connectivity and firewall rules         |
| 500 error from backend       | Check backend logs and HF_MODEL_URL configuration      |
| Frontend can't reach backend | Verify VITE_API_URL environment variable               |

### Environment Variables Summary

**Koyeb Backend (.env):**

```
PORT=3001
NODE_ENV=production
HF_MODEL_URL=https://USERNAME-cascade-ai-engine.hf.space
```

**Vercel Frontend (.env.local):**

```
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

**HF Spaces:**

- No configuration needed
- API runs at: `https://USERNAME-cascade-ai-engine.hf.space`

### CORS Configuration

The backend enables CORS for all origins:

```javascript
app.use(cors());
```

The HF model also enables CORS:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This allows browser-based API calls from the frontend.
