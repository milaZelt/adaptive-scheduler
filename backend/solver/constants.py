"""Global scheduling constants. These are fixed, non-user-configurable rules
(decisions record: 8AM-11PM window and 30-min break are global, not settings).
"""

MINUTES_PER_DAY = 24 * 60

# Solver's own scheduling window - distinct from the calendar grid's display
# range (frontend START_HOUR/END_HOUR = 6-23). These coincidentally share an
# endpoint but are unrelated concerns; do not couple them.
WINDOW_START_MIN = 8 * 60  # 8:00 AM
WINDOW_END_MIN = 23 * 60  # 11:00 PM

# Minimum gap required around any busy interval (fixed event, Google event,
# or another flexible session) before a flexible session may be placed.
PADDING_MIN = 30

# Time granularity, matches the frontend's existing 15-minute drag/resize snap.
SNAP_MIN = 15

# Technical bound on how many candidate sessions the solver considers per
# splittable task - not a product rule, just keeps the model's variable count
# bounded. Generous relative to realistic task sizes.
MAX_CANDIDATE_SESSIONS = 8

PRIORITY_ORDER = ["High", "Medium", "Low"]
