"""
Hub Service
===========
Models the Delhi Hub's operational state with:
  - Starting capacity : 40%
  - Capacity tiers    : Normal (0-74%) | Warning (75-89%) | Critical (90%+)
  - Inventory streams : High-Priority SLA | Standard Buffer
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Literal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HUB_NAME = "Delhi_Hub_Main"

STARTING_CAPACITY_PCT: float = 40.0          # Hub always boots at 40 %

# Capacity tier boundaries
TIER_NORMAL_MAX: float   = 74.99             # 0 – 74 %  → Normal Operations
TIER_WARNING_MAX: float  = 89.99             # 75 – 89 % → Warning State
# Anything >= 90 %                            → Critical State

PRIORITY_HIGH    = "High_Priority_SLA"       # Must deliver today
PRIORITY_BUFFER  = "Standard_Buffer"         # Can be delivered later

# SLA windows (hours from arrival)
SLA_HIGH_HOURS: int   = 24                   # High-Priority due in 24 h
SLA_BUFFER_MIN: int   = 72                   # Standard Buffer due in 72–96 h
SLA_BUFFER_MAX: int   = 96


# ---------------------------------------------------------------------------
# Capacity Tier Helper
# ---------------------------------------------------------------------------

def get_tier(capacity_pct: float) -> str:
    """
    Return the operational tier name for a given capacity percentage.

    Args:
        capacity_pct: Hub capacity as a percentage (0.0 – 100.0)

    Returns:
        One of: 'Normal Operations' | 'Warning State' | 'Critical State'
    """
    if capacity_pct <= TIER_NORMAL_MAX:
        return "Normal Operations"
    elif capacity_pct <= TIER_WARNING_MAX:
        return "Warning State"
    else:
        return "Critical State"


# ---------------------------------------------------------------------------
# Parcel Dataclass
# ---------------------------------------------------------------------------

@dataclass
class Parcel:
    """Represents a single parcel entering the hub."""
    parcel_id: str
    priority: Literal["High_Priority_SLA", "Standard_Buffer"]
    arrival_time: datetime
    sla_deadline: datetime = field(init=False)

    def __post_init__(self):
        if self.priority == PRIORITY_HIGH:
            self.sla_deadline = self.arrival_time + timedelta(hours=SLA_HIGH_HOURS)
        else:
            buffer_hours = np.random.randint(SLA_BUFFER_MIN, SLA_BUFFER_MAX + 1)
            self.sla_deadline = self.arrival_time + timedelta(hours=buffer_hours)

    @property
    def is_high_priority(self) -> bool:
        return self.priority == PRIORITY_HIGH

    def __repr__(self):
        return (
            f"Parcel({self.parcel_id} | {self.priority} | "
            f"Arrival: {self.arrival_time:%Y-%m-%d %H:%M} | "
            f"SLA: {self.sla_deadline:%Y-%m-%d %H:%M})"
        )


# ---------------------------------------------------------------------------
# Delhi Hub Environment
# ---------------------------------------------------------------------------

class DelhiHubEnv:
    """
    Simulates the Delhi Hub operational environment.

    Attributes:
        capacity_pct  : Current fill level of the hub (starts at 40 %)
        parcels       : All parcels currently held in the hub
        event_log     : Timestamped record of every state change
    """

    def __init__(self):
        self.hub_name: str        = HUB_NAME
        self.capacity_pct: float  = STARTING_CAPACITY_PCT
        self.parcels: List[Parcel] = []
        self.event_log: List[dict] = []
        self._log_event("HUB_INIT", f"Hub initialised at {self.capacity_pct:.1f}% capacity.")

    # ------------------------------------------------------------------
    # Tier Properties
    # ------------------------------------------------------------------

    @property
    def tier(self) -> str:
        """Current operational tier based on capacity."""
        return get_tier(self.capacity_pct)

    @property
    def is_normal(self) -> bool:
        return self.capacity_pct <= TIER_NORMAL_MAX

    @property
    def is_warning(self) -> bool:
        return TIER_NORMAL_MAX < self.capacity_pct <= TIER_WARNING_MAX

    @property
    def is_critical(self) -> bool:
        return self.capacity_pct > TIER_WARNING_MAX

    # ------------------------------------------------------------------
    # Parcel Operations
    # ------------------------------------------------------------------

    def receive_parcel(self, parcel: Parcel, capacity_cost: float = 0.001) -> None:
        """
        Accept a parcel into the hub and update capacity.

        Args:
            parcel        : The incoming Parcel object
            capacity_cost : % capacity increase per parcel received
        """
        self.parcels.append(parcel)
        self.capacity_pct = min(100.0, self.capacity_pct + capacity_cost)
        self._log_event(
            "PARCEL_IN",
            f"Received {parcel.parcel_id} [{parcel.priority}] | "
            f"Capacity → {self.capacity_pct:.2f}% [{self.tier}]"
        )

    def dispatch_parcel(self, parcel_id: str, capacity_relief: float = 0.001) -> Parcel | None:
        """
        Remove a parcel from the hub (dispatch) and reduce capacity.

        Args:
            parcel_id      : ID of the parcel to dispatch
            capacity_relief: % capacity freed per parcel dispatched

        Returns:
            The dispatched Parcel, or None if not found
        """
        for i, p in enumerate(self.parcels):
            if p.parcel_id == parcel_id:
                self.parcels.pop(i)
                self.capacity_pct = max(0.0, self.capacity_pct - capacity_relief)
                self._log_event(
                    "PARCEL_OUT",
                    f"Dispatched {parcel_id} [{p.priority}] | "
                    f"Capacity → {self.capacity_pct:.2f}% [{self.tier}]"
                )
                return p
        self._log_event("PARCEL_NOT_FOUND", f"Parcel {parcel_id} not found in hub.")
        return None

    def set_capacity(self, new_pct: float) -> None:
        """Manually override hub capacity (e.g., to simulate surges)."""
        old = self.capacity_pct
        self.capacity_pct = max(0.0, min(100.0, new_pct))
        self._log_event(
            "CAPACITY_SET",
            f"Capacity changed {old:.1f}% → {self.capacity_pct:.1f}% [{self.tier}]"
        )

    # ------------------------------------------------------------------
    # Inventory Summary
    # ------------------------------------------------------------------

    def inventory_summary(self) -> pd.DataFrame:
        """Return a DataFrame summarising parcels by priority tier."""
        if not self.parcels:
            return pd.DataFrame(columns=['priority', 'count'])
        rows = [{'parcel_id': p.parcel_id, 'priority': p.priority,
                 'arrival_time': p.arrival_time, 'sla_deadline': p.sla_deadline}
                for p in self.parcels]
        return pd.DataFrame(rows)

    def status(self) -> str:
        """Return a human-readable status string."""
        high = sum(1 for p in self.parcels if p.is_high_priority)
        buf  = len(self.parcels) - high
        return (
            f"\n{'='*55}\n"
            f"  Hub       : {self.hub_name}\n"
            f"  Capacity  : {self.capacity_pct:.1f}%\n"
            f"  Tier      : {self.tier}\n"
            f"  Parcels   : {len(self.parcels)} total "
            f"({high} High-Priority | {buf} Standard Buffer)\n"
            f"{'='*55}"
        )

    # ------------------------------------------------------------------
    # Event Log
    # ------------------------------------------------------------------

    def _log_event(self, event_type: str, message: str) -> None:
        self.event_log.append({
            "timestamp"  : datetime.now().isoformat(timespec='seconds'),
            "event_type" : event_type,
            "message"    : message
        })

    def get_event_log(self) -> pd.DataFrame:
        """Return the full event log as a DataFrame."""
        return pd.DataFrame(self.event_log)


# ---------------------------------------------------------------------------
# Quick Demo (run this file directly to verify)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    env = DelhiHubEnv()  # hub_service
    print(env.status())

    base_time = datetime(2025, 10, 8, 6, 0)

    # --- Receive a mix of parcels
    sample_parcels = [
        Parcel(f"PKG-{i:04d}",
               np.random.choice([PRIORITY_HIGH, PRIORITY_BUFFER], p=[0.4, 0.6]),
               base_time + timedelta(hours=i))
        for i in range(10)
    ]
    for p in sample_parcels:
        env.receive_parcel(p)

    print(env.status())

    # --- Simulate a surge → push into Warning then Critical
    print("\n[Simulating capacity surge...]")
    env.set_capacity(76.0)   # → Warning State
    print(f"  After surge: {env.capacity_pct:.1f}% → {env.tier}")
    env.set_capacity(92.0)   # → Critical State
    print(f"  After surge: {env.capacity_pct:.1f}% → {env.tier}")

    # --- Dispatch a parcel
    env.dispatch_parcel("PKG-0003")
    print(env.status())

    # --- Inventory breakdown
    print("\nInventory Summary:")
    print(env.inventory_summary().to_string(index=False))

    # --- Event log tail
    print("\nEvent Log (last 5):")
    print(env.get_event_log().tail(5).to_string(index=False))
