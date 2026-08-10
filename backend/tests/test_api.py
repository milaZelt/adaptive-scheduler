"""Tests for the FastAPI wrapper layer (Ticket 3). Ticket 1's test_engine.py
already thoroughly proves the solver's actual scheduling behavior - these
tests focus on what's new at the HTTP boundary: auth enforcement, request
validation, and that the wrapping/serialization round-trip is correct
(checked against one known scenario from test_engine.py, not re-proving the
whole algorithm).
"""

import pytest
from fastapi.testclient import TestClient

from api.auth import SHARED_SECRET_ENV_VAR, SHARED_SECRET_HEADER
from api.main import app

TEST_SECRET = "test-shared-secret"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv(SHARED_SECRET_ENV_VAR, TEST_SECRET)
    return TestClient(app)


def auth_headers():
    return {SHARED_SECRET_HEADER: TEST_SECRET}


def non_splittable_task(task_id, priority, deadline_day, minutes):
    return {
        "id": task_id,
        "priority": priority,
        "deadline_day": deadline_day,
        "remaining_minutes": minutes,
        "min_session_minutes": minutes,
        "max_session_minutes": minutes,
        "splittable": False,
    }


# ---------------------------------------------------------------------------
# Health check - no auth required.
# ---------------------------------------------------------------------------


def test_health_check_requires_no_auth(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth enforcement.
# ---------------------------------------------------------------------------


def test_solve_rejects_missing_shared_secret(client):
    response = client.post("/solve", json={"horizon_days": 1, "busy_intervals": [], "tasks": []})
    assert response.status_code == 401


def test_solve_rejects_wrong_shared_secret(client):
    response = client.post(
        "/solve",
        json={"horizon_days": 1, "busy_intervals": [], "tasks": []},
        headers={SHARED_SECRET_HEADER: "wrong-value"},
    )
    assert response.status_code == 401


def test_solve_rejects_everything_when_no_secret_is_configured(monkeypatch):
    monkeypatch.delenv(SHARED_SECRET_ENV_VAR, raising=False)
    unconfigured_client = TestClient(app)
    response = unconfigured_client.post(
        "/solve",
        json={"horizon_days": 1, "busy_intervals": [], "tasks": []},
        headers={SHARED_SECRET_HEADER: ""},
    )
    assert response.status_code == 401


def test_solve_accepts_correct_shared_secret(client):
    response = client.post(
        "/solve",
        json={"horizon_days": 1, "busy_intervals": [], "tasks": []},
        headers=auth_headers(),
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Request validation - one case per rejection reason. Parametrized since
# every case follows the same "POST malformed body, expect 422" shape; only
# the body differs.
# ---------------------------------------------------------------------------

_DUPLICATE_TASK = non_splittable_task("dup", "High", deadline_day=0, minutes=60)

INVALID_REQUEST_CASES = {
    "deadline beyond horizon": {
        "horizon_days": 1,
        "busy_intervals": [],
        "tasks": [non_splittable_task("t1", "High", deadline_day=1, minutes=60)],
    },
    "duplicate task ids": {
        "horizon_days": 1,
        "busy_intervals": [],
        "tasks": [_DUPLICATE_TASK, _DUPLICATE_TASK],
    },
    "min session greater than max": {
        "horizon_days": 1,
        "busy_intervals": [],
        "tasks": [
            {
                "id": "t1",
                "priority": "High",
                "deadline_day": 0,
                "remaining_minutes": 60,
                "min_session_minutes": 90,
                "max_session_minutes": 30,
                "splittable": True,
            }
        ],
    },
    "busy interval ending before it starts": {
        "horizon_days": 1,
        "busy_intervals": [{"day": 0, "start_hour": 10.0, "end_hour": 9.0}],
        "tasks": [],
    },
    "busy interval day beyond horizon": {
        "horizon_days": 1,
        "busy_intervals": [{"day": 1, "start_hour": 9.0, "end_hour": 10.0}],
        "tasks": [],
    },
    "invalid priority value": {
        "horizon_days": 1,
        "busy_intervals": [],
        "tasks": [non_splittable_task("t1", "Urgent", deadline_day=0, minutes=60)],
    },
}


@pytest.mark.parametrize("body", INVALID_REQUEST_CASES.values(), ids=INVALID_REQUEST_CASES.keys())
def test_solve_rejects_invalid_request(client, body):
    response = client.post("/solve", json=body, headers=auth_headers())
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Round-trip correctness against a known solver scenario.
# ---------------------------------------------------------------------------


def test_solve_empty_tasks_returns_empty_result(client):
    response = client.post(
        "/solve",
        json={"horizon_days": 1, "busy_intervals": [], "tasks": []},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.json() == {"task_results": {}, "all_sessions": []}


def test_solve_matches_high_priority_wins_contested_slot_fixture(client):
    # Same scenario as test_engine.py's
    # test_high_priority_short_task_wins_contested_slot_over_medium_long_task
    # - proves the HTTP wrapping round-trip is correct, not re-proving the
    # solver logic itself (already covered thoroughly in test_engine.py).
    request_body = {
        "horizon_days": 1,
        "busy_intervals": [{"day": 0, "start_hour": 9.0, "end_hour": 21.5}],
        "tasks": [
            non_splittable_task("algorithms", "High", deadline_day=0, minutes=60),
            {
                "id": "reading",
                "priority": "Medium",
                "deadline_day": 0,
                "remaining_minutes": 90,
                "min_session_minutes": 30,
                "max_session_minutes": 60,
                "splittable": True,
            },
        ],
    }

    response = client.post("/solve", json=request_body, headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["task_results"]["algorithms"]["scheduled"] is True
    assert body["task_results"]["reading"]["scheduled"] is False
    algorithms_sessions = body["task_results"]["algorithms"]["sessions"]
    assert len(algorithms_sessions) == 1
    assert algorithms_sessions[0]["day"] == 0
    assert algorithms_sessions[0] in body["all_sessions"]
