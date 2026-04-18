import os
import re

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"
with open(filepath, "rb") as f:
    content = f.read()

text = content.decode('utf-8', errors='ignore')

# Identify the try block
target_pattern = r'else\s*\{\s*const err = await res\.json\(\);\s*alert\([^\)]+\);\s*\}'

replacement = """else {
                const err = await res.json();
                if (res.status === 400 && err.detail && err.detail.includes("Odds mismatch")) {
                    alert(`🚨 배당 변동 알림\\n\\n현재 경기의 배당이 실시간으로 변동되었습니다.\\n장바구니를 비우고 최신 배당으로 다시 확인해주세요.\\n\\n[서버 메시지: ${err.detail}]`);
                    clearCart();
                } else {
                    alert("진행 실패: " + (err.detail || "알 수 없는 오류"));
                }
            }"""

if re.search(target_pattern, text):
    new_text = re.sub(target_pattern, replacement, text)
    with open(filepath, "wb") as f:
        f.write(new_text.encode('utf-8'))
    print("Patch successful.")
else:
    print("Regex failed to match.")
