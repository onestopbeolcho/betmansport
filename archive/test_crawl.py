import httpx
import json

print("베트맨 크롤링 수동 실행...")
url = "https://us-central1-smart-proto-inv-2026.cloudfunctions.net/api/api/admin/betman/crawl"

try:
    r = httpx.post(url, timeout=300)
    print(f"Status: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"성공: {data.get('success')}")
        print(f"메시지: {data.get('message')}")
        print(f"경기 수: {data.get('count')}")
        print(f"소스: {data.get('source')}")
        print(f"회차: {data.get('round_id')}")
        
        if data.get("matches"):
            print(f"\n처음 3경기:")
            for m in data["matches"][:3]:
                print(f"  {m['team_home']} vs {m['team_away']}")
                print(f"    W={m['home_odds']} D={m['draw_odds']} L={m['away_odds']}")
    else:
        print(f"Error: {r.text[:500]}")
        
except Exception as e:
    print(f"Exception: {e}")
