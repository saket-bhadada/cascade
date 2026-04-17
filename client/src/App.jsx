import { useState, useCallback } from 'react'
import './index.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── Helpers ───────────────────────────────────────────────────────────────
function tierCls(tier) {
  if (tier === 'Normal Operations') return 'ok'
  if (tier === 'Warning State')     return 'warn'
  return 'crit'
}
function statusCls(s) { return (s || '').toLowerCase() }

function fmtNum(n) { return n?.toLocaleString() ?? '—' }

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2,'0')}:00`
}

function tagClass(tag) {
  const t = tag.toLowerCase()
  if (t.includes('surge') || t.includes('dussehra') || t.includes('extended')) return 'surge'
  if (t.includes('critical')) return 'crit'
  return ''
}

// ── Timeline Chart ─────────────────────────────────────────────────────────
function Timeline({ ticks }) {
  if (!ticks?.length) return null
  const max = Math.max(...ticks.map(t => t.capacity_pct))
  const step = Math.max(1, Math.floor(ticks.length / 200))
  const bars = ticks.filter((_, i) => i % step === 0)
  const labels = [0, Math.floor(bars.length/4), Math.floor(bars.length/2),
                  Math.floor(3*bars.length/4), bars.length-1]
  return (
    <>
      <div className="timeline">
        {bars.map((t, i) => (
          <div
            key={i}
            className={`tbar ${tierCls(t.tier)}`}
            style={{ height: `${(t.capacity_pct / max) * 100}%` }}
            title={`${fmtTime(t.timestamp)}: ${t.capacity_pct}%${t.is_surge ? ' ⚡' : ''}`}
          />
        ))}
      </div>
      <div className="tl-axis">
        {labels.map(i => bars[i] ?
          <span key={i}>{fmtTime(bars[i].timestamp)}</span> : null
        )}
      </div>
    </>
  )
}

// ── Critical Path ──────────────────────────────────────────────────────────
function CriticalPath({ episodes }) {
  if (!episodes?.length) {
    return (
      <div style={{ padding: '14px 0', color: 'var(--ok)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>✓</span> No critical episodes — hub stayed below 90% throughout.
      </div>
    )
  }
  const worst = episodes.reduce((a, b) => b.peak_capacity_pct > a.peak_capacity_pct ? b : a)
  const totalHrs = episodes.reduce((a, b) => a + b.duration_hrs, 0)

  return (
    <>
      <div className="cp-banner">
        <div>
          <div className="cp-banner-info">
            {episodes.length} critical episode{episodes.length > 1 ? 's' : ''} &nbsp;·&nbsp; {totalHrs} hrs total
          </div>
          <div className="cp-banner-sub">
            Worst: {fmtTime(worst.peak_at)} at {worst.peak_capacity_pct.toFixed(1)}%
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--crit)', letterSpacing: 1 }}>
          {episodes.length} EPISODE{episodes.length > 1 ? 'S' : ''}
        </span>
      </div>

      <div className="cp-episodes">
        {episodes.map(ep => (
          <div key={ep.episode_id} className={`cp-episode${ep.episode_id === worst.episode_id ? ' worst' : ''}`}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>START</div>
              <div className="cp-ep-time">{fmtTime(ep.start)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>END</div>
              <div className="cp-ep-time">{fmtTime(ep.end)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>DURATION</div>
              <div className="cp-ep-dur">{ep.duration_hrs}h</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                PEAK {ep.peak_capacity_pct.toFixed(1)}%
              </div>
              <div className="cp-sparkbar">
                <div className="cp-sparkbar-fill" style={{ width: `${ep.peak_capacity_pct}%` }} />
              </div>
            </div>
            <div className="cp-ep-tags">
              {ep.is_surge_overlap &&
                <span className="tag surge">SURGE</span>}
              {ep.episode_id === worst.episode_id &&
                <span className="tag crit">WORST</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Hub View ───────────────────────────────────────────────────────────────
function HubView({ hub }) {
  const s = hub.summary
  const tierHrs = s.tier_hours ?? {}
  const last = hub.ticks?.[hub.ticks.length - 1]

  return (
    <>
      {/* Hub info header */}
      <div className="hub-header">
        <div>
          <div className="hub-name">{hub.name}</div>
          <div className="hub-region">{hub.region}</div>
          <div className="tags">
            {hub.tags.map(tag => (
              <span key={tag} className={`tag ${tagClass(tag)}`}>{tag}</span>
            ))}
          </div>
        </div>
        <span className={`status-badge ${statusCls(hub.status)}`}>
          {hub.status}
        </span>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Arrived</div>
          <div className="stat-value accent">{fmtNum(s.total_arrived)}</div>
          <div className="stat-sub">parcels received</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Dispatched</div>
          <div className="stat-value ok">{fmtNum(s.total_dispatched)}</div>
          <div className="stat-sub">sent out</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Hub</div>
          <div className="stat-value">{fmtNum(s.remaining_in_hub)}</div>
          <div className="stat-sub">remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Peak Cap</div>
          <div className={`stat-value ${s.peak_capacity_pct >= 90 ? 'crit' : s.peak_capacity_pct >= 75 ? 'warn' : 'ok'}`}>
            {s.peak_capacity_pct?.toFixed(1)}%
          </div>
          <div className="stat-sub">maximum load</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Cap</div>
          <div className="stat-value">{s.avg_capacity_pct?.toFixed(1)}%</div>
          <div className="stat-sub">across sim</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current</div>
          <div className={`stat-value ${tierCls(last?.tier)}`}>
            {last?.capacity_pct?.toFixed(1) ?? '—'}%
          </div>
          <div className="stat-sub">{last?.tier ?? '—'}</div>
        </div>
      </div>

      {/* Tier pills */}
      <div className="tier-pills">
        <span className="tier-pill ok">Normal: {tierHrs['Normal Operations'] ?? 0} hrs</span>
        <span className="tier-pill warn">Warning: {tierHrs['Warning State'] ?? 0} hrs</span>
        <span className="tier-pill crit">Critical: {tierHrs['Critical State'] ?? 0} hrs</span>
      </div>

      {/* Capacity Timeline */}
      <div className="card">
        <div className="card-title">Capacity Timeline — colour = tier</div>
        <Timeline ticks={hub.ticks} />
      </div>

      {/* Critical Path */}
      <div className="card">
        <div className="card-title">Critical Path (≥ 90% capacity)</div>
        <CriticalPath episodes={hub.critical_path} />
      </div>
    </>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [days,    setDays]    = useState(10)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [activeId, setActiveId] = useState(null)

  const runSim = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/simulate?days=${days}`)
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Server error')
      }
      const json = await res.json()
      setData(json)
      setActiveId(json.hubs?.[0]?.id ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  const hubs      = data?.hubs ?? []
  const activeHub = hubs.find(h => h.id === activeId) ?? hubs[0] ?? null

  return (
    <>
      {/* Header */}
      <div className="header">
        <div>
          <div className="header-title">Hub Service Dashboard</div>
          <div className="header-sub">
            Rule-Based Threshold Policy · 5 hub locations
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            id="days-select"
            className="days-select"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            {[3, 5, 7, 10, 14, 21, 30].map(d =>
              <option key={d} value={d}>{d} days</option>
            )}
          </select>
          <button id="run-btn" className="run-btn" onClick={runSim} disabled={loading}>
            {loading
              ? <><div className="spinner" /> Running…</>
              : '▶ Run Simulation'}
          </button>
        </div>
      </div>

      {error && <div className="error-bar">⚠ {error}</div>}

      {/* Empty state */}
      {!data && !loading && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No data yet</h3>
          <p>Select a window and run the simulation to see all hub locations.</p>
        </div>
      )}

      {/* Hub tabs + view */}
      {data && (
        <>
          <div className="hub-tabs">
            {hubs.map(h => (
              <button
                id={`tab-${h.id}`}
                key={h.id}
                className={`hub-tab${h.id === activeId ? ' active' : ''}`}
                onClick={() => setActiveId(h.id)}
              >
                <span
                  className={`hub-tab-dot ${tierCls(h.current_tier)}`}
                  title={`${h.current_tier} — ${h.current_capacity_pct}%`}
                />
                {h.name}
              </button>
            ))}
          </div>

          {activeHub && <HubView hub={activeHub} />}
        </>
      )}
    </>
  )
}
