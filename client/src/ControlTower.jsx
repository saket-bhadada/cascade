import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import './ControlTower.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/* ══════════════════════════════════════════════════════
   MDS CALCULATION ENGINE
   ──────────────────────────────────────────────────────
   MDS (Merchant Dispatch Score) is computed from the
   quality profile of every shipment that arrives at a hub.

   5 Quality Dimensions (each scored 0–100, weighted):
   ┌─────────────────────────┬────────┬─────────────────────────────────┐
   │ Dimension               │ Weight │ What it measures                │
   ├─────────────────────────┼────────┼─────────────────────────────────┤
   │ Packaging Integrity     │  25%   │ % parcels undamaged on arrival  │
   │ Label Accuracy          │  20%   │ % correct barcodes / addresses  │
   │ On-Time Handover        │  25%   │ % dispatches within SLA window  │
   │ Volume Accuracy         │  15%   │ How close actual vs declared    │
   │ Return Rate (Inverse)   │  15%   │ Lower returns = higher score    │
   └─────────────────────────┴────────┴─────────────────────────────────┘

   MDS = Σ (dimension_score × weight)
   ══════════════════════════════════════════════════════ */
const MDS_WEIGHTS = {
  packaging:  0.25,
  labeling:   0.20,
  ontime:     0.25,
  volumeAcc:  0.15,
  returnRate: 0.15,
};

function calcMds(quality) {
  return Math.round(
    quality.packaging  * MDS_WEIGHTS.packaging +
    quality.labeling   * MDS_WEIGHTS.labeling +
    quality.ontime     * MDS_WEIGHTS.ontime +
    quality.volumeAcc  * MDS_WEIGHTS.volumeAcc +
    quality.returnRate * MDS_WEIGHTS.returnRate
  );
}

function getTier(mds) {
  if (mds >= 80) return 'platinum';
  if (mds >= 60) return 'gold';
  return 'restricted';
}

/* ── Merchant Profiles (seed quality) ────────────── */
const INITIAL_MERCHANTS = [
  { id: 'MRC-7291', name: 'GlobalTrade Corp', icon: '🏆', quality: { packaging: 96, labeling: 94, ontime: 97, volumeAcc: 90, returnRate: 88 } },
  { id: 'MRC-5520', name: 'QuickShip India',  icon: '🥇', quality: { packaging: 82, labeling: 80, ontime: 85, volumeAcc: 72, returnRate: 70 } },
  { id: 'MRC-4503', name: 'BudgetBox LLC',    icon: '⚠️', quality: { packaging: 52, labeling: 45, ontime: 48, volumeAcc: 55, returnRate: 40 } },
  { id: 'MRC-3312', name: 'FreshFarm Direct', icon: '🚫', quality: { packaging: 38, labeling: 30, ontime: 35, volumeAcc: 42, returnRate: 28 } },
  { id: 'MRC-8801', name: 'LuxeRetail Group', icon: '💎', quality: { packaging: 98, labeling: 97, ontime: 99, volumeAcc: 93, returnRate: 95 } },
];

const HUBS = ['Delhi Hub', 'Mumbai Hub', 'Kolkata Hub', 'Bangalore Hub', 'Chennai Hub'];

const SLA_TIERS = {
  platinum:   { premium: true, standard: true, surgeMultiplier: 1.0,  slotPriority: 'First-Class' },
  gold:       { premium: true, standard: true, surgeMultiplier: 1.15, slotPriority: 'Priority' },
  restricted: { premium: false, standard: true, surgeMultiplier: 1.5, slotPriority: 'Best-Effort' },
};

