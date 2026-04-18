import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './LstmPredictor.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LstmPredictor = () => {
  // Input States
  const [liveScanRate, setLiveScanRate] = useState(55); // %
  const [eta, setEta] = useState(4); // hours
  const [inventory, setInventory] = useState(70); // %
  const [growth, setGrowth] = useState(1.05); // multiplier
  const [isPeak, setIsPeak] = useState(true);
  
  const [histT4, setHistT4] = useState(62);
  const [histT8, setHistT8] = useState(65);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      live_scan_rate: Number(liveScanRate),
      inbound_truck_eta: Number(eta),
      current_inventory: Number(inventory),
      growth_multiplier: Number(growth),
      is_peak_window: isPeak,
      hist_t4: Number(histT4),
      hist_t8: Number(histT8)
    };

    try {
      const res = await fetch(`${API}/api/predict_lstm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch prediction");
      
      if (data.t4.breaker_tripped || data.t8.breaker_tripped) {
         toast('HIGH VOLATILITY: Forecast uncertainty breached. Max routing constraints engaged!', {
            icon: '⚡',
            style: { background: '#1e293b', color: '#f59e0b', border: '1px solid #f59e0b', fontWeight: 'bold' }
         });
         fetch(`${API}/api/notify_admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urgency: 'WARNING', source: 'LSTM PyTorch Engine', message: 'High volatility detected. Volatility confidence interval broken.' })
         }).catch(e => console.error(e));
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lstm-container">
      <div className="lstm-header">
        <div className="lstm-title">
           <h3>PyTorch Forecasting Engine</h3>
           <span className="ai-badge">LSTM + MC Dropout</span>
        </div>
        <p>Dynamic AI engine predicting future network congestion using real-time variable shifts vs historical averages.</p>
      </div>

      <div className="lstm-grid">
        {/* INPUTS PANEL */}
        <div className="lstm-inputs">
          <h4 className="panel-heading">Real-Time Feature Vector</h4>
          
          <div className="grid-2-col">
            <div className="input-group">
               <label>Live Scan Rate ({liveScanRate}%)</label>
               <input type="range" min="0" max="100" value={liveScanRate} onChange={e => setLiveScanRate(e.target.value)} />
            </div>
            <div className="input-group">
               <label>Avg Truck ETA ({eta} hrs)</label>
               <input type="range" min="0" max="12" step="0.5" value={eta} onChange={e => setEta(e.target.value)} />
            </div>
            <div className="input-group">
               <label>Current Inventory ({inventory}%)</label>
               <input type="range" min="0" max="100" value={inventory} onChange={e => setInventory(e.target.value)} />
            </div>
            <div className="input-group">
               <label>YoY Growth Multiplier ({Number(growth).toFixed(2)}x)</label>
               <input type="range" min="0.8" max="2.0" step="0.05" value={growth} onChange={e => setGrowth(e.target.value)} />
            </div>
          </div>

          <div className="input-group peak-toggle" onClick={() => setIsPeak(!isPeak)}>
             <label>📅 Peak Season Active (Oct 10-25)</label>
             <div className={`switch ${isPeak ? 'on' : 'off'}`}>
                <div className="knob"></div>
             </div>
          </div>

          <h4 className="panel-heading mt-4">Historical Base Constraints</h4>
          <div className="grid-2-col">
            <div className="input-group">
               <label>Historical Load &nbsp; T+4 ({histT4}%)</label>
               <input type="number" value={histT4} onChange={e => setHistT4(e.target.value)} />
            </div>
            <div className="input-group">
               <label>Historical Load &nbsp; T+8 ({histT8}%)</label>
               <input type="number" value={histT8} onChange={e => setHistT8(e.target.value)} />
            </div>
          </div>

          <button className="predict-btn" onClick={handlePredict} disabled={loading}>
            {loading ? <><span className="lstm-spinner"></span> Generating PyTorch Inference...</> : "Run Neural Prediction"}
          </button>
          {error && <div className="lstm-error">⚠ {error}</div>}
        </div>

        {/* RESULTS PANEL */}
        <div className="lstm-outputs">
          <h4 className="panel-heading">Forecast Horizon</h4>
          
          {!result && !loading && (
             <div className="lstm-awaiting">Awaiting Parameter Vector...</div>
          )}

          {result && !loading && (
            <div className="forecast-results">
               {[
                  { title: "T+4 Hours Outlook", data: result.t4 },
                  { title: "T+8 Hours Outlook", data: result.t8 }
               ].map((outlook, idx) => (
                 <div key={idx} className={`outlook-card ${outlook.data.breaker_tripped ? 'card-warn' : 'card-pass'}`}>
                    <div className="outlook-card-header">
                       <h5>{outlook.title}</h5>
                       <span className={`breaker-badge ${outlook.data.breaker_tripped ? 'tripped' : 'stable'}`}>
                          {outlook.data.breaker_tripped ? '⚡ HIGH VOLATILITY OVERRIDE' : '✔ STABLE CONFIDENCE'}
                       </span>
                    </div>

                    <div className="metrics-row">
                       <div className="sub-metric">
                          <label>Historical Avg</label>
                          <div className="val">{outlook.data.base.toFixed(1)}%</div>
                       </div>
                       <div className="sub-metric">
                          <label>Avg LSTM Shift</label>
                          <div className="val">{(outlook.data.mean - outlook.data.base).toFixed(1)}%</div>
                       </div>
                       <div className="sub-metric">
                          <label>Volatilty (σ)</label>
                          <div className="val">{outlook.data.volatility.toFixed(2)}</div>
                       </div>
                    </div>

                    <div className="final-forecast">
                       Authorized Routing Limit: 
                       <strong>{outlook.data.final.toFixed(1)}%</strong>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LstmPredictor;
