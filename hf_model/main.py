from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import subprocess
import json
import torch

# Import the existing ML components
from lstm_predictor import ResidualLSTMModel, predict_with_confidence

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since it's an API, allow all to consume it
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok", "service": "cascade_ai_engine"}

@app.get("/api/simulate")
def simulate(days: int = 10):
    """ Runs the physics-engine simulation and returns JSON """
    try:
        # Run api_runner.py directly to execute simulation
        output = subprocess.check_output(["python", "api_runner.py", str(days)], text=True)
        return json.loads(output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LstmQuery(BaseModel):
    live_scan_rate: float = 50.0
    inbound_truck_eta: float = 6.0
    current_inventory: float = 75.0
    growth_multiplier: float = 1.2
    is_peak_window: bool = False
    hist_t4: float = 60.0
    hist_t8: float = 65.0

@app.post("/api/predict_lstm")
def predict_lstm(query: LstmQuery):
    """ Runs PyTorch LSTM prediction """
    try:
        seq_data = torch.rand(1, 24, 5, dtype=torch.float32) * 0.1
        f_live = query.live_scan_rate / 100.0
        f_eta = query.inbound_truck_eta / 12.0
        f_inv = query.current_inventory / 100.0
        f_growth = query.growth_multiplier - 1.0
        f_peak = 1.0 if query.is_peak_window else 0.0
        
        seq_data[0, -1, :] = torch.tensor([f_live, f_eta, f_inv, f_growth, f_peak], dtype=torch.float32)
        hist_data = torch.tensor([[query.hist_t4, query.hist_t8]], dtype=torch.float32)
        
        model = ResidualLSTMModel(num_features=5)
        # 1.5 uncertainty threshold just like in original code
        final_p, mean_p, std_p = predict_with_confidence(model, seq_data, hist_data, n_iter=25, uncertainty_threshold=1.5)
        
        return {
            "t4": {
                "base": float(hist_data[0,0]),
                "mean": float(mean_p[0,0]),
                "volatility": float(std_p[0,0]),
                "final": float(final_p[0,0]),
                "breaker_tripped": bool(std_p[0,0] > 1.5)
            },
            "t8": {
                "base": float(hist_data[0,1]),
                "mean": float(mean_p[0,1]),
                "volatility": float(std_p[0,1]),
                "final": float(final_p[0,1]),
                "breaker_tripped": bool(std_p[0,1] > 1.5)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
