import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Configuration
NUM_RECORDS = 100000
HUBS = ['Delhi_Hub_Main']
PRIORITY_TIERS = ['High_Priority_SLA', 'Standard_Buffer']
DISPATCH_STATUS = ['Dispatched_On_Time', 'Dispatched_Early_Shift', 'Delayed']

# 1. Base Timestamps (October Peak Season)
start_date = datetime(2025, 10, 8)
arrival_times = [start_date + timedelta(hours=np.random.randint(0, 240)) for _ in range(NUM_RECORDS)]

data = {
    'parcel_id': [f'PKG-{i:07d}' for i in range(NUM_RECORDS)],
    'hub_location': 'Delhi_Hub_Main',
    'hub_arrival_time': sorted(arrival_times),
    'priority_tier': np.random.choice(PRIORITY_TIERS, NUM_RECORDS, p=[0.4, 0.6]) # 60% are standard buffer
}
df = pd.DataFrame(data)

# 2. Original SLA Deadlines
# High Priority = Due in 24 hours. Buffer = Due in 72-96 hours.
df['original_sla_deadline'] = df['hub_arrival_time'] + pd.to_timedelta(
    np.where(df['priority_tier'] == 'High_Priority_SLA', 24, np.random.randint(72, 96, NUM_RECORDS)), unit='h'
)

# 3. Simulate Hub Capacity (The Trigger)
# Creating a massive wave around October 12th - 14th
df['current_hub_capacity_pct'] = np.random.uniform(40, 70, NUM_RECORDS)
surge_mask = (df['hub_arrival_time'].dt.day >= 12) & (df['hub_arrival_time'].dt.day <= 14)
df.loc[surge_mask, 'current_hub_capacity_pct'] = np.random.uniform(75, 95, surge_mask.sum())

# 4. Dynamic SLA Shifting Logic
# If capacity > 75% AND the parcel is a "Standard_Buffer" (not due for days), push it out NOW.
cond_early   = (df['current_hub_capacity_pct'] >= 75) & (df['priority_tier'] == 'Standard_Buffer')
cond_delayed = (df['current_hub_capacity_pct'] >= 90) & (df['priority_tier'] == 'High_Priority_SLA')
cond_ontime  = (df['current_hub_capacity_pct'] < 75)

time_early   = df['hub_arrival_time'] + pd.to_timedelta(np.random.randint(2, 6, NUM_RECORDS), unit='h')
time_delayed = df['hub_arrival_time'] + pd.to_timedelta(np.random.randint(30, 48, NUM_RECORDS), unit='h')
time_ontime  = df['original_sla_deadline'] - pd.to_timedelta(np.random.randint(4, 12, NUM_RECORDS), unit='h')

# Use pandas .where() chaining — avoids numpy dtype mismatch with datetime64
df['actual_dispatch_time'] = (
    time_early.where(cond_early,
    time_delayed.where(cond_delayed,
    time_ontime))
)

df['dispatch_status'] = (
    pd.Series('Dispatched_Early_Shift', index=df.index).where(cond_early,
    pd.Series('Delayed', index=df.index).where(cond_delayed,
    'Dispatched_On_Time'))
)

# 5. Calculate the Metrics for the Judges
df['hours_delivered_early'] = np.where(
    df['dispatch_status'] == 'Dispatched_Early_Shift',
    (df['original_sla_deadline'] - df['actual_dispatch_time']).dt.total_seconds() / 3600,
    0
)

df.to_csv('cascade_dynamic_sla_data.csv', index=False)
print("Dynamic SLA Dataset generated successfully.")