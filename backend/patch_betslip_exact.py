import os

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

target = """            if (res.ok) { alert("조합이 저장되었습니다! 💾"); clearCart(); toggleCart(); }
            else { const err = await res.json(); alert("저장 실패: " + (err.detail || "알 수 없는 오류")); }"""

replacement = """            if (res.ok) { alert("조합이 저장되었습니다! 💾"); clearCart(); toggleCart(); }
            else { 
                const err = await res.json(); 
                if (res.status === 400 && err.detail && err.detail.includes("Odds mismatch")) {
                    alert(`🚨 배당 변동 알림\\n\\n현재 경기의 실시간 배당이 변동되었습니다.\\n장바구니를 비우고 최신 배당으로 다시 확인해주세요.\\n\\n[서버 메시지: ${err.detail}]`);
                    clearCart();
                } else {
                    alert("저장 실패: " + (err.detail || "알 수 없는 오류")); 
                }
            }"""

if target in text:
    new_text = text.replace(target, replacement)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_text)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
