import torch
import torch.nn as nn
import numpy as np

class ResidualLSTMModel(nn.Module):
    """
    Seasonal-Aware LSTM built with PyTorch.
    Uses a Residual Learning approach to predict deviation from an established historical baseline.
    """
    def __init__(self, num_features=5, hidden_size=64, dropout_rate=0.25):
        super(ResidualLSTMModel, self).__init__()
        
        # 1. LSTM Feature Extractor
        # batch_first=True aligns shape to [Batch_Size, Time_Steps, Features]
        self.lstm = nn.LSTM(input_size=num_features, hidden_size=hidden_size, batch_first=True)
        self.dropout1 = nn.Dropout(p=dropout_rate)
        
        # 2. Dense mixing block
        self.dense = nn.Linear(hidden_size, 32)
        self.relu_mixin = nn.ReLU()
        self.dropout2 = nn.Dropout(p=dropout_rate)
        
        # 3. Residual Deviation Output
        # Represents the +/- deviation against the historical norm
        self.deviation_layer = nn.Linear(32, 2)
        
        # 4. Final non-negative boundary constraint
        self.final_relu = nn.ReLU()

    def forward(self, sequence_input, historical_avg_input):
        # Forward pass through LSTM
        lstm_out, (hn, cn) = self.lstm(sequence_input)
        
        # We exclusively process the final hidden state produced at the end of the 24h sequence
        x = hn[-1] # shape: [Batch_Size, Hidden_Size]
        
        x = self.dropout1(x)
        x = self.dense(x)
        x = self.relu_mixin(x)
        x = self.dropout2(x)
        
        # Predict the +/- residual shift
        deviation = self.deviation_layer(x)
        
        # Add residual to the fixed calendar baseline
        out_raw = historical_avg_input + deviation
        
        # Enforce non-negative physics parameter for Capacity Occupancy
        final_output = self.final_relu(out_raw)
        
        return final_output


def predict_with_confidence(model, seq_data, hist_data, n_iter=50, uncertainty_threshold=2.0):
    """
    Implements Monte Carlo (MC) Dropout in PyTorch to quantify prediction volatility 
    and output a strictly safe capacity constraint.
    """
    # CRITICAL: Keeping model in train() mode forces nn.Dropout to stay active 
    # during inference. This is required to sample the mathematical variance.
    model.train() 
    
    predictions = []
    
    with torch.no_grad(): # Disable autograd engine to save memory/compute
        for _ in range(n_iter):
            preds = model(seq_data, hist_data)
            predictions.append(preds.cpu().numpy())
            
    predictions = np.array(predictions) # Shape: [n_iter, Batch_Size, 2]
    
    mean_preds = np.mean(predictions, axis=0) # [Batch_Size, 2]
    std_preds = np.std(predictions, axis=0)   # [Batch_Size, 2]
    
    final_predictions = np.copy(mean_preds)
    batch_size = seq_data.shape[0]
    
    for i in range(batch_size):
        for j in range(2): # 0 => T+4, 1 => T+8
            std_dev = std_preds[i, j]
            
            # Confidence Interval Upper Bound computation (Mean + 1.96 * Sigma)
            upper_bound = mean_preds[i, j] + (1.96 * std_dev)
            
            # THE LOGIC HINGE: 
            # Volatility breach overrides the target to absolute safe maximums
            if std_dev > uncertainty_threshold:
                final_predictions[i, j] = upper_bound
            else:
                final_predictions[i, j] = mean_preds[i, j]
                
    return final_predictions, mean_preds, std_preds


if __name__ == "__main__":
    import os
    import sys
    import json
    
    # Exposing Model via JSON CLI args for Express Node Integration
    if len(sys.argv) > 1:
        try:
            req = json.loads(sys.argv[1])
            seq_data = torch.rand(1, 24, 5, dtype=torch.float32) * 0.1 # Background rolling noise
            
            # Map frontend realtime parameters into the final sequence node
            f_live = req.get("live_scan_rate", 50.0) / 100.0
            f_eta = req.get("inbound_truck_eta", 6.0) / 12.0
            f_inv = req.get("current_inventory", 75.0) / 100.0
            f_growth = req.get("growth_multiplier", 1.2) - 1.0
            f_peak = 1.0 if req.get("is_peak_window", False) else 0.0
            
            seq_data[0, -1, :] = torch.tensor([f_live, f_eta, f_inv, f_growth, f_peak], dtype=torch.float32)
            
            hist_data = torch.tensor([[req.get("hist_t4", 60.0), req.get("hist_t8", 65.0)]], dtype=torch.float32)
            
            model = ResidualLSTMModel(num_features=5)
            final_p, mean_p, std_p = predict_with_confidence(model, seq_data, hist_data, n_iter=25, uncertainty_threshold=1.5)
            
            result = {
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
            print(json.dumps(result))
            sys.exit(0)
            
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
            
    else:
        print("Initialize PyTorch Seasonal-Aware LSTM Simulator...")
        
        # Sim Params
        batch_sz = 3  
        time_len = 24 
        num_feats = 5 
        
        # Build PyTorch Tensors for the integration mock
        dummy_seq = torch.rand(batch_sz, time_len, num_feats, dtype=torch.float32)
        dummy_hist = torch.tensor([[60.0, 65.0], [80.0, 82.0], [45.0, 50.0]], dtype=torch.float32)
        
        # Instantiate Model
        model = ResidualLSTMModel(num_features=num_feats)
        
        print("\nExecuting Forecast with PyTorch MC Dropout Logic...")
        final_preds, mean_preds, std_preds = predict_with_confidence(
            model, dummy_seq, dummy_hist, n_iter=25, uncertainty_threshold=1.5
        )
        
        for i in range(batch_sz):
            print(f"\n{'='*40}")
            print(f"HUB TEST ROUTE {i + 1}")
            print(f"Historical Base (T+4, T+8) : {dummy_hist[i,0].item():.1f}%, {dummy_hist[i,1].item():.1f}%")
            print(f"Live Mean LSTM Forecast    : {mean_preds[i,0]:.1f}%, {mean_preds[i,1]:.1f}%")
            
            circuit_t4 = "[WARN] BREAKER DEFAULTED TO UPPER BOUND" if std_preds[i,0] > 1.5 else "[PASS] Stable"
            circuit_t8 = "[WARN] BREAKER DEFAULTED TO UPPER BOUND" if std_preds[i,1] > 1.5 else "[PASS] Stable"
            
            print(f"Volatility [T+4: {std_preds[i,0]:.2f}]       : {circuit_t4}")
            print(f"Volatility [T+8: {std_preds[i,1]:.2f}]       : {circuit_t8}")
            print(f"--> FINAL AUTHORIZED METRIC: {final_preds[i,0]:.1f}%, {final_preds[i,1]:.1f}%")
        print("\nProcess Complete.")
