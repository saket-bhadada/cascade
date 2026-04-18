"""
Hub Service — Full Simulation
==============================
Model Used: Rule-Based Threshold Policy (Deterministic Dispatch Model)

How it works:
  ┌─────────────────────────────────────────────────────────────────┐
  │  Tier             │ Capacity  │ Dispatch Policy                 │
  ├───────────────────┼───────────┼─────────────────────────────────│
  │  Normal Operations│  0 – 74%  │ Dispatch at SLA deadline        │
  │  Warning State    │ 75 – 89%  │ Expedite High-Priority only;    │
  │                   │           │ defer Standard Buffer           │
  │  Critical State   │  90%+     │ Force-dispatch ALL High-Priority │
  │                   │           │ immediately; dispatch Standard   │
  │                   │           │ Buffer early to free capacity   │
  └─────────────────────────────────────────────────────────────────┘

Simulation approach: Discrete-time, hourly time steps over a 10-day window
(October 8 – 17, 2025) with a natural surge on Oct 12–14 (Dussehra peak).
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from hub_service import (
    DelhiHubEnv, Parcel,
    PRIORITY_HIGH, PRIORITY_BUFFER,
    TIER_NORMAL_MAX, TIER_WARNING_MAX,
)

# ---------------------------------------------------------------------------
# Simulation Config
# ---------------------------------------------------------------------------

np.random.seed(42)

SIM_START          = datetime(2025, 10, 8, 0, 0)
SIM_END            = datetime(2025, 10, 17, 23, 0)   # 10-day window
TIME_STEP_HOURS    = 1                                # 1-hour ticks

# Arrival rate: parcels per hour (Poisson lambda)
ARRIVAL_RATE_NORMAL = 8      # baseline
ARRIVAL_RATE_SURGE  = 22     # Dussehra peak wave

SURGE_START_DAY    = 12      # October 12
SURGE_END_DAY      = 14      # October 14

# Capacity per parcel (% of hub)
CAPACITY_COST_PER_PARCEL    = 0.15
CAPACITY_RELIEF_PER_PARCEL  = 0.15

# Priority split: 40% High-Priority, 60% Standard Buffer
PRIORITY_WEIGHTS = [0.4, 0.6]


# ---------------------------------------------------------------------------
# Dispatch Policy (the "model")
# ---------------------------------------------------------------------------

def dispatch_policy(env: DelhiHubEnv, current_time: datetime) -> list[str]:
    """
    Rule-Based Threshold Policy — decides which parcels to dispatch this tick.

    Returns a list of parcel_ids to dispatch.
    """
    to_dispatch = []

    if env.is_normal:
        # ── Normal: dispatch parcels whose SLA deadline is within 4 hours ──
        for p in env.parcels:
            hours_to_deadline = (p.sla_deadline - current_time).total_seconds() / 3600
            if hours_to_deadline <= 4:
                to_dispatch.append(p.parcel_id)

    elif env.is_warning:
        # ── Warning: fast-track High-Priority; defer Standard Buffer ──
        for p in env.parcels:
            if p.is_high_priority:
                hours_to_deadline = (p.sla_deadline - current_time).total_seconds() / 3600
                if hours_to_deadline <= 8:       # expedite earlier than normal
                    to_dispatch.append(p.parcel_id)
            else:
                # Only dispatch Standard Buffer if already overdue
                if current_time >= p.sla_deadline:
                    to_dispatch.append(p.parcel_id)

    else:  # Critical
        # ── Critical: dispatch ALL High-Priority immediately
        #              dispatch Standard Buffer early to bleed capacity ──
        for p in env.parcels:
            if p.is_high_priority:
                to_dispatch.append(p.parcel_id)
            else:
                hours_to_deadline = (p.sla_deadline - current_time).total_seconds() / 3600
                if hours_to_deadline <= 48:      # push out Standard Buffer early
                    to_dispatch.append(p.parcel_id)

    return to_dispatch


# ---------------------------------------------------------------------------
# Simulation Runner
# ---------------------------------------------------------------------------

def run_simulation() -> pd.DataFrame:
    env          = DelhiHubEnv()
    current_time = SIM_START
    parcel_counter = 0
    records      = []   # per-tick snapshot

    print("=" * 60)
    print("  HUB SERVICE SIMULATION")
    print(f"  Model : Rule-Based Threshold Policy")
    print(f"  Period: {SIM_START:%Y-%m-%d} to {SIM_END:%Y-%m-%d}")
    print("=" * 60)

    while current_time <= SIM_END:
        # ── Determine arrival rate (surge on Oct 12-14) ──────────────
        is_surge = SURGE_START_DAY <= current_time.day <= SURGE_END_DAY
        rate     = ARRIVAL_RATE_SURGE if is_surge else ARRIVAL_RATE_NORMAL
        n_arrivals = np.random.poisson(rate)

        # ── Receive new parcels ───────────────────────────────────────
        for _ in range(n_arrivals):
            priority = np.random.choice(
                [PRIORITY_HIGH, PRIORITY_BUFFER], p=PRIORITY_WEIGHTS
            )
            p = Parcel(
                parcel_id    = f"PKG-{parcel_counter:07d}",
                priority     = priority,
                arrival_time = current_time,
            )
            env.receive_parcel(p, capacity_cost=CAPACITY_COST_PER_PARCEL)
            parcel_counter += 1

        # ── Apply dispatch policy ─────────────────────────────────────
        dispatched_ids = dispatch_policy(env, current_time)
        dispatched_count = 0
        for pid in dispatched_ids:
            result = env.dispatch_parcel(pid, capacity_relief=CAPACITY_RELIEF_PER_PARCEL)
            if result:
                dispatched_count += 1

        # ── Record snapshot ───────────────────────────────────────────
        high_count = sum(1 for p in env.parcels if p.is_high_priority)
        buf_count  = len(env.parcels) - high_count

        records.append({
            "timestamp"         : current_time,
            "capacity_pct"      : round(env.capacity_pct, 2),
            "tier"              : env.tier,
            "is_surge"          : is_surge,
            "parcels_arrived"   : n_arrivals,
            "parcels_dispatched": dispatched_count,
            "parcels_in_hub"    : len(env.parcels),
            "high_priority_held": high_count,
            "buffer_held"       : buf_count,
        })

        # ── Print hourly summary (every 6 hours for readability) ──────
        if current_time.hour % 6 == 0:
            tier_tag = {"Normal Operations": "[OK]", "Warning State": "[WARN]", "Critical State": "[CRIT]"}.get(env.tier, "")
            print(
                f"  {current_time:%b %d %H:%M}  {tier_tag:<7} {env.tier:<20} "
                f"Cap: {env.capacity_pct:5.1f}%  "
                f"In-Hub: {len(env.parcels):4d}  "
                f"Arrived: {n_arrivals:3d}  Dispatched: {dispatched_count:3d}"
                + ("  ** SURGE **" if is_surge else "")
            )

        current_time += timedelta(hours=TIME_STEP_HOURS)

    return pd.DataFrame(records), env


# ---------------------------------------------------------------------------
# Results Summary
# ---------------------------------------------------------------------------

def print_summary(df: pd.DataFrame, env: DelhiHubEnv):
    print("\n" + "=" * 60)
    print("  SIMULATION RESULTS SUMMARY")
    print("=" * 60)

    total_ticks    = len(df)
    total_arrived  = df['parcels_arrived'].sum()
    total_dispatch = df['parcels_dispatched'].sum()
    remaining      = df['parcels_in_hub'].iloc[-1]
    peak_capacity  = df['capacity_pct'].max()
    avg_capacity   = df['capacity_pct'].mean()

    tier_counts = df['tier'].value_counts()
    normal_hrs  = tier_counts.get("Normal Operations", 0)
    warning_hrs = tier_counts.get("Warning State", 0)
    critical_hrs= tier_counts.get("Critical State", 0)

    print(f"\n  Total Parcels Arrived    : {total_arrived:,}")
    print(f"  Total Parcels Dispatched : {total_dispatch:,}")
    print(f"  Parcels Still in Hub     : {remaining:,}")
    print(f"  Peak Capacity            : {peak_capacity:.1f}%")
    print(f"  Avg Capacity             : {avg_capacity:.1f}%")
    print(f"\n  Time in Each Tier (hours):")
    print(f"    [OK]   Normal Operations : {normal_hrs:4d} hrs  ({normal_hrs/total_ticks*100:.1f}%)")
    print(f"    [WARN] Warning State     : {warning_hrs:4d} hrs  ({warning_hrs/total_ticks*100:.1f}%)")
    print(f"    [CRIT] Critical State    : {critical_hrs:4d} hrs  ({critical_hrs/total_ticks*100:.1f}%)")

    print("\n" + "=" * 60)
    print("  MODEL USED")
    print("=" * 60)
    lines = [
        "",
        "  >>  Rule-Based Threshold Policy (Deterministic Dispatch Model)",
        "",
        "  This is NOT a machine learning model. It uses hard-coded",
        "  operational rules driven by capacity thresholds:",
        "",
        "  +------------------+----------+----------------------------------+",
        "  | Tier             | Capacity | Action                           |",
        "  +------------------+----------+----------------------------------+",
        "  | Normal Operations|  0-74%   | Dispatch <=4 hrs to SLA deadline |",
        "  | Warning State    | 75-89%   | Expedite High-Priority;          |",
        "  |                  |          | defer Standard Buffer            |",
        "  | Critical State   |  90%+    | Force-dispatch all High-Priority;|",
        "  |                  |          | early-dispatch Standard Buffer   |",
        "  +------------------+----------+----------------------------------+",
        "",
        "  Suitable as a BASELINE before training a Reinforcement",
        "  Learning or optimization model on the generated data.",
        "",
    ]
    print("\n".join(lines))


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    df, env = run_simulation()

    print_summary(df, env)

    # Save tick-by-tick results
    out_path = "simulation_results.csv"
    df.to_csv(out_path, index=False)
    print(f"\n  Full tick log saved -> {out_path}")

    # Tier breakdown by day
    df['date'] = df['timestamp'].dt.date
    daily = df.groupby(['date', 'tier']).size().unstack(fill_value=0)
    print("\n  Daily Tier Hours:")
    print(daily.to_string())
