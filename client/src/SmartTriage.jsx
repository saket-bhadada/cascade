import React, { useState, useEffect } from 'react';
import './SmartTriage.css';

const HUB_COORDS = {
  delhi: { x: 380, y: 150, label: "Delhi Main (North)" },
  mumbai: { x: 200, y: 350, label: "Mumbai Port (West)" },
  kolkata: { x: 650, y: 280, label: "Kolkata East" },
  bangalore: { x: 340, y: 500, label: "Bangalore Tech (South)" },
  chennai: { x: 480, y: 530, label: "Chennai Coastal" }
};

const DEFAULT_SECONDARY = {
  delhi: "mumbai",
  mumbai: "delhi",
  bangalore: "chennai",
  chennai: "bangalore",
  kolkata: "delhi"
};

const SmartTriage = ({ hubData, allHubs = [] }) => {
  const [currentTickIndex, setCurrentTickIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval;
    if (isPlaying && hubData?.ticks?.length > 0) {
      interval = setInterval(() => {
        setCurrentTickIndex(prev => {
          if (prev >= hubData.ticks.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 300); // 300ms per tick
    }
    return () => clearInterval(interval);
  }, [isPlaying, hubData]);

  useEffect(() => {
    setCurrentTickIndex(0);
    setIsPlaying(false);
  }, [hubData?.id]);

  if (!hubData || !hubData.ticks || hubData.ticks.length === 0) {
    return <div className="triage-container">Awaiting simulation data...</div>;
  }

  const activeId = hubData.id;
  
  // 1. Gather Live Capacities for ALL checkpoints in one go
  const liveCaps = {};
  allHubs.forEach(h => {
    liveCaps[h.id] = h.ticks?.[currentTickIndex]?.capacity_pct ?? 0;
  });

  const activeCap = liveCaps[activeId] ?? 0;
  const isWarning = activeCap >= 75.0;

  // 2. Compute Cascading Fallback Routes dynamically!
  let cascadePaths = [];
  if (isWarning) {
    let currentSrc = activeId;
    let visited = new Set([activeId]);
    
    // Allow up to 4 hops to avoid infinite loops across India
    for (let hop = 0; hop < 4; hop++) {
      let targetId = DEFAULT_SECONDARY[currentSrc] || "delhi";
      
      // If default target is ALSO overloaded (>=75%), or visited, find another route!
      let targetCap = liveCaps[targetId] ?? 0;
      if (visited.has(targetId) || targetCap >= 75.0) {
         const alternative = Object.keys(HUB_COORDS).find(k => !visited.has(k) && (liveCaps[k] ?? 0) < 75.0);
         if (alternative) {
           targetId = alternative;
         } else {
           // Total gridlock: push to default anyway if not perfectly avoidable
           if (visited.has(targetId)) break; 
         }
      }
      
      const srcPos = HUB_COORDS[currentSrc];
      const tgtPos = HUB_COORDS[targetId];
      
      cascadePaths.push({
         from: currentSrc,
         to: targetId,
         pathId: `cascade-path-${hop}`,
         d: `M ${srcPos.x} ${srcPos.y} L ${tgtPos.x} ${tgtPos.y}`,
         isFallback: hop > 0 // if hop > 0, it means it's a chain reaction
      });
      
      if ((liveCaps[targetId] ?? 0) < 75.0) {
         break; // Found a safe warehouse checkpoint!
      }
      
      visited.add(targetId);
      currentSrc = targetId; // keep jumping!
    }
  }

  const dateObj = new Date(hubData.ticks[currentTickIndex].timestamp);
  const timeStr = `${dateObj.toLocaleDateString('en-IN', {month:'short', day:'numeric'})} ${String(dateObj.getHours()).padStart(2,'0')}:00`;

  const togglePlay = () => setIsPlaying(!isPlaying);
  const reset = () => { setIsPlaying(false); setCurrentTickIndex(0); };
  const activePos = HUB_COORDS[activeId];

  return (
    <div className="triage-container">
      <div className="triage-header">
        <div>
          <h3>Live Supply Chain Network Map</h3>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            System Time: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{timeStr}</span>
          </div>
        </div>
        <div className="sim-controls">
          <button onClick={togglePlay} className="control-btn">
            {isPlaying ? '⏸ Pause' : '▶ Play Simulation'}
          </button>
          <button onClick={reset} className="control-btn secondary">↺ Reset</button>
        </div>
        <div className="triage-status">
          <span className={`pulse-dot ${isWarning ? 'amber' : 'green'}`}></span>
          {isWarning ? (cascadePaths.length > 1 ? 'CASCADE TRUCK REDIRECTING' : 'TRIAGE PROTOCOL ACTIVE') : 'OPTIMAL ROUTING'}
        </div>
      </div>

      <div className="map-wrapper" style={{ position: 'relative', height: '600px', background: 'radial-gradient(ellipse at center, #1b2034 0%, #0d0e14 100%)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
          <g stroke="rgba(255,255,255,0.03)" strokeWidth="1">
             {Array.from({length: 12}).map((_,i) => <line key={`h-${i}`} x1="0" y1={i*50} x2="1000" y2={i*50} />)}
             {Array.from({length: 20}).map((_,i) => <line key={`v-${i}`} x1={i*50} y1="0" x2={i*50} y2="600" />)}
          </g>

          <path d={`M ${HUB_COORDS.delhi.x} ${HUB_COORDS.delhi.y} L ${HUB_COORDS.mumbai.x} ${HUB_COORDS.mumbai.y} L ${HUB_COORDS.bangalore.x} ${HUB_COORDS.bangalore.y} L ${HUB_COORDS.chennai.x} ${HUB_COORDS.chennai.y} L ${HUB_COORDS.kolkata.x} ${HUB_COORDS.kolkata.y} Z`} stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
          <path d={`M ${HUB_COORDS.delhi.x} ${HUB_COORDS.delhi.y} L ${HUB_COORDS.kolkata.x} ${HUB_COORDS.kolkata.y}`} stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />

          {/* Render Cascading Routes */}
          {cascadePaths.map((route, i) => (
             <path key={route.pathId} id={route.pathId} d={route.d} stroke={route.isFallback ? "#f59e0b" : "#3b82f6"} strokeWidth="2" strokeDasharray="6,6" fill="none">
                <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />
             </path>
          ))}

          {/* Incoming Flow Path - Always available */}
          <path id="incoming-premium" d={`M ${activePos.x - 200} ${activePos.y - 50} Q ${activePos.x - 100} ${activePos.y - 100} ${activePos.x} ${activePos.y}`} stroke="transparent" fill="none" />
          <path id="incoming-standard" d={`M ${activePos.x + 200} ${activePos.y - 50} Q ${activePos.x + 100} ${activePos.y - 100} ${activePos.x} ${activePos.y}`} stroke="transparent" fill="none" />

          {isPlaying && (
            <>
              {/* Premium Gold Trucks - Incoming extremely slow and steady to Primary */}
              <g>
                <text fontSize="26" filter="drop-shadow(0 0 5px #f59e0b)">
                  🚚
                  <animateMotion dur="4s" repeatCount="indefinite">
                    <mpath href="#incoming-premium" />
                  </animateMotion>
                </text>
                <text fontSize="26" filter="drop-shadow(0 0 5px #f59e0b)">
                  🚚
                  <animateMotion dur="4s" repeatCount="indefinite" begin="2s">
                    <mpath href="#incoming-premium" />
                  </animateMotion>
                </text>
              </g>

              {/* Triage Mode: Show standard redirecting trucks cascading! */}
              {isWarning ? (
                <>
                  {cascadePaths.map(route => (
                     <g key={`truck-${route.pathId}`}>
                       <text fontSize="30" filter={`drop-shadow(0 0 10px ${route.isFallback ? '#f59e0b' : '#3b82f6'})`}>
                         🚚
                         <animateMotion dur="1.2s" repeatCount="indefinite">
                           <mpath href={`#${route.pathId}`} />
                         </animateMotion>
                       </text>
                       <text fontSize="30" filter={`drop-shadow(0 0 10px ${route.isFallback ? '#f59e0b' : '#3b82f6'})`}>
                         🚚
                         <animateMotion dur="1.2s" repeatCount="indefinite" begin="0.6s">
                           <mpath href={`#${route.pathId}`} />
                         </animateMotion>
                       </text>
                     </g>
                  ))}
                </>
              ) : (
                /* Normal Mode: Standard trucks incoming normally */
                <g>
                  <text fontSize="26" filter="drop-shadow(0 0 5px #3b82f6)">
                    🚚
                    <animateMotion dur="2s" repeatCount="indefinite">
                      <mpath href="#incoming-standard" />
                    </animateMotion>
                  </text>
                  <text fontSize="26" filter="drop-shadow(0 0 5px #3b82f6)">
                    🚚
                    <animateMotion dur="2s" repeatCount="indefinite" begin="1s">
                      <mpath href="#incoming-standard" />
                    </animateMotion>
                  </text>
                </g>
              )}
            </>
          )}

        </svg>

        {/* Dynamic Multi-Checkpoint Render rendering ALL Hubs! */}
        {Object.entries(HUB_COORDS).map(([id, pos]) => {
          const cap = liveCaps[id] ?? 0;
          const isActive = id === activeId;
          const isWarningStage = cap >= 75.0;
          const isCriticalStage = cap >= 90.0;
          
          let nodeClass = "map-node";
          if (isActive) nodeClass += " active-hub";
          else if (cascadePaths.some(p => p.to === id)) nodeClass += " secondary-hub"; // Highlight chain hubs
          else nodeClass += " background-hub";
          
          return (
            <div key={id} className={nodeClass} style={{ left: pos.x, top: pos.y, position: 'absolute', transform: 'translate(-50%, -50%)', zIndex: 2 }}>
               <div className="node-marker"></div>
               <div className="node-label-map">
                 {pos.label}
               </div>

               {/* SHOW CAPACITY FOR ALL CHECKPOINTS */}
               <div className="live-meter-map">
                 <div className="meter" style={{ '--level': `${cap}%`, width: '40px', background: 'rgba(255,255,255,0.05)' }}>
                   <div className="meter-fill" style={{ background: isCriticalStage ? '#ef4444' : isWarningStage ? '#f59e0b' : '#3b82f6' }}></div>
                 </div>
                 <div className="meter-text" style={{ color: isCriticalStage ? '#ef4444' : isWarningStage ? '#fcd34d' : '#93c5fd', fontSize: '10px'}}>
                   {cap.toFixed(1)}%
                 </div>
               </div>
            </div>
          );
        })}
      </div>
      
      <div className="sim-progress-bar">
         <div 
           className="sim-progress-fill" 
           style={{ width: `${(currentTickIndex / (hubData.ticks.length - 1)) * 100}%` }}
         ></div>
      </div>

      <div className="triage-legend" style={{ marginTop: '16px' }}>
        <div className="legend-item"><span className="dot gold"></span> Premium Inbound</div>
        <div className="legend-item"><span className="dot blue"></span> Primary Redirect</div>
        <div className="legend-item"><span className="dot gold"></span> Chain Fallback Redirect</div>
      </div>
    </div>
  );
};

export default SmartTriage;
