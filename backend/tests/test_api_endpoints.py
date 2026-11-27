"""End-to-End API endpoint integration tests using FastAPI TestClient."""

def test_root_and_health_endpoints(client):
    r1 = client.get("/")
    assert r1.status_code == 200
    assert r1.json()["status"] == "operational"

    r2 = client.get("/health")
    assert r2.status_code == 200
    assert r2.json()["status"] == "healthy"

def test_get_today_actions_api(client):
    res = client.get("/api/actions/today")
    assert res.status_code == 200
    data = res.json()
    assert len(data["actions"]) == 3
    assert data["actions"][0]["urgency"] == "critical"

def test_get_dashboard_kpis_api(client):
    res = client.get("/api/dashboard?period=30d")
    assert res.status_code == 200
    data = res.json()
    assert data["revenue_pkr"] > 0
    assert data["gross_profit_pkr"] > 0
    assert data["inventory_value_at_cost_pkr"] > 0

def test_reorder_planner_api(client):
    payload = {"budget_pkr": 50000.0, "store_id": 1}
    res = client.post("/api/reorder-plan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["budget_entered_pkr"] == 50000.0
    assert data["total_allocated_spend_pkr"] <= 50000.0
    assert data["budget_respected"] is True
    assert len(data["recommendations"]) > 0

def test_demand_forecast_api(client):
    payload = {"product_id": 1, "horizon_days": 7}
    res = client.post("/api/forecast", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["daily_predictions"]) == 7
    assert data["evaluation_wape_pct"] >= 0

def test_copilot_chat_api(client):
    payload = {
        "message": "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?",
        "language": "roman_urdu"
    }
    res = client.post("/api/copilot/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "Dalda Cooking Oil" in data["response"]
    assert data["grounded"] is True
