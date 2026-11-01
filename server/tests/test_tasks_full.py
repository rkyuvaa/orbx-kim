import pytest
from app.models.enums import UserRole
from app.models.cost_center import CostCenter
from app.models.notification import Notification
from tests.conftest import DEFAULT_PASSWORD, auth_headers, login


def test_tasks_subtasks_comments_attachments_full_crud(seeded_client, db):
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # 1. First create a Project
    p_resp = seeded_client.post("/api/v1/projects", json={"name": "Task System Test Project"}, headers=headers)
    assert p_resp.status_code == 201
    project_id = p_resp.json()["id"]

    # 2. CREATE Task
    t_payload = {
        "title": "Configure OAuth Authentication",
        "description": "Implement OAuth2 authorization code flow",
        "project_id": project_id,
        "priority": "HIGH",
    }
    t_resp = seeded_client.post("/api/v1/tasks", json=t_payload, headers=headers)
    assert t_resp.status_code == 201, t_resp.text
    task_data = t_resp.json()
    task_id = task_data["id"]
    assert task_data["title"] == "Configure OAuth Authentication"
    assert task_data["priority"] == "HIGH"
    assert task_data["task_number"].startswith("TASK-")

    # 3. READ List Tasks
    t_list_resp = seeded_client.get("/api/v1/tasks", headers=headers)
    assert t_list_resp.status_code == 200
    assert any(t["id"] == task_id for t in t_list_resp.json())

    # 4. READ Single Task
    t_get_resp = seeded_client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert t_get_resp.status_code == 200
    assert t_get_resp.json()["id"] == task_id

    # 5. UPDATE Task
    t_update_resp = seeded_client.put(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Configure OAuth2 & JWT", "priority": "URGENT"},
        headers=headers,
    )
    assert t_update_resp.status_code == 200
    assert t_update_resp.json()["title"] == "Configure OAuth2 & JWT"
    assert t_update_resp.json()["priority"] == "URGENT"

    # 6. SUBTASK Operations
    st_resp = seeded_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        json={"title": "Setup JWT keypair"},
        headers=headers,
    )
    assert st_resp.status_code == 201, st_resp.text
    subtask_id = st_resp.json()["id"]
    assert st_resp.json()["is_completed"] is False

    # Toggle Subtask
    st_toggle_resp = seeded_client.put(f"/api/v1/tasks/subtasks/{subtask_id}/toggle", headers=headers)
    assert st_toggle_resp.status_code == 200
    assert st_toggle_resp.json()["is_completed"] is True

    # 7. COMMENT Operations
    cm_resp = seeded_client.post(
        f"/api/v1/tasks/{task_id}/comments",
        json={"content": "Keys generated and saved securely."},
        headers=headers,
    )
    assert cm_resp.status_code == 201, cm_resp.text
    assert cm_resp.json()["content"] == "Keys generated and saved securely."

    cm_list_resp = seeded_client.get(f"/api/v1/tasks/{task_id}/comments", headers=headers)
    assert cm_list_resp.status_code == 200
    assert len(cm_list_resp.json()) == 1

    # 8. ATTACHMENT Operations
    att_resp = seeded_client.post(
        f"/api/v1/tasks/{task_id}/attachments/meta",
        json={"filename": "architecture_diagram.pdf", "file_size": "1.0 MB", "file_url": "/uploads/architecture_diagram.pdf"},
        headers=headers,
    )
    assert att_resp.status_code == 201, att_resp.text
    attachment_id = att_resp.json()["id"]
    assert att_resp.json()["filename"] == "architecture_diagram.pdf"

    att_list_resp = seeded_client.get(f"/api/v1/tasks/{task_id}/attachments", headers=headers)
    assert att_list_resp.status_code == 200
    assert len(att_list_resp.json()) == 1

    # Delete Attachment
    del_att_resp = seeded_client.delete(f"/api/v1/tasks/attachments/{attachment_id}", headers=headers)
    assert del_att_resp.status_code == 204

    # 9. TIME LOG Operations
    tl_resp = seeded_client.post(
        f"/api/v1/tasks/{task_id}/timelogs",
        json={"hours": 3.5, "log_date": "2026-09-04", "description": "Configured auth endpoints"},
        headers=headers,
    )
    assert tl_resp.status_code == 201, tl_resp.text

    tl_list_resp = seeded_client.get(f"/api/v1/tasks/{task_id}/timelogs", headers=headers)
    assert tl_list_resp.status_code == 200
    assert len(tl_list_resp.json()) == 1
    assert tl_list_resp.json()[0]["hours"] == 3.5

    # 10. CUSTOM FIELDS FOR TASKS
    cfd_resp = seeded_client.post(
        "/api/v1/projects/tasks/custom-fields/definitions",
        json={"name": "risk_level", "label": "Risk Level", "field_type": "select", "options": ["Low", "Medium", "High"]},
        headers=headers,
    )
    assert cfd_resp.status_code == 201, cfd_resp.text
    cfd_id = cfd_resp.json()["id"]

    cfv_resp = seeded_client.post(
        f"/api/v1/tasks/{task_id}/custom-fields",
        json={"field_id": cfd_id, "value": "Medium"},
        headers=headers,
    )
    assert cfv_resp.status_code == 200, cfv_resp.text
    assert cfv_resp.json()["value"] == "Medium"

    cfv_list = seeded_client.get(f"/api/v1/tasks/{task_id}/custom-fields", headers=headers)
    assert cfv_list.status_code == 200
    assert len(cfv_list.json()) == 1

    # 11. DELETE Task
    del_t_resp = seeded_client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
    assert del_t_resp.status_code == 204

    get_del = seeded_client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert get_del.status_code == 404


