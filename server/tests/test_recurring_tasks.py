import pytest
from datetime import date, timedelta
from app.models.projects import Task
from tests.conftest import DEFAULT_PASSWORD, auth_headers, login


def test_daily_recurring_personal_task_spawns_next_occurrence(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # 1. Create a personal task with daily recurrence
    create_payload = {
        "title": "Daily Standup Routine",
        "priority": "HIGH",
        "planned_date": "2026-11-05",
        "due_date": "2026-11-05",
        "recurrence_rule": {
            "pattern": "daily",
            "interval": 1,
            "mode": "after-completion",
        },
    }
    c_resp = seeded_client.post("/api/v1/tasks/personal/create", json=create_payload, headers=headers)
    assert c_resp.status_code in [200, 201], c_resp.text
    task_data = c_resp.json()
    task_id = task_data["id"]

    # 2. Mark the task completed
    u_resp = seeded_client.put(
        f"/api/v1/tasks/personal/{task_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert u_resp.status_code == 200, u_resp.text
    assert u_resp.json()["is_completed"] is True

    # 3. Query all tasks via API
    list_resp = seeded_client.get("/api/v1/tasks/personal/list?include_completed=true", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    tasks_list = list_resp.json()
    series_tasks = [t for t in tasks_list if t.get("recurring_task_id") == task_id or t.get("id") == task_id]

    assert len(series_tasks) == 2, f"Expected 2 tasks in series, got {len(series_tasks)}: {tasks_list}"

    original_task = [t for t in series_tasks if t["id"] == task_id][0]
    next_task = [t for t in series_tasks if t["id"] != task_id][0]

    assert original_task["is_completed"] is True
    assert next_task["is_completed"] is False
    assert next_task["recurring_task_id"] == task_id
    assert next_task["title"] == "Daily Standup Routine"
    assert next_task["recurrence_rule"] is not None
    assert next_task["planned_date"] is not None
    # Next date should be advanced
    assert next_task["planned_date"] > original_task["planned_date"]


def test_weekly_recurring_type_format(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # Test type format: {"type": "Weekly", "interval": 1}
    create_payload = {
        "title": "Weekly Report",
        "priority": "NORMAL",
        "due_date": "2026-11-05",
        "planned_date": "2026-11-05",
        "recurrence_rule": {
            "type": "Weekly",
            "interval": 1,
        },
    }
    c_resp = seeded_client.post("/api/v1/tasks/personal/create", json=create_payload, headers=headers)
    assert c_resp.status_code in [200, 201]
    task_id = c_resp.json()["id"]

    # Complete it
    u_resp = seeded_client.put(
        f"/api/v1/tasks/personal/{task_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert u_resp.status_code == 200

    list_resp = seeded_client.get("/api/v1/tasks/personal/list?include_completed=true", headers=headers)
    assert list_resp.status_code == 200
    series_tasks = [t for t in list_resp.json() if t.get("recurring_task_id") == task_id or t.get("id") == task_id]
    assert len(series_tasks) == 2
    spawned = [t for t in series_tasks if t["id"] != task_id][0]
    assert spawned["is_completed"] is False
    assert spawned["due_date"] > "2026-11-05"


def test_recurrence_end_date_enforced(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # Recurrence end date set to same day
    create_payload = {
        "title": "Final Day Task",
        "priority": "LOW",
        "due_date": "2026-11-05",
        "planned_date": "2026-11-05",
        "recurrence_rule": {"pattern": "daily", "interval": 1},
        "recurrence_end_date": "2026-11-05",
    }
    c_resp = seeded_client.post("/api/v1/tasks/personal/create", json=create_payload, headers=headers)
    assert c_resp.status_code in [200, 201]
    task_id = c_resp.json()["id"]

    # Complete it
    u_resp = seeded_client.put(
        f"/api/v1/tasks/personal/{task_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert u_resp.status_code == 200

    # Next date would exceed recurrence_end_date, so no new task should be spawned
    list_resp = seeded_client.get("/api/v1/tasks/personal/list?include_completed=true", headers=headers)
    series_tasks = [t for t in list_resp.json() if t.get("recurring_task_id") == task_id or t.get("id") == task_id]
    assert len(series_tasks) == 1


def test_duplicate_spawn_prevention_on_recomplete(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    create_payload = {
        "title": "Idempotent Recurrence Task",
        "priority": "NORMAL",
        "due_date": "2026-11-05",
        "recurrence_rule": {"pattern": "daily", "interval": 1},
    }
    c_resp = seeded_client.post("/api/v1/tasks/personal/create", json=create_payload, headers=headers)
    assert c_resp.status_code in [200, 201]
    task_id = c_resp.json()["id"]

    # 1. Complete -> spawns occurrence #2
    seeded_client.put(f"/api/v1/tasks/personal/{task_id}", json={"is_completed": True}, headers=headers)

    # 2. Reopen
    seeded_client.put(f"/api/v1/tasks/personal/{task_id}", json={"is_completed": False}, headers=headers)

    # 3. Complete again -> should NOT spawn duplicate occurrence #3 because #2 is still active/uncompleted
    seeded_client.put(f"/api/v1/tasks/personal/{task_id}", json={"is_completed": True}, headers=headers)

    list_resp = seeded_client.get("/api/v1/tasks/personal/list?include_completed=true", headers=headers)
    series_tasks = [t for t in list_resp.json() if t.get("recurring_task_id") == task_id or t.get("id") == task_id]
    assert len(series_tasks) == 2, f"Expected exactly 2 tasks in series, got {len(series_tasks)}"
