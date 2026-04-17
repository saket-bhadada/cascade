import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Configuration
HUBS_CONFIG = [
    {"name": "Delhi_Hub_Main",      "rate_normal": 8,  "rate_surge": 22, "surge_start": 12, "surge_end": 14, "cap_cost": 0.15},
    {"name": "Mumbai_Port_Hub",     "rate_normal": 12, "rate_surge": 19, "surge_start": 10, "surge_end": 12, "cap_cost": 0.13},
    {"name": "Bangalore_Tech_Hub",  "rate_normal": 5,  "rate_surge": 13, "surge_start": 13, "surge_end": 15, "cap_cost": 0.18},
    {"name": "Chennai_South_Hub",   "rate_normal": 7,  "rate_surge": 16, "surge_start": 11, "surge_end": 13, "cap_cost": 0.14},
    {"name": "Kolkata_East_Hub",    "rate_normal": 9,  "rate_surge": 20, "surge_start": 12, "surge_end": 15, "cap_cost": 0.14},
]

PRIORITY_TIERS = ['High_Priority_SLA', 'Standard_Buffer']
SIM_DAYS = 10
START_DATE = datetime(2025, 10, 8)

all_records = []

print("Generating parameterized multi-hub dataset...")

for hub in HUBS_CONFIG:
    print(f"  Processing {hub['name']}...")
    current_cap = 40.0 # Starting capacity
    
    for day_offset in range(SIM_DAYS):
        current_day = START_DATE + timedelta(days=day_offset)
        is_surge = hub['surge_start'] <= current_day.day <= hub['surge_end']
        rate = hub['rate_surge'] if is_surge else hub['rate_normal']
        
        # Generate hourly arrivals for this day
        for hour in range(24):
            timestamp = current_day + timedelta(hours=hour)
            n_arrivals = np.random.poisson(rate)
            
            for i in range(n_arrivals):
                priority = np.random.choice(PRIORITY_TIERS, p=[0.4, 0.6])
                
                # SLA Logic: High (24h), Buffer (72-96h)
                sla_val = 24 if priority == 'High_Priority_SLA' else np.random.randint(72, 97)
                sla_deadline = timestamp + timedelta(hours=sla_val)
                
                # Capacity Simulation (simplified for dataset generation)
                # In a real sim, capacity changes with dispatch. 
                # Here we simulate the state at arrival.
                arrival_cap = current_cap + np.random.uniform(-5, 5) # some variance
                arrival_cap = max(10, min(98, arrival_cap))
                
                # Dynamic Dispatch Logic (The "Model" result)
                # If capacity is high, we shift behavior
                if arrival_cap >= 75 and priority == 'Standard_Buffer':
                    status = 'Dispatched_Early_Shift'
                    dispatch_time = timestamp + timedelta(hours=np.random.randint(2, 6))
                elif arrival_cap >= 90 and priority == 'High_Priority_SLA':
                    status = 'Delayed'
                    dispatch_time = timestamp + timedelta(hours=np.random.randint(30, 48))
                else:
                    status = 'Dispatched_On_Time'
                    dispatch_time = sla_deadline - timedelta(hours=np.random.randint(4, 12))

                early_hrs = (sla_deadline - dispatch_time).total_seconds() / 3600 if status == 'Dispatched_Early_Shift' else 0

                all_records.append({
                    'parcel_id': f"{hub['name'][:3].upper()}-{len(all_records):07d}",
                    'hub_location': hub['name'],
                    'hub_arrival_time': timestamp,
                    'priority_tier': priority,
                    'original_sla_deadline': sla_deadline,
                    'current_hub_capacity_pct': arrival_cap,
                    'actual_dispatch_time': dispatch_time,
                    'dispatch_status': status,
                    'hours_delivered_early': round(max(0, early_hrs), 2)
                })
            
            # Evolution of base capacity across the day
            # If surge, capacity trends upward
            if is_surge:
                current_cap = min(95, current_cap + np.random.uniform(0.5, 2.0))
            else:
                current_cap = max(35, min(70, current_cap + np.random.uniform(-1.0, 1.0)))

df = pd.DataFrame(all_records)
df.to_csv('cascade_dynamic_sla_data.csv', index=False)
print(f"Dataset generated with {len(df):,} records across {len(HUBS_CONFIG)} hubs.")