def test_clickup_nested_subtasks_depth_and_progress(seeded_client, db):
    """Test 3-level nested subtasks depth limits and parent progress calculation"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # Level 1: Root Task
    t1 = seeded_client.post("/api/v1/tasks", json={"title": "Root Task Level 1"}, headers=headers)
    assert t1.status_code == 201
    task1_id = t1.json()["id"]

    # Level 2: Subtask
    t2 = seeded_client.post(f"/api/v1/tasks/{task1_id}/subtasks", json={"title": "Subtask Level 2"}, headers=headers)
    assert t2.status_code == 201
    task2_id = t2.json()["id"]

    # Level 3: Nested Subtask
    t3 = seeded_client.post(f"/api/v1/tasks/{task2_id}/subtasks", json={"title": "Nested Subtask Level 3"}, headers=headers)
    assert t3.status_code == 201
    task3_id = t3.json()["id"]

    # Level 4: Exceeds 3 level max depth -> Must fail 400
    t4 = seeded_client.post(f"/api/v1/tasks/{task3_id}/subtasks", json={"title": "Level 4 Subtask"}, headers=headers)
    assert t4.status_code == 400, t4.text
    assert "depth" in t4.text.lower()

    # Complete Level 3 -> check progress calculation
    seeded_client.patch(f"/api/v1/tasks/{task3_id}", json={"is_completed": True}, headers=headers)
    
    t2_check = seeded_client.get(f"/api/v1/tasks/{task2_id}", headers=headers)
    assert t2_check.json()["progress_percentage"] == 100.0


def test_cost_center_master_validation(seeded_client, db):
    """Test Cost Center master data creation and task validation"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # 1. Create a Cost Center in Master Data
    cc_resp = seeded_client.post(
        "/api/v1/masters/cost-centers",
        json={"code": "CC-ENG-2026", "name": "Engineering Operations", "is_active": True},
        headers=headers,
    )
    assert cc_resp.status_code == 201, cc_resp.text
    cc_id = cc_resp.json()["id"]
    assert cc_resp.json()["code"] == "CC-ENG-2026"

    # 2. Create task with valid cost_center_id -> 201
    t_valid = seeded_client.post(
        "/api/v1/tasks",
        json={"title": "Task with valid Cost Center", "cost_center_id": cc_id},
        headers=headers,
    )
    assert t_valid.status_code == 201
    assert t_valid.json()["cost_center_id"] == cc_id
    assert t_valid.json()["cost_center_code"] == "CC-ENG-2026"

    # 3. Create task with invalid cost_center_id -> 400 Bad Request
    t_invalid = seeded_client.post(
        "/api/v1/tasks",
        json={"title": "Task with bogus Cost Center", "cost_center_id": 999999},
        headers=headers,
    )
    assert t_invalid.status_code == 400, t_invalid.text
    assert "INVALID_COST_CENTER" in t_invalid.text


