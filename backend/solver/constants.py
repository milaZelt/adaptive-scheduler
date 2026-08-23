"""Global scheduling constants - fixed rules, not user-configurable settings."""

MINUTES_PER_DAY = 24 * 60

# The solver's own time window - separate from the frontend calendar's
# display range. The end time matches by coincidence only - don't link
# them.
WINDOW_START_MIN = 8 * 60  # 8:00 AM
WINDOW_END_MIN = 23 * 60  # 11:00 PM

# Minimum gap required around any busy time - a fixed event, a Google
# event, or another flexible session.
PADDING_MIN = 30

# Time step size - matches the frontend's 15-minute drag/resize snap.
SNAP_MIN = 15

# Max number of candidate sessions per splittable task. Just keeps the
# model size bounded, not a product rule - generous for real task sizes.
MAX_CANDIDATE_SESSIONS = 8

# Keep this in sync with types.py's FlexibleTaskInput.priority comment and
# api/schemas.py's Priority literal - all three list the same values.
PRIORITY_ORDER = ["High", "Medium", "Low"]
