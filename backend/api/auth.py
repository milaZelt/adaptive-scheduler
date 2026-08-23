"""Checks a shared secret - an extra safety layer on top of this service
only ever being reachable from Next.js's own server, never a browser.
This is not real auth, just a check that the caller is who we expect.

We read the secret from the environment on every call instead of caching
it at import time. This lets tests freely change SOLVER_SHARED_SECRET per
test, without reloading this module.

Fails closed: if no secret is set on the server, every request is
rejected instead of silently allowed through.
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