/* ── Hub Pressure Simulation ──────────────────────── */
function useHubPressures() {
  const [pressures, setPressures] = useState(() =>
    HUBS.reduce((acc, h) => ({ ...acc, [h]: 40 + Math.floor(Math.random() * 30) }), {})
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPressures(prev => {
        const next = {};
        for (const hub of HUBS) {
          const drift = (Math.random() - 0.48) * 6;
          next[hub] = Math.max(15, Math.min(98, prev[hub] + drift));
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return pressures;
}

/* ── Generate random quality for a single shipment ─ */
function genShipmentQuality(baseQuality) {
  // Each shipment has noise ±15 of the merchant's base quality
  const jitter = (base) => Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 30));
  return {
    packaging:  Math.round(jitter(baseQuality.packaging)),
    labeling:   Math.round(jitter(baseQuality.labeling)),
    ontime:     Math.round(jitter(baseQuality.ontime)),
    volumeAcc:  Math.round(jitter(baseQuality.volumeAcc)),
    returnRate: Math.round(jitter(baseQuality.returnRate)),
  };
}

/* ── Quality Badge ────────────────────────────────── */
function QualityBreakdown({ quality }) {
  const dims = [
    { key: 'packaging',  label: 'Packaging',    val: quality.packaging },
    { key: 'labeling',   label: 'Label Acc.',    val: quality.labeling },
    { key: 'ontime',     label: 'On-Time',       val: quality.ontime },
    { key: 'volumeAcc',  label: 'Vol. Accuracy', val: quality.volumeAcc },
    { key: 'returnRate', label: 'Low Returns',   val: quality.returnRate },
  ];
  return (
    <div className="ct-quality-grid">
      {dims.map(d => (
        <div key={d.key} className="ct-q-cell">
          <div className="ct-q-bar-bg">
            <div
              className="ct-q-bar-fill"
              style={{
                width: `${d.val}%`,
                background: d.val >= 80 ? '#22c55e' : d.val >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <span className="ct-q-label">{d.label}</span>
          <span className="ct-q-val">{d.val}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Shipment Row Component ───────────────────────── */
function ShipmentRow({ shipment, pressures, merchantState }) {
  const merchant = merchantState.find(m => m.id === shipment.merchantId);
  const mds = merchant.mds;
  const tier = getTier(mds);
  const sla = SLA_TIERS[tier];
  const hubPressure = pressures[shipment.hub] || 50;

  let slotStatus, riskLevel, priceImpact, gateDecision;
  const baseCost = shipment.volume * 12;

  if (mds >= 75) {
    slotStatus = shipment.slaPremium ? 'Premium Slot Guaranteed' : 'Standard Slot Guaranteed';
    riskLevel = 'low';
    priceImpact = baseCost * sla.surgeMultiplier;
    gateDecision = 'approved';
  } else if (hubPressure > 85) {
    slotStatus = 'Hard Gate -- Slot Denied';
    riskLevel = 'critical';
    priceImpact = baseCost * 1.5 + shipment.volume * 8;
    gateDecision = 'denied';
  } else if (hubPressure > 70) {
    slotStatus = 'Throttled -- Partial Allocation';
    riskLevel = 'high';
    const capFactor = Math.max(0.3, 1 - ((hubPressure - 70) / 30) * 0.7);
    priceImpact = baseCost * sla.surgeMultiplier + (shipment.volume * (1 - capFactor)) * 8;
    gateDecision = 'throttled';
  } else {
    slotStatus = shipment.slaPremium ? 'Premium (Restricted)' : 'Standard Slot Available';
    riskLevel = 'medium';
    priceImpact = baseCost * sla.surgeMultiplier;
    gateDecision = shipment.slaPremium && !sla.premium ? 'denied' : 'approved';
    if (gateDecision === 'denied') {
      slotStatus = 'Premium Access Denied -- MDS too low';
      riskLevel = 'high';
    }
  }

  const shipMds = calcMds(shipment.quality);

  return (
    <tr className={`ct-row ct-row-${riskLevel}`}>
      <td>
        <div className="ct-shipment-id">{shipment.id}</div>
        <div className="ct-shipment-time">{shipment.time}</div>
      </td>
      <td>
        <div className="ct-merchant-cell">
          <span className="ct-merchant-icon">{merchant.icon}</span>
          <div>
            <div className="ct-merchant-name">{merchant.name}</div>
            <div className="ct-merchant-id">{merchant.id}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="ct-mds-mini">
          <div className="ct-mds-bar-bg">
            <div
              className="ct-mds-bar-fill"
              style={{
                width: `${mds}%`,
                background: mds >= 75 ? '#22c55e' : mds >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <span className="ct-mds-num">{mds}</span>
        </div>
        <div className="ct-shipment-mds-tag">
          This shipment: <strong style={{ color: shipMds >= 75 ? '#4ade80' : shipMds >= 50 ? '#fcd34d' : '#fca5a5' }}>{shipMds}</strong>
        </div>
      </td>
      <td>
        <span className={`ct-slot-badge ct-slot-${gateDecision}`}>{slotStatus}</span>
      </td>
      <td>
        <div className="ct-hub-cell">
          <span>{shipment.hub.split(' ')[0]}</span>
          <span className="ct-pressure-num" style={{ color: hubPressure > 85 ? '#ef4444' : hubPressure > 70 ? '#f59e0b' : '#4ade80' }}>
            {Math.round(hubPressure)}%
          </span>
        </div>
      </td>
      <td className="ct-vol-cell">{shipment.volume.toLocaleString()}</td>
      <td>
        <span className="ct-price">Rs.{Math.round(priceImpact).toLocaleString()}</span>
        {sla.surgeMultiplier > 1 && <span className="ct-surge-tag">{sla.surgeMultiplier}x</span>}
      </td>
      <td>
        <span className={`ct-risk-pill ct-risk-${riskLevel}`}>
          {riskLevel === 'critical' ? 'CRITICAL' : riskLevel === 'high' ? 'HIGH' : riskLevel === 'medium' ? 'MEDIUM' : 'LOW'}
        </span>
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN CONTROL TOWER PAGE
   ══════════════════════════════════════════════════════ */
export default function ControlTower() {
  const pressures = useHubPressures();
  const [shipments, setShipments] = useState([]);
  const [autoGen, setAutoGen] = useState(false);
  const autoRef = useRef(null);
  const shipmentCounter = useRef(1);

  // Dynamic merchant state — MDS recalculated from shipment quality history
  const [merchantState, setMerchantState] = useState(() =>
    INITIAL_MERCHANTS.map(m => ({
      ...m,
      mds: calcMds(m.quality),
      qualityHistory: [m.quality],
      shipmentCount: 0,
    }))
  );

  // Recalculate MDS using rolling average of last N shipment quality scores
  const recalcMds = (merchantId, newQuality) => {
    setMerchantState(prev => prev.map(m => {
      if (m.id !== merchantId) return m;
      const history = [...m.qualityHistory, newQuality].slice(-20); // rolling window of 20
      // Weighted average: recent shipments count more
      const avgQuality = {};
      for (const dim of Object.keys(MDS_WEIGHTS)) {
        let weightedSum = 0, weightTotal = 0;
        history.forEach((q, i) => {
          const w = 1 + i * 0.3; // more recent = higher weight
          weightedSum += q[dim] * w;
          weightTotal += w;
        });
        avgQuality[dim] = weightedSum / weightTotal;
      }
      return {
        ...m,
        mds: calcMds(avgQuality),
        quality: avgQuality,
        qualityHistory: history,
        shipmentCount: m.shipmentCount + 1,
      };
    }));
  };

  // Generate shipment
  const genShipment = () => {
    const mIdx = Math.floor(Math.random() * merchantState.length);
    const merchant = merchantState[mIdx];
    const hub = HUBS[Math.floor(Math.random() * HUBS.length)];
    const volume = (Math.floor(Math.random() * 50) + 5) * 100;
    const slaPremium = Math.random() > 0.5;
    const now = new Date();

    // Generate quality for THIS specific shipment
    const quality = genShipmentQuality(merchant.quality);
    const shipMds = calcMds(quality);

    const shipment = {
      id: `SHP-${String(shipmentCounter.current++).padStart(4, '0')}`,
      merchantId: merchant.id,
      hub,
      volume,
      slaPremium,
      quality,
      shipMds,
      time: now.toLocaleTimeString(),
    };

    setShipments(prev => [shipment, ...prev].slice(0, 50));

    // Recalculate merchant MDS from this shipment's quality
    recalcMds(merchant.id, quality);

    // Alerts
    const p = pressures[hub] || 50;
    if (merchant.mds < 75 && p > 85) {
      toast.error(`Hard Gate: ${merchant.name} blocked at ${hub}`, { icon: '🛑' });
      fetch(`${API}/api/notify_admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency: 'CRITICAL',
          source: 'Control Tower',
          message: `Hard Gate: ${merchant.name} (MDS ${merchant.mds}) blocked at ${hub} (${Math.round(p)}% pressure). Shipment quality: ${shipMds}/100.`,
        }),
      }).catch(console.error);
    } else if (shipMds < 40) {
      toast(`Low quality shipment from ${merchant.name}: MDS ${shipMds}/100`, {
        icon: '📦', style: { color: '#fca5a5' },
      });
    }
  };

  // Auto-generate toggle
  useEffect(() => {
    if (autoGen) {
      autoRef.current = setInterval(genShipment, 2200);
    } else if (autoRef.current) {
      clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoGen, merchantState]);

  // Summary stats
  const totalShipments = shipments.length;
  const blockedCount = shipments.filter(s => {
    const m = merchantState.find(x => x.id === s.merchantId);
    const p = pressures[s.hub] || 50;
    return m && m.mds < 75 && p > 85;
  }).length;

  const throttledCount = shipments.filter(s => {
    const m = merchantState.find(x => x.id === s.merchantId);
    const p = pressures[s.hub] || 50;
    return m && m.mds < 75 && p > 70 && p <= 85;
  }).length;

  return (
    <div className="ct-page">
      {/* Navigation */}
      <nav className="ct-nav">
        <Link to="/" className="ct-nav-link">← Hub Dashboard</Link>
        <div className="ct-nav-title">Merchant Control Tower</div>
        <div className="ct-nav-live">
          <span className="ct-live-dot" /> LIVE
        </div>
      </nav>

      {/* MDS Formula Explainer */}
      <div className="ct-formula-bar">
        <strong>MDS</strong> = Packaging(25%) + Label Accuracy(20%) + On-Time(25%) + Volume Accuracy(15%) + Low Returns(15%)
        <span className="ct-formula-tag">Rolling avg of last 20 shipments</span>
      </div>

      {/* Summary Cards */}
      <div className="ct-summary-row">
        <div className="ct-summary-card">
          <div className="ct-sum-label">Registered Merchants</div>
          <div className="ct-sum-value">{merchantState.length}</div>
        </div>
        <div className="ct-summary-card">
          <div className="ct-sum-label">Active Shipments</div>
          <div className="ct-sum-value accent">{totalShipments}</div>
        </div>
        <div className="ct-summary-card warn-card">
          <div className="ct-sum-label">Throttled</div>
          <div className="ct-sum-value warn">{throttledCount}</div>
        </div>
        <div className="ct-summary-card crit-card">
          <div className="ct-sum-label">Blocked (Hard Gate)</div>
          <div className="ct-sum-value crit">{blockedCount}</div>
        </div>

        {HUBS.map(hub => (
          <div key={hub} className="ct-summary-card ct-hub-pressure-card">
            <div className="ct-sum-label">{hub.split(' ')[0]}</div>
            <div
              className="ct-sum-value"
              style={{ color: pressures[hub] > 85 ? '#ef4444' : pressures[hub] > 70 ? '#f59e0b' : '#4ade80' }}
            >
              {Math.round(pressures[hub])}%
            </div>
            <div className="ct-mini-bar">
              <div style={{
                width: `${pressures[hub]}%`,
                background: pressures[hub] > 85 ? '#ef4444' : pressures[hub] > 70 ? '#f59e0b' : '#3b82f6',
                transition: 'width 0.5s, background 0.3s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Merchant Score Cards — Now Dynamic */}
      <div className="ct-merchant-cards">
        {merchantState.map(m => {
          const tier = getTier(m.mds);
          const sla = SLA_TIERS[tier];
          return (
            <div key={m.id} className={`ct-m-card ct-tier-${tier}`}>
              <div className="ct-m-card-top">
                <span className="ct-m-icon">{m.icon}</span>
                <div>
                  <div className="ct-m-name">{m.name}</div>
                  <div className="ct-m-id">{m.id} · {m.shipmentCount} checked</div>
                </div>
              </div>
              <div className="ct-m-mds-row">
                <div className="ct-m-mds-ring">
                  <svg viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="32" fill="none"
                      stroke={m.mds >= 75 ? '#22c55e' : m.mds >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      strokeDasharray={`${(m.mds / 100) * 201} 201`}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
                    />
                  </svg>
                  <span className="ct-m-mds-num">{m.mds}</span>
                </div>
                <div className="ct-m-stats">
                  <div><small>Tier</small><strong className={`ct-tier-label-${tier}`}>{tier.toUpperCase()}</strong></div>
                  <div><small>Surge</small><strong>{sla.surgeMultiplier}x</strong></div>
                  <div><small>Premium</small><strong className={sla.premium ? 'ct-tier-label-platinum' : 'ct-tier-label-restricted'}>{sla.premium ? 'YES' : 'NO'}</strong></div>
                </div>
              </div>

              {/* Quality Breakdown */}
              <QualityBreakdown quality={m.quality} />

              <div className="ct-m-sla-access">
                <span className={sla.premium ? 'ct-sla-yes' : 'ct-sla-no'}>Premium {sla.premium ? '✓' : '✗'}</span>
                <span className="ct-sla-yes">Standard ✓</span>
                <span className="ct-sla-surge">{sla.surgeMultiplier}x Surge</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="ct-controls">
        <button className="ct-gen-btn" onClick={genShipment}>
          + Create Shipment
        </button>
        <button className={`ct-auto-btn ${autoGen ? 'active' : ''}`} onClick={() => setAutoGen(!autoGen)}>
          {autoGen ? '⏸ Pause Auto-Gen' : '▶ Auto-Generate'}
        </button>
        {shipments.length > 0 && (
          <button className="ct-clear-btn" onClick={() => setShipments([])}>
            Clear Log
          </button>
        )}
      </div>

      {/* Shipment Table */}
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Shipment</th>
              <th>Merchant</th>
              <th>MDS (Cumulative / This)</th>
              <th>Slot Availability</th>
              <th>Hub / Pressure</th>
              <th>Volume</th>
              <th>Price Impact</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan="8" className="ct-empty">No shipments yet. Click "Create Shipment" or enable Auto-Generate.</td></tr>
            ) : (
              shipments.map(s => <ShipmentRow key={s.id} shipment={s} pressures={pressures} merchantState={merchantState} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
