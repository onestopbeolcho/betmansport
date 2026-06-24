import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.core.deps import require_current_user
from app.db.firestore import get_firestore_db

# Mock user data store for local testing if firestore is empty
MOCK_USER_ID_1 = "test_user_buyer"
MOCK_USER_ID_2 = "test_user_tipster"

current_test_user = MOCK_USER_ID_1

# Overwrite dependency
def override_require_current_user():
    global current_test_user
    return current_test_user

app.dependency_overrides[require_current_user] = override_require_current_user

client = TestClient(app)

def setup_module(module):
    """테스트를 위한 Firestore 임시 유저 초기화"""
    db = get_firestore_db()
    if db:
        # Buyer user
        db.collection("users").document(MOCK_USER_ID_1).set({
            "email": "buyer@test.com",
            "display_name": "Buyer User",
            "gold_balance": 0,
            "tipster_credits": 0,
            "is_tipster": False
        })
        # Tipster user
        db.collection("users").document(MOCK_USER_ID_2).set({
            "email": "tipster@test.com",
            "display_name": "Super Tipster",
            "gold_balance": 0,
            "tipster_credits": 0,
            "is_tipster": True
        })
        print("\n[Setup] Firestore test users initialized.")

def teardown_module(module):
    """테스트 생성 데이터 클린업"""
    db = get_firestore_db()
    if db:
        db.collection("users").document(MOCK_USER_ID_1).delete()
        db.collection("users").document(MOCK_USER_ID_2).delete()
        
        # Clean up posts generated in tests
        docs = db.collection("tipster_posts").where("author_id", "==", MOCK_USER_ID_2).stream()
        for doc in docs:
            doc.reference.delete()
            
        print("\n[Teardown] Firestore test users and posts cleaned up.")

def test_gold_flow():
    global current_test_user
    
    # 1. 잔액 조회 (초기: 0)
    current_test_user = MOCK_USER_ID_1
    response = client.get("/api/gold/balance")
    assert response.status_code == 200
    data = response.json()
    assert data["gold_balance"] == 0
    
    # 2. 골드 충전 (100 Gold)
    response = client.post("/api/gold/charge", json={"amount": 100})
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 100
    
    # 3. 팁스터 분석글 작성 (Tipster 계정으로 50 Gold 유료글 등록)
    current_test_user = MOCK_USER_ID_2
    post_payload = {
        "title": "MLB 적중 확정 픽 - 양키스 vs 보스턴",
        "content": "양키스의 최근 투수진이 아주 견고합니다. 마진율이 좋으므로 양키스 승리를 강력히 추천합니다.",
        "price_gold": 50
    }
    response = client.post("/api/gold/posts", json=post_payload)
    assert response.status_code == 200
    post_id = response.json()["post_id"]
    assert post_id is not None
    
    # 4. 구매자 입장에서 글 조회 (잠금 확인)
    current_test_user = MOCK_USER_ID_1
    response = client.get(f"/api/gold/posts/{post_id}")
    assert response.status_code == 200
    post_data = response.json()
    assert post_data["is_locked"] is True
    assert "🔒 이 정보는 골드로 잠겨 있습니다" in post_data["content"]
    
    # 5. 잠금 해제 (Unlock)
    response = client.post(f"/api/gold/posts/{post_id}/unlock")
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 50 # 100 - 50 = 50
    
    # 6. 잠금 해제 후 글 상세 재조회 (내용 풀림 확인)
    response = client.get(f"/api/gold/posts/{post_id}")
    assert response.status_code == 200
    post_data_unlocked = response.json()
    assert post_data_unlocked["is_locked"] is False
    assert "양키스의 최근 투수진" in post_data_unlocked["content"]
    
    # 7. 팁스터(판매자) 정산 크레딧 증가 확인 (50 Gold의 70%인 35 Credits)
    current_test_user = MOCK_USER_ID_2
    response = client.get("/api/gold/balance")
    assert response.status_code == 200
    assert response.json()["tipster_credits"] == 35
    
    # 8. 후원하기 (Gift) 기능 테스트 (Buyer가 Tipster에게 20 Gold 직접 후원)
    current_test_user = MOCK_USER_ID_1
    response = client.post("/api/gold/gift", json={"tipster_id": MOCK_USER_ID_2, "amount": 20})
    assert response.status_code == 200
    assert response.json()["gold_balance"] == 30 # 50 - 20 = 30
    
    # 9. 팁스터(판매자)의 최종 크레딧 점검 (35 + 20의 70%인 14 = 49 Credits)
    current_test_user = MOCK_USER_ID_2
    response = client.get("/api/gold/balance")
    assert response.status_code == 200
    assert response.json()["tipster_credits"] == 49
    
    print("\n✅ All virtual gold and tipster integration test scenarios passed successfully!")

if __name__ == "__main__":
    setup_module(None)
    try:
        test_gold_flow()
    finally:
        teardown_module(None)
