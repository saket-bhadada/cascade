"""
api_runner.py — Multi-Hub Service API
Simulates multiple hub locations and returns JSON with per-hub results.
Called by the Node.js server via child_process.
"""

import sys
import json
import numpy as np
from datetime import datetime, timedelta
from hub_service import (
    DelhiHubEnv, Parcel,
    PRIORITY_HIGH, PRIORITY_BUFFER,
    TIER_NORMAL_MAX, TIER_WARNING_MAX,
)

np.random.seed(42)

try:
    DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 10
except ValueError:
    DAYS = 10

SIM_START = datetime(2025, 10, 8, 0, 0)
SIM_END   = SIM_START + timedelta(days=DAYS) - timedelta(hours=1)

# ── Hub Definitions ──────────────────────────────────────────────────────────
HUBS = [
    {
        "id"              : "delhi",
        "name"            : "Delhi Hub Main",
        "region"          : "North India",
        "starting_cap"    : 40.0,
        "rate_normal"     : 8,
        "rate_surge"      : 22,
        "surge_start_day" : 12,
        "surge_end_day"   : 14,
        "capacity_cost"   : 0.15,
        "tags"            : ["High Volume", "Surge Zone", "Dussehra"],
    },
    {
        "id"              : "mumbai",
        "name"            : "Mumbai Port Hub",
        "region"          : "West India",
        "starting_cap"    : 55.0,
        "rate_normal"     : 12,
        "rate_surge"      : 19,
        "surge_start_day" : 10,
        "surge_end_day"   : 12,
        "capacity_cost"   : 0.13,
        "tags"            : ["Port Gateway", "High Baseline"],
    },
    {
        "id"              : "bangalore",
        "name"            : "Bangalore Tech Hub",
        "region"          : "South India",
        "starting_cap"    : 30.0,
        "rate_normal"     : 5,
        "rate_surge"      : 13,
        "surge_start_day" : 13,
        "surge_end_day"   : 15,
        "capacity_cost"   : 0.18,
        "tags"            : ["Low Volume", "Tech Zone"],
    },
    {
        "id"              : "chennai",
        "name"            : "Chennai South Hub",
        "region"          : "South India",
        "starting_cap"    : 45.0,
        "rate_normal"     : 7,
        "rate_surge"      : 16,
        "surge_start_day" : 11,
        "surge_end_day"   : 13,
        "capacity_cost"   : 0.14,
        "tags"            : ["Coastal Hub", "Mid Volume"],
    },
    {
        "id"              : "kolkata",
        "name"            : "Kolkata East Hub",
        "region"          : "East India",
        "starting_cap"    : 50.0,
        "rate_normal"     : 9,
        "rate_surge"      : 20,
        "surge_start_day" : 12,
        "surge_end_day"   : 15,
        "capacity_cost"   : 0.14,
        "tags"            : ["Extended Surge", "High Volume"],
    },
]

PRIORITY_WEIGHTS = [0.4, 0.6]
CAPACITY_RELIEF  = 0.15


# ── Dispatch Policy ──────────────────────────────────────────────────────────
def dispatch_policy(env, current_time):
    to_dispatch = []
    if env.is_normal:
        for p in env.parcels:
            if (p.sla_deadline - current_time).total_seconds() / 3600 <= 4:
                to_dispatch.append(p.parcel_id)
    elif env.is_warning:
        for p in env.parcels:
            if p.is_high_priority:
                if (p.sla_deadline - current_time).total_seconds() / 3600 <= 8:
                    to_dispatch.append(p.parcel_id)
            else:
                if current_time >= p.sla_deadline:
                    to_dispatch.append(p.parcel_id)
    else:
        for p in env.parcels:
            if p.is_high_priority:
                to_dispatch.append(p.parcel_id)
            else:
                if (p.sla_deadline - current_time).total_seconds() / 3600 <= 48:
                    to_dispatch.append(p.parcel_id)
    return to_dispatch


