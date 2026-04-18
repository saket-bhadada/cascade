import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './PreDepartureSimulator.css';

const API = import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

const PreDepartureSimulator = ({ hubData }) => {
  const [payload, setPayload] = useState(15);
  const [occupancy, setOccupancy] = useState(65);
  const [isPremium, setIsPremium] = useState(false);
  
  const [modal, setModal] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle'); // idle | scanning | success

  const [metrics, setMetrics] = useState({
    totalDispatches: 0,
    redirects: 0,
    slaFailures: 0
  });

  const handleLiveScan = () => {
    setScanStatus('scanning');
    
    // Simulate connecting to warehouse bay sensors
    let tickCount = 0;
    const maxTicks = 15;
    
    const interval = setInterval(() => {
       // fluctuate dummy numbers during scan
       setOccupancy(Math.floor(Math.random() * 40) + 40);
       tickCount++;
       
       if (tickCount >= maxTicks) {
         clearInterval(interval);
         // Pull actual real-time peak capacity from data, or default if missing
         const actualCap = hubData?.current_capacity_pct 
                           || hubData?.summary?.peak_capacity_pct 
                           || 82.5; 
         setOccupancy(Math.round(actualCap));
         setScanStatus('success');
         
         setTimeout(() => {
           setScanStatus('idle');
         }, 3000);
       }
    }, 100);
  };

  const handleCheck = () => {
    const total = Number(occupancy) + Number(payload);
    let state = 'Normal';
    let route = 'primary';
    let reason = 'Capacity permits direct primary route.';

    if (total >= 90) {
      state = 'Critical';
      route = 'secondary';
      reason = 'CRITICAL state (>90%). Extreme gridlock imminent. ALL cargo re-routed to Secondary.';
      toast.error(`Critical path threshold reached: ${total}%. ALL routing diverted.`, { icon: '🚨' });
      fetch(`${API}/api/notify_admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgency: 'CRITICAL', source: 'PreDeparture Sandbox', message: reason })
      }).catch(e => console.error(e));
    } else if (total >= 75) {
      state = 'Warning';
      if (isPremium) {
        route = 'primary';
        reason = 'WARNING state (75%-90%). High value Premium cargo overrides limit. Proceeding to Primary.';
        toast(`Warning state reached (${total}%). Premium SLA bypass activated.`, { icon: '⚠️', style: { color: '#f59e0b' } });
      } else {
        route = 'secondary';
        reason = 'WARNING state (75%-90%). Standard cargo redirected to clear primary space.';
        toast(`Warning state reached (${total}%). Standard routing diverted.`, { icon: '⚠️', style: { color: '#f59e0b' } });
      }
      fetch(`${API}/api/notify_admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgency: 'WARNING', source: 'PreDeparture Sandbox', message: reason })
      }).catch(e => console.error(e));
    } else {
      toast.success('System operating under normal clearance.', { icon: '✅' });
    }

    setModal({ total, state, route, reason });
  };

  const approveDispatch = () => {
    const { route } = modal;
    setModal(null);
    setActiveRoute(route);
    setIsSimulating(true);

    const isRedirect = route === 'secondary';
    const failSla = route === 'secondary' && isPremium;

    setMetrics(prev => ({
      totalDispatches: prev.totalDispatches + 1,
      redirects: prev.redirects + (isRedirect ? 1 : 0),
      slaFailures: prev.slaFailures + (failSla ? 1 : 0)
    }));

    setTimeout(() => {
      setIsSimulating(false);
      setActiveRoute(null);
    }, 2000);
  };

  const slaRate = metrics.totalDispatches > 0 
    ? (((metrics.totalDispatches - metrics.slaFailures) / metrics.totalDispatches) * 100).toFixed(1)
    : 100.0;

  return (
    <div className="pre-dep-container">
      <div className="pre-dep-header">
        <h3>Pre-Departure Routing Engine</h3>
        <div className="metrics-panel">
           <div className="metric">
             <span>Total Redirects:</span>
             <strong>{metrics.redirects}</strong>
           </div>
           <div className="metric">
             <span>SLA Success Rate:</span>
             <strong className={slaRate < 100 ? "text-warn" : "text-ok"}>{slaRate}%</strong>
           </div>
        </div>
      </div>

      <div className="pre-dep-body">
        
        {/* CONTROL PANEL */}
        <div className="control-panel">
          <div className="control-group">
            <label>Truck Payload Volume ({payload} units)</label>
            <input 
              type="range" min="1" max="50" 
              value={payload} onChange={e => setPayload(e.target.value)} 
              disabled={isSimulating || modal}
            />
          </div>

          <div className="control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
              <label style={{marginBottom: 0}}>Primary Hub Occupancy</label>
              <button 
                className={`live-scan-btn ${scanStatus === 'scanning' ? 'pulse-scan' : scanStatus === 'success' ? 'scan-success' : ''}`}
                onClick={handleLiveScan}
                disabled={scanStatus === 'scanning' || isSimulating || modal}
              >
                {scanStatus === 'scanning' ? '📡 Scanning...' : scanStatus === 'success' ? '✓ Synced' : '📡 Live Check'}
              </button>
            </div>
            
            {/* Real-time Bay visualizer inside the control panel */}
            <div className={`sensor-bay-grid ${scanStatus === 'scanning' ? 'sensor-scanning' : ''}`}>
               {Array.from({length: 40}).map((_, i) => (
                  <div key={i} className="sensor-cell" 
                       style={{ 
                          background: (i < (occupancy / 100) * 40) 
                             ? (occupancy >= 90 ? '#ef4444' : occupancy >= 75 ? '#f59e0b' : '#3b82f6')
                             : 'rgba(255,255,255,0.05)'
                       }}>
                  </div>
               ))}
               <div className="sensor-overlay-text">{occupancy}%</div>
            </div>

            <input 
              type="range" min="0" max="100" 
              value={occupancy} onChange={e => setOccupancy(e.target.value)}
              disabled={isSimulating || modal || scanStatus === 'scanning'}
            />
          </div>

          <div className="control-group toggle-group" style={{ marginTop: '10px' }}>
            <label>Product Category</label>
            <div className="toggle-switch" onClick={() => !isSimulating && !modal && setIsPremium(!isPremium)}>
              <div className={`toggle-btn ${!isPremium ? 'active standard' : ''}`}>Standard (Blue)</div>
              <div className={`toggle-btn ${isPremium ? 'active premium' : ''}`}>Premium (Gold)</div>
            </div>
          </div>

          <button 
            className="check-btn" 
            onClick={handleCheck} 
            disabled={isSimulating || modal || scanStatus === 'scanning'}
          >
            Initiate Routing Check
          </button>
        </div>

        {/* VISUALIZATION AREA */}
        <div className="viz-panel">
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
             <path id="path-primary" d="M 120 180 Q 250 180 350 80" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" strokeDasharray="5,5" />
             <path id="path-secondary" d="M 120 180 Q 250 180 350 280" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" strokeDasharray="5,5" />
             
             {isSimulating && activeRoute && (
               <g>
                 <path d={activeRoute === 'primary' ? "M 120 180 Q 250 180 350 80" : "M 120 180 Q 250 180 350 280"} stroke={isPremium ? "#f59e0b" : "#3b82f6"} strokeWidth="4" fill="none" className="active-route-path" />
                 <text fontSize="30" filter={`drop-shadow(0 0 10px ${isPremium ? '#f59e0b' : '#3b82f6'})`}>
                   🚚
                   <animateMotion dur="1.8s" repeatCount="1" fill="freeze">
                     <mpath href={`#path-${activeRoute}`} />
                   </animateMotion>
                 </text>
               </g>
             )}
          </svg>

          {/* Location Nodes */}
          <div className="loc-node origin" style={{ left: 80, top: 180 }}>
            <div className="loc-icon">🏭</div>
            <div className="loc-label">Origin Warehouse</div>
          </div>

          <div className="loc-node dest primary" style={{ left: 380, top: 80 }}>
            <div className="loc-icon">🏢</div>
            <div className="loc-label">Primary Destination</div>
            <div className={`loc-status ${Number(occupancy) >= 90 ? 'critical' : Number(occupancy) >= 75 ? 'warning' : 'normal'}`}>
               Load: {occupancy}%
            </div>
          </div>

          <div className="loc-node dest secondary" style={{ left: 380, top: 280 }}>
            <div className="loc-icon">⛺</div>
            <div className="loc-label">Secondary Overflow</div>
            <div className="loc-status available">Available</div>
          </div>

          {/* APPROVAL MODAL */}
          {modal && (
            <div className="approval-modal-overlay">
              <div className={`approval-modal border-${modal.state.toLowerCase()}`}>
                <div className="modal-title">Pre-Departure Calculation</div>
                <div className="modal-row">
                   <span>Projected Occupancy:</span>
                   <strong>{occupancy}% + {payload}u = {modal.total}%</strong>
                </div>
                <div className="modal-row">
                   <span>System State:</span>
                   <strong className={`badge-${modal.state.toLowerCase()}`}>{modal.state}</strong>
                </div>
                <div className="modal-row">
                   <span>Target Node:</span>
                   <strong style={{textTransform:'uppercase'}}>{modal.route} Hub</strong>
                </div>
                <div className="modal-reason">{modal.reason}</div>
                
                <button className="approve-btn" onClick={approveDispatch}>
                  Approve Launch 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreDepartureSimulator;
