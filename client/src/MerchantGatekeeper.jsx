import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import './MerchantGatekeeper.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MERCHANTS = {
  reliable: {
    name: 'Reliable Merchant',
    id: 'MRC-7291',
    mds: 92,
    tier: 'Premium',
    history: '3,214 dispatches · 98.7% on-time',
    surgeMultiplier: 1.0,
    icon: '🏆',
    color: '#22c55e',
  },
  erratic: {
    name: 'Erratic Merchant',
    id: 'MRC-4503',
    mds: 48,
    tier: 'Restricted',
    history: '891 dispatches · 61.2% on-time',
    surgeMultiplier: 1.5,
    icon: '⚠️',
    color: '#f59e0b',
  },
};

export default function MerchantGatekeeper() {
  const [merchantKey, setMerchantKey] = useState('reliable');
  const [dispatchVol, setDispatchVol] = useState(2000);
  const [hubPressure, setHubPressure] = useState(55);
  const [mdsBoost, setMdsBoost] = useState(0);
  const [gateHistory, setGateHistory] = useState([]);

  const merchant = MERCHANTS[merchantKey];
  const effectiveMds = Math.min(merchantKey === 'erratic' ? merchant.mds + mdsBoost : merchant.mds, 100);

  // ── Core Gatekeeper Logic ─────────────────────────────────────────────
  const gateResult = useMemo(() => {
    const isReliable = effectiveMds >= 75;
    const pressure = Number(hubPressure);
    const volume = Number(dispatchVol);

    if (isReliable) {
      return {
        allocatedVol: volume,
        divertedVol: 0,
        allocPct: 100,
        status: 'guaranteed',
        statusText: 'All Slots Guaranteed',
        gateOpen: true,
        surgeMultiplier: 1.0,
      };
    }

    // Erratic merchant logic
    if (pressure > 85 && volume > 2000) {
      // Hard gate
      return {
        allocatedVol: 0,
        divertedVol: volume,
        allocPct: 0,
        status: 'denied',
        statusText: 'Access Denied: MDS too low for peak slot. Re-routing to 3PL partner.',
        gateOpen: false,
        surgeMultiplier: 1.5,
      };
    }

    if (pressure > 70) {
      // Throttled
      const capFactor = Math.max(0.2, 1 - ((pressure - 70) / 30) * 0.8);
      const allocated = Math.round(volume * capFactor);
      return {
        allocatedVol: allocated,
        divertedVol: volume - allocated,
        allocPct: Math.round(capFactor * 100),
        status: 'throttled',
        statusText: 'Capacity Throttled — Diversion Required',
        gateOpen: true,
        surgeMultiplier: 1.5,
      };
    }

    return {
      allocatedVol: volume,
      divertedVol: 0,
      allocPct: 100,
      status: 'guaranteed',
      statusText: 'All Slots Guaranteed',
      gateOpen: true,
      surgeMultiplier: 1.5,
    };
  }, [effectiveMds, hubPressure, dispatchVol]);

  // ── Dispatch ──────────────────────────────────────────────────────────
  const handleDispatch = () => {
    const entry = {
      time: new Date().toLocaleTimeString(),
      merchant: merchant.name,
      volume: dispatchVol,
      allocated: gateResult.allocatedVol,
      status: gateResult.status,
    };
    setGateHistory(prev => [entry, ...prev].slice(0, 8));

    if (gateResult.status === 'denied') {
      toast.error('HARD GATE: Dispatch blocked. Parcels diverted to 3PL partner.', { icon: '🛑' });
      fetch(`${API}/api/notify_admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency: 'CRITICAL',
          source: 'Merchant Gatekeeper',
          message: `Hard Gate triggered for ${merchant.name} (MDS ${effectiveMds}). ${dispatchVol} parcels diverted to 3PL.`,
        }),
      }).catch(e => console.error(e));
    } else if (gateResult.status === 'throttled') {
      toast(`Throttled: ${gateResult.allocatedVol} allocated, ${gateResult.divertedVol} diverted.`, {
        icon: '⚠️',
        style: { color: '#f59e0b' },
      });
      fetch(`${API}/api/notify_admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency: 'WARNING',
          source: 'Merchant Gatekeeper',
          message: `Throttled dispatch for ${merchant.name}. ${gateResult.divertedVol} parcels diverted.`,
        }),
      }).catch(e => console.error(e));
    } else {
      toast.success(`Dispatch cleared: ${gateResult.allocatedVol} parcels allocated.`, { icon: '✅' });
    }
  };

  const handleImprove = () => {
    if (merchantKey !== 'erratic') return;
    setMdsBoost(prev => Math.min(prev + 12, 52));
    toast.success('Forecast model recalibrated. MDS score improved!', { icon: '📈' });
  };

  const handleMerchantSwitch = (key) => {
    setMerchantKey(key);
    setMdsBoost(0);
  };

  // ── Gauge helpers ─────────────────────────────────────────────────────
  const gaugeAngle = (gateResult.allocPct / 100) * 180;
  const gaugeColor =
    gateResult.status === 'denied' ? '#ef4444' :
    gateResult.status === 'throttled' ? '#f59e0b' : '#22c55e';

  const baseCost = Number(dispatchVol) * 12;
  const surgedCost = baseCost * gateResult.surgeMultiplier;
  const diversionPenalty = gateResult.divertedVol * 8;

  // ── Hub pressure color ────────────────────────────────────────────────
  const pressureColor = hubPressure >= 85 ? '#ef4444' : hubPressure >= 70 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="mg-container">
      <div className="mg-header">
        <h3>Merchant Capacity Gatekeeper</h3>
        <span className="mg-badge">Delhi Hub · Live Gate</span>
      </div>

      <div className="mg-layout">
        {/* ════════ LEFT PANEL: MERCHANT PROFILE ════════ */}
        <div className="mg-panel mg-profile">
          <h4 className="mg-panel-title">Merchant Profile</h4>

          <div className="mg-select-wrap">
            <select
              value={merchantKey}
              onChange={e => handleMerchantSwitch(e.target.value)}
              className="mg-select"
            >
              <option value="reliable">🏆 Reliable Merchant</option>
              <option value="erratic">⚠️ Erratic Merchant</option>
            </select>
          </div>

          <div className="mg-profile-card" style={{ borderColor: merchant.color }}>
            <div className="mg-profile-icon">{merchant.icon}</div>
            <div className="mg-profile-name">{merchant.name}</div>
            <div className="mg-profile-id">{merchant.id}</div>

            <div className="mg-mds-ring" style={{ '--mds-color': merchant.color }}>
              <svg viewBox="0 0 120 120" className="mg-mds-svg">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={effectiveMds >= 75 ? '#22c55e' : effectiveMds >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={`${(effectiveMds / 100) * 314} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div className="mg-mds-value">{effectiveMds}</div>
              <div className="mg-mds-label">MDS</div>
            </div>

            <div className="mg-profile-tier" style={{ color: merchant.color }}>
              {effectiveMds >= 75 ? 'Premium' : 'Restricted'} Tier
            </div>
            <div className="mg-profile-history">{merchant.history}</div>

            {merchantKey === 'erratic' && effectiveMds < 100 && (
              <button className="mg-improve-btn" onClick={handleImprove}>
                📈 Improve Forecast Accuracy
              </button>
            )}
          </div>
        </div>

        {/* ════════ CENTER PANEL: HUB VISUALIZATION ════════ */}
        <div className="mg-panel mg-hub">
          <h4 className="mg-panel-title">Delhi Hub — Capacity Allocation</h4>

          {/* Gauge */}
          <div className="mg-gauge-wrap">
            <svg viewBox="0 0 220 130" className="mg-gauge-svg">
              {/* Background arc */}
              <path
                d="M 20 120 A 90 90 0 0 1 200 120"
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round"
              />
              {/* Filled arc */}
              <path
                d="M 20 120 A 90 90 0 0 1 200 120"
                fill="none" stroke={gaugeColor} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(gaugeAngle / 180) * 283} 283`}
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
              />
              {/* Needle */}
              <line
                x1="110" y1="120" x2="110" y2="40"
                stroke="white" strokeWidth="2"
                transform={`rotate(${gaugeAngle - 90} 110 120)`}
                style={{ transition: 'transform 0.5s ease' }}
              />
              <circle cx="110" cy="120" r="5" fill="white" />
            </svg>
            <div className="mg-gauge-pct">{gateResult.allocPct}%</div>
            <div className="mg-gauge-label">Capacity Allocation</div>
          </div>

          {/* Status Badge */}
          <div className={`mg-status-badge mg-status-${gateResult.status}`}>
            {gateResult.status === 'denied' && '🛑 '}
            {gateResult.status === 'throttled' && '⚠️ '}
            {gateResult.status === 'guaranteed' && '✅ '}
            {gateResult.statusText}
          </div>

          {/* Hub Pressure Viz */}
          <div className="mg-pressure-section">
            <div className="mg-pressure-label">
              Hub Pressure Index: <strong style={{ color: pressureColor }}>{hubPressure}%</strong>
            </div>
            <div className="mg-pressure-bar-bg">
              <div
                className="mg-pressure-bar-fill"
                style={{ width: `${hubPressure}%`, background: pressureColor, transition: 'width 0.3s, background 0.3s' }}
              />
              <div className="mg-pressure-threshold" style={{ left: '70%' }} />
              <div className="mg-pressure-threshold mg-pressure-critical" style={{ left: '85%' }} />
            </div>
            <div className="mg-pressure-ticks">
              <span>0%</span><span style={{ left: '70%', color: '#f59e0b' }}>70% Warn</span><span style={{ left: '85%', color: '#ef4444' }}>85% Gate</span><span>100%</span>
            </div>
          </div>

          {/* Volume split visualization */}
          <div className="mg-vol-split">
            <div className="mg-vol-bar">
              <div
                className="mg-vol-alloc"
                style={{ width: `${(gateResult.allocatedVol / Math.max(dispatchVol, 1)) * 100}%` }}
              >
                {gateResult.allocatedVol > 0 && <span>{gateResult.allocatedVol.toLocaleString()}</span>}
              </div>
              <div
                className="mg-vol-divert"
                style={{ width: `${(gateResult.divertedVol / Math.max(dispatchVol, 1)) * 100}%` }}
              >
                {gateResult.divertedVol > 0 && <span>{gateResult.divertedVol.toLocaleString()}</span>}
              </div>
            </div>
            <div className="mg-vol-legend">
              <span><i style={{ background: '#22c55e' }} /> Guaranteed Allocation</span>
              <span><i style={{ background: '#ef4444' }} /> Forced Diversion</span>
            </div>
          </div>
        </div>

        {/* ════════ RIGHT PANEL: DISPATCH CONSOLE ════════ */}
        <div className="mg-panel mg-console">
          <h4 className="mg-panel-title">Dispatch Console</h4>

          <div className="mg-input-group">
            <label>Planned Dispatch Volume <strong>{Number(dispatchVol).toLocaleString()}</strong></label>
            <input
              type="range" min="0" max="5000" step="50"
              value={dispatchVol}
              onChange={e => setDispatchVol(e.target.value)}
            />
            <div className="mg-range-labels"><span>0</span><span>5,000 parcels</span></div>
          </div>

          <div className="mg-input-group">
            <label>Current Hub Pressure <strong>{hubPressure}%</strong></label>
            <input
              type="range" min="0" max="100"
              value={hubPressure}
              onChange={e => setHubPressure(e.target.value)}
            />
            <div className="mg-range-labels"><span>Calm</span><span>Overloaded</span></div>
          </div>

          <button className="mg-dispatch-btn" onClick={handleDispatch}>
            Execute Dispatch Gate Check
          </button>

          {/* Financial Impact */}
          <div className="mg-financials">
            <h5>Financial Impact</h5>
            <div className="mg-fin-row">
              <span>Base Logistics Cost</span>
              <span>₹{baseCost.toLocaleString()}</span>
            </div>
            <div className="mg-fin-row highlight">
              <span>Surge Multiplier</span>
              <span className={gateResult.surgeMultiplier > 1 ? 'text-amber' : 'text-green'}>
                {gateResult.surgeMultiplier.toFixed(1)}x
                {gateResult.surgeMultiplier > 1 && <small> (Volatility Surcharge)</small>}
              </span>
            </div>
            <div className="mg-fin-row">
              <span>Surged Cost</span>
              <span>₹{surgedCost.toLocaleString()}</span>
            </div>
            {diversionPenalty > 0 && (
              <div className="mg-fin-row penalty">
                <span>3PL Diversion Penalty</span>
                <span className="text-red">+ ₹{diversionPenalty.toLocaleString()}</span>
              </div>
            )}
            <div className="mg-fin-total">
              <span>Total Estimated Cost</span>
              <span>₹{(surgedCost + diversionPenalty).toLocaleString()}</span>
            </div>
          </div>

          {/* Gate Log */}
          {gateHistory.length > 0 && (
            <div className="mg-log">
              <h5>Gate Log</h5>
              {gateHistory.map((entry, i) => (
                <div key={i} className={`mg-log-entry mg-log-${entry.status}`}>
                  <span className="mg-log-time">{entry.time}</span>
                  <span>{entry.allocated.toLocaleString()} / {entry.volume.toLocaleString()}</span>
                  <span className="mg-log-status">{entry.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
