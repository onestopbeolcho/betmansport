import httpx, json

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"
r = httpx.get(f"{BASE}/api/bets/debug", timeout=300)
d = r.json()

print(f"Betman: {d['betman_count']}경기")
print(f"Pinnacle: {d['pinnacle_count']}경기")
print(f"매칭: {d['matched_count']}개")
print(f"미매칭: {d['unmatched_count']}개")
print()

for m in d.get("matched", []):
    print(f"  {m['betman']} == {m['pinnacle']}")
    vbs = [v for v in m.get("value_bets", []) if v["ev"] > 1.0]
    if vbs:
        for v in vbs:
            print(f"    🔥 VALUE BET: {v['type']} EV={v['ev']:.4f}")

print()
print("미매칭 (Pinnacle 미제공 리그):")
for u in d.get("unmatched_betman", []):
    print(f"  ❌ {u}")

with open("debug_result.json", "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