# ── Simulate one hub ─────────────────────────────────────────────────────────
def simulate_hub(hub_cfg):
    env            = DelhiHubEnv()
    env.hub_name   = hub_cfg["name"]
    env.capacity_pct = hub_cfg["starting_cap"]

    current_time   = SIM_START
    parcel_counter = 0
    ticks          = []

    while current_time <= SIM_END:
        is_surge = hub_cfg["surge_start_day"] <= current_time.day <= hub_cfg["surge_end_day"]
        rate     = hub_cfg["rate_surge"] if is_surge else hub_cfg["rate_normal"]
        n_arrive = int(np.random.poisson(rate))

        for _ in range(n_arrive):
            priority = np.random.choice([PRIORITY_HIGH, PRIORITY_BUFFER], p=PRIORITY_WEIGHTS)
            p = Parcel(f"{hub_cfg['id'].upper()}-{parcel_counter:07d}", priority, current_time)
            env.receive_parcel(p, capacity_cost=hub_cfg["capacity_cost"])
            parcel_counter += 1

        dispatched_ids   = dispatch_policy(env, current_time)
        dispatched_count = 0
        for pid in dispatched_ids:
            if env.dispatch_parcel(pid, capacity_relief=CAPACITY_RELIEF):
                dispatched_count += 1

        high_count = sum(1 for p in env.parcels if p.is_high_priority)
        buf_count  = len(env.parcels) - high_count

        ticks.append({
            "timestamp"          : current_time.isoformat(),
            "capacity_pct"       : round(env.capacity_pct, 2),
            "tier"               : env.tier,
            "is_surge"           : is_surge,
            "parcels_arrived"    : n_arrive,
            "parcels_dispatched" : dispatched_count,
            "parcels_in_hub"     : len(env.parcels),
            "high_priority_held" : high_count,
            "buffer_held"        : buf_count,
        })
        current_time += timedelta(hours=1)

    # ── Summary ──
    total_arr  = sum(t["parcels_arrived"]    for t in ticks)
    total_disp = sum(t["parcels_dispatched"] for t in ticks)
    peak_cap   = max(t["capacity_pct"]       for t in ticks)
    avg_cap    = round(sum(t["capacity_pct"] for t in ticks) / len(ticks), 2)
    remaining  = ticks[-1]["parcels_in_hub"]
    tier_counts = {}
    for t in ticks:
        tier_counts[t["tier"]] = tier_counts.get(t["tier"], 0) + 1

    # ── Critical Path ──
    critical_episodes = []
    in_crit = False
    ep_ticks = []
    for t in ticks:
        if t["tier"] == "Critical State":
            if not in_crit:
                in_crit  = True
                ep_ticks = []
            ep_ticks.append(t)
        else:
            if in_crit:
                _close_episode(critical_episodes, ep_ticks)
                in_crit  = False
                ep_ticks = []
    if in_crit and ep_ticks:
        _close_episode(critical_episodes, ep_ticks)

    # ── Determine hub-level status tag ──
    crit_hrs = tier_counts.get("Critical State", 0)
    if crit_hrs == 0:
        status = "STABLE"
    elif crit_hrs <= 12:
        status = "ELEVATED"
    elif crit_hrs <= 48:
        status = "WARNING"
    else:
        status = "CRITICAL"

    # Downsample ticks for the timeline (max 240 points)
    step = max(1, len(ticks) // 240)
    ticks_lite = [
        {k: v for k, v in t.items()}
        for t in ticks[::step]
    ]

    return {
        "id"                   : hub_cfg["id"],
        "name"                 : hub_cfg["name"],
        "region"               : hub_cfg["region"],
        "tags"                 : hub_cfg["tags"],
        "status"               : status,
        "current_tier"         : ticks[-1]["tier"],           # last tick tier
        "current_capacity_pct" : ticks[-1]["capacity_pct"],   # last tick capacity
        "summary": {
            "total_arrived"         : total_arr,
            "total_dispatched"      : total_disp,
            "remaining_in_hub"      : remaining,
            "peak_capacity_pct"     : peak_cap,
            "avg_capacity_pct"      : avg_cap,
            "tier_hours"            : tier_counts,
            "critical_episode_count": len(critical_episodes),
        },
        "ticks"          : ticks_lite,
        "critical_path"  : critical_episodes,
    }


def _close_episode(episodes, ep_ticks):
    peak_idx = max(range(len(ep_ticks)), key=lambda i: ep_ticks[i]["capacity_pct"])
    episodes.append({
        "episode_id"        : len(episodes) + 1,
        "start"             : ep_ticks[0]["timestamp"],
        "end"               : ep_ticks[-1]["timestamp"],
        "duration_hrs"      : len(ep_ticks),
        "peak_capacity_pct" : max(t["capacity_pct"] for t in ep_ticks),
        "peak_at"           : ep_ticks[peak_idx]["timestamp"],
        "peak_parcels"      : ep_ticks[peak_idx]["parcels_in_hub"],
        "peak_high_priority": ep_ticks[peak_idx]["high_priority_held"],
        "total_dispatched"  : sum(t["parcels_dispatched"] for t in ep_ticks),
        "total_arrived"     : sum(t["parcels_arrived"]    for t in ep_ticks),
        "is_surge_overlap"  : any(t["is_surge"] for t in ep_ticks),
        "capacity_curve"    : [
            t["capacity_pct"]
            for t in ep_ticks[::max(1, len(ep_ticks) // 60)]
        ],
    })


# ── Run all hubs ─────────────────────────────────────────────────────────────
results = []
for hub_cfg in HUBS:
    results.append(simulate_hub(hub_cfg))

output = {
    "days"    : DAYS,
    "sim_start": SIM_START.isoformat(),
    "sim_end"  : SIM_END.isoformat(),
    "hubs"    : results,
}

print(json.dumps(output))
