import os
import re

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"

# Detect encoding
with open(filepath, "rb") as f:
    raw = f.read()

encoding = None
for enc in ["utf-8", "utf-8-sig", "cp949"]:
    try:
        text = raw.decode(enc)
        encoding = enc
        break
    except UnicodeDecodeError:
        pass

if not encoding:
    print("Could not detect encoding!")
else:
    print(f"Detected encoding: {encoding}")
    
    # We want to replace the `else { const err = await res.json(); alert(...) }` inside handleSave
    # Let's find "res.ok" completely logically
    target_pattern = r'else\s*\{\s*const err = await res\.json\(\);\s*alert\([^\)]+\);\s*\}'
    replacement = """else {
                const err = await res.json();
                if (res.status === 400 && err.detail && err.detail.includes("Odds mismatch")) {
                    alert(`🚨 배당 변동 알림\\n\\n해당 경기의 실시간 배당이 변동되었습니다.\\n장바구니를 비우고 최신 배당으로 확인해주세요.\\n\\n[서버상세: ${err.detail}]`);
                    clearCart();
                } else {
                    alert("등록 실패: " + (err.detail || "알 수 없는 오류"));
                }
            }"""
            
    if re.search(target_pattern, text):
        new_text = re.sub(target_pattern, replacement, text)
        with open(filepath, "wb") as f:
            f.write(new_text.encode(encoding))
        print("Patch successful!")
    else:
        print("Could not find the target string. Maybe it doesn't match.")
        import sys
        idx = text.find("res.ok")
        print("Context near res.ok:")
        print(repr(text[idx-50:idx+200]))
