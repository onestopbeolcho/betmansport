import os

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

target = """            else { const err = await res.json(); alert("조합 등록 실패: " + (err.detail || "알 수 없는 오류")); }"""
target2 = """            else { const err = await res.json(); alert("등록 실패: " + (err.detail || "알 수 없는 오류")); }"""

replacement = """            else {
                const err = await res.json();
                if (res.status === 400 && err.detail && err.detail.includes("Odds mismatch")) {
                    alert(`🚨 배당 변동 알림\\n\\n${err.detail}\\n\\n장바구니가 변경된 배당으로 최신화 되었습니다. 다시 확인 후 담아주세요.`);
                    clearCart();
                } else {
                    alert("진행 실패: " + (err.detail || "알 수 없는 오류"));
                }
            }"""

if "alert(" in content and "res.json()" in content:
    # We will just do a regex or simple string replacement targeting the exact lines around `if (res.ok)`
    pass

# Instead of exact hardcoded match, let's use regex
import re
new_content = re.sub(
    r"else\s*\{\s*const err = await res\.json\(\);\s*alert\([^;]+\);\s*\}",
    replacement,
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)
    
print("Replaced:", content != new_content)
