import os
import json

dict_dir = r"c:\Smart_Proto_Investor_Plan\frontend\app\dictionaries"

ko_updates = {
    "valueBet": "AI 우세팀 분석",
    "valueBetDesc": "수학적/통계적으로 우세한 팀 선별",
    "market": "실시간 배당 흐름",
    "matchPredict": "실시간 배당 흐름",
    "matchPredictDesc": "글로벌 배당 변화와 대중의 쏠림 현상 파악",
    "aiPredict": "매치 데이터 리포트",
    "aiPredictDesc": "예측을 뒷받침하는 세부 경기 데이터",
    "portfolio": "나의 분석 노트",
    "portfolioDesc": "관심 경기 배분 및 시뮬레이션"
}

en_updates = {
    "valueBet": "AI Favored Teams",
    "valueBetDesc": "Statistically favored team recommendations",
    "market": "Live Odds Trends",
    "matchPredict": "Live Odds Trends",
    "matchPredictDesc": "Real-time global odds & market movements",
    "aiPredict": "Match Data Report",
    "aiPredictDesc": "Detailed data analysis supporting the projection",
    "portfolio": "My Analysis Note",
    "portfolioDesc": "Save matches and manage bankroll simulations"
}

for filename in os.listdir(dict_dir):
    if filename.endswith(".json"):
        filepath = os.path.join(dict_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if "nav" not in data:
                continue
                
            updates = ko_updates if filename == "ko.json" else en_updates
            
            for key, val in updates.items():
                data["nav"][key] = val
                
            if filename == "ko.json":
                if "market" in data:
                    data["market"]["title"] = "실시간 배당 흐름"
                    data["market"]["heroTitle"] = "실시간 배당 흐름"
            else:
                if "market" in data:
                    data["market"]["title"] = "Live Odds Trends"
                    data["market"]["heroTitle"] = "Live Odds Trends"
                    
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
                
            print(f"Updated {filename}")
        except Exception as e:
            print(f"Error {filename}: {e}")
