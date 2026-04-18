# Cascade AI Engine - ML Model

This is the machine learning backend for the Cascade AI system, exposing LSTM predictions and physics-based simulations via FastAPI.

## Deployment to Hugging Face Spaces

### Prerequisites

- Hugging Face account
- Git installed

### Deployment Steps

1. **Create a new Space on Hugging Face:**
   - Go to [huggingface.co/spaces](https://huggingface.co/spaces)
   - Click "Create new Space"
   - Fill in:
     - Space name: `cascade-ai-engine`
     - SDK: Docker
     - Visibility: Public

2. **Clone the Space repository:**

   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/cascade-ai-engine
   cd cascade-ai-engine
   ```

3. **Copy files from this directory:**

   ```bash
   cp /path/to/cascade/hf_model/* .
   ```

4. **Commit and push:**

   ```bash
   git add .
   git commit -m "Add Cascade AI Engine"
   git push
   ```

5. **Wait for deployment** (2-5 minutes)

### Accessing the Model

Once deployed, the API will be available at:

```
https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

### API Endpoints

- **Health Check:**

  ```
  GET /
  ```

  Returns: `{"status": "ok", "service": "cascade_ai_engine"}`

- **Physics Simulation:**

  ```
  GET /api/simulate?days=10
  ```

  Parameters:
  - `days` (int): Number of days to simulate (1-30)

- **LSTM Prediction:**
  ```
  POST /api/predict_lstm
  ```
  Request body:
  ```json
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

## Local Testing

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 7860
```

### Test Endpoints

```bash
# Health check
curl http://localhost:7860/

# Simulate
curl "http://localhost:7860/api/simulate?days=10"

# LSTM prediction
curl -X POST http://localhost:7860/api/predict_lstm \
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

## File Structure

- `main.py` - FastAPI application with API endpoints
- `lstm_predictor.py` - LSTM model implementation
- `api_runner.py` - Simulation runner
- `simulation.py` - Physics simulation logic
- `requirements.txt` - Python dependencies
- `Dockerfile` - Docker configuration for HF Spaces

## Dependencies

See `requirements.txt` for the complete list. Key dependencies:

- FastAPI - Web framework
- Uvicorn - ASGI server
- PyTorch - Deep learning framework
- Pandas - Data manipulation
- NumPy - Numerical computing

## Architecture

```
FastAPI Server (port 7860)
├── Health Check Endpoint
├── Simulation API
│   └── Calls api_runner.py for physics simulation
└── LSTM Prediction API
    └── Uses ResidualLSTMModel for inference
```

## Notes

- CORS is enabled for all origins (`*`) to allow API consumption
- Model automatically loads and initializes on startup
- All responses are in JSON format

## Troubleshooting

**Port already in use:**

```bash
lsof -i :7860
kill -9 <PID>
```

**Module not found:**
Ensure all files are in the same directory and dependencies are installed:

```bash
pip install -r requirements.txt --upgrade
```

**CORS errors:**
Check that the client URL is allowed in `main.py` CORSMiddleware configuration.