def test_task_dependencies_and_anti_circular_check(seeded_client, db):
    """Test task dependency creation and circular dependency rejection"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    tA = seeded_client.post("/api/v1/tasks", json={"title": "Task A"}, headers=headers).json()
    tB = seeded_client.post("/api/v1/tasks", json={"title": "Task B"}, headers=headers).json()
    tC = seeded_client.post("/api/v1/tasks", json={"title": "Task C"}, headers=headers).json()

    # A blocks B
    dep1 = seeded_client.post(
        f"/api/v1/tasks/{tA['id']}/dependencies",
        json={"depends_on_task_id": tB["id"], "dependency_type": "BLOCKS"},
        headers=headers,
    )
    assert dep1.status_code == 201

    # B blocks C
    dep2 = seeded_client.post(
        f"/api/v1/tasks/{tB['id']}/dependencies",
        json={"depends_on_task_id": tC["id"], "dependency_type": "BLOCKS"},
        headers=headers,
    )
    assert dep2.status_code == 201

    # C blocks A -> Causes cycle (A->B->C->A) -> Must be rejected 400
    dep3 = seeded_client.post(
        f"/api/v1/tasks/{tC['id']}/dependencies",
        json={"depends_on_task_id": tA["id"], "dependency_type": "BLOCKS"},
        headers=headers,
    )
    assert dep3.status_code == 400, dep3.text
    assert "circular" in dep3.text.lower()


def test_task_stopwatch_timer_and_time_tracking(seeded_client, db):
    """Test live stopwatch timer start, double-timer prevention, and stop"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    t = seeded_client.post("/api/v1/tasks", json={"title": "Time Tracked Task"}, headers=headers).json()

    # Start timer
    timer1 = seeded_client.post(f"/api/v1/tasks/{t['id']}/timer/start", headers=headers)
    assert timer1.status_code == 200, timer1.text

    # Try starting second timer while active -> 400 Bad Request
    timer2 = seeded_client.post(f"/api/v1/tasks/{t['id']}/timer/start", headers=headers)
    assert timer2.status_code == 400, timer2.text

    # Stop timer
    stop_timer = seeded_client.post(f"/api/v1/tasks/{t['id']}/timer/stop?description=Tested%20feature", headers=headers)
    assert stop_timer.status_code == 200
    assert stop_timer.json()["duration_minutes"] >= 1


def test_checklists_and_conversion_to_subtask(seeded_client, db):
    """Test checklists creation, item toggling, and conversion to subtask"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    t = seeded_client.post("/api/v1/tasks", json={"title": "Task with Checklist"}, headers=headers).json()

    # Create Checklist
    cl_resp = seeded_client.post(
        f"/api/v1/tasks/{t['id']}/checklists",
        json={"title": "Deployment Steps", "items": [{"title": "Backup DB"}, {"title": "Migrate schema"}]},
        headers=headers,
    )
    assert cl_resp.status_code == 201, cl_resp.text
    cl_data = cl_resp.json()
    assert len(cl_data["items"]) == 2
    item_id = cl_data["items"][0]["id"]

    # Toggle item
    tog = seeded_client.put(f"/api/v1/tasks/checklist-items/{item_id}/toggle", headers=headers)
    assert tog.status_code == 200
    assert tog.json()["is_completed"] is True

    # Convert second item to subtask
    item2_id = cl_data["items"][1]["id"]
    conv = seeded_client.post(f"/api/v1/tasks/checklist-items/{item2_id}/convert-to-subtask", headers=headers)
    assert conv.status_code == 201
    assert conv.json()["parent_task_id"] == t["id"]
    assert conv.json()["title"] == "Migrate schema"


def test_bulk_task_actions(seeded_client, db):
    """Test bulk actions (status change, priority change, archive)"""
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    t1 = seeded_client.post("/api/v1/tasks", json={"title": "Bulk Task 1"}, headers=headers).json()["id"]
    t2 = seeded_client.post("/api/v1/tasks", json={"title": "Bulk Task 2"}, headers=headers).json()["id"]

    # Bulk set priority to URGENT
    bulk_p = seeded_client.post(
        "/api/v1/tasks/bulk-action",
        json={"task_ids": [t1, t2], "action": "set_priority", "priority": "URGENT"},
        headers=headers,
    )
    assert bulk_p.status_code == 200
    assert bulk_p.json()["affected_count"] == 2

    # Verify task 1 priority updated
    get_t1 = seeded_client.get(f"/api/v1/tasks/{t1}", headers=headers).json()
    assert get_t1["priority"] == "URGENT"


def test_assign_personal_task_workflow(seeded_client, db):
    """Test assigning a personal task to another registered user"""
    from app.models.user import User, UserStatus
    token = login(seeded_client, "admin@kim.com", DEFAULT_PASSWORD)
    headers = auth_headers(token)

    # Pick an active target user who is not admin
    target_user = db.query(User).filter(User.status == UserStatus.ACTIVE, User.email != "admin@kim.com").first()
    assert target_user is not None

    payload = {
        "title": "Quarterly Performance Review",
        "description": "Prepare summary for Q4",
        "assignee_id": target_user.id,
        "priority": "HIGH",
        "estimated_hours": 2.5
    }

    resp = seeded_client.post("/api/v1/tasks/personal/assign", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["title"] == "Quarterly Performance Review"
    assert data["assignee_id"] == target_user.id
    assert data["is_personal"] is True
    assert data["priority"] == "HIGH"
    assert data["task_number"].startswith("TASK-")

    # Verify log notes were recorded
    log_resp = seeded_client.get(f"/api/v1/tasks/personal/{data['id']}/log-notes", headers=headers)
    assert log_resp.status_code == 200
    notes = log_resp.json()
    assert len(notes) >= 1
    assert "assigned to" in notes[0]["note"]

