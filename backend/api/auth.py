"""Shared-secret gate (decisions record: defense-in-depth on top of this
service only ever being reachable from Next.js's own server, never a
browser - not a real auth system, just a check that the caller is who it
should be).

Reads the expected secret from the environment on every call rather than
caching it at import time, so tests can freely set/change
SOLVER_SHARED_SECRET per-test without needing to reload this module.

Fails closed: if the server has no secret configured at all, every request
is rejected rather than silently letting everything through.
"""

import os

from fastapi import Header, HTTPException

SHARED_SECRET_ENV_VAR = "SOLVER_SHARED_SECRET"
SHARED_SECRET_HEADER = "x-nextly-shared-secret"


def require_shared_secret(
    x_nextly_shared_secret: str = Header(default=""),
) -> None:
    expected = os.environ.get(SHARED_SECRET_ENV_VAR, "")
    if not expected or x_nextly_shared_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing shared secret")
