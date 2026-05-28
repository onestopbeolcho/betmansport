import os
import sys
import asyncio
import datetime
from datetime import timedelta

# 환경 변수 및 경로 설정
sys.path.append(os.getcwd())
from app.db.firestore import get_firestore_db
from app.services.buffer_service import buffer_service
from app.models.config_db import load_config_to_env

def generate_result_report(hits, misses):
    total = len(hits) + len(misses)
    if total == 0:
        return None

    accuracy = round((len(hits) / total) * 100, 1)
    
    report = f"🔥 어제의 스코어닉스 AI 적중 리포트 🔥\n\n"
    report += f"📊 전체 적중률: {accuracy}%\n"
    report += f"✅ 적중: {len(hits)}경기 | ❌ 미적중: {len(misses)}경기\n\n"
    
    if hits:
        report += "🏆 주요 적중 경기:\n"
        for hit in hits[:3]: # 상위 3개만 표시
            home = hit.get('team_home_ko') or hit.get('team_home', 'Unknown')
            away = hit.get('team_away_ko') or hit.get('team_away', 'Unknown')
            pick = hit.get('recommendation', 'HOME')
            
            # 배당이 있으면 표시
            odds_str = ""
            if pick == 'HOME' and hit.get('home_odds'):
                odds_str = f"({hit['home_odds']}배)"
            elif pick == 'AWAY' and hit.get('away_odds'):
                odds_str = f"({hit['away_odds']}배)"
            
            report += f"✔️ {home} vs {away} -> AI 픽: {pick} {odds_str} 적중!\n"
            
    report += "\n🚀 오늘도 스코어닉스의 정교한 AI 예측과 함께 승리하세요!\n"
    report += "👉 https://scorenix.com"
    return report

async def main():
    print("=== SNS 결과 퍼블리싱 스크립트 시작 ===")
    load_config_to_env()
    
    db = get_firestore_db()
    
    # 1. 어제 날짜를 기준으로 최근 채점된 데이터 수집
    now = datetime.datetime.utcnow()
    yesterday_str = (now - timedelta(days=1)).strftime('%Y-%m-%d')
    two_days_ago_str = (now - timedelta(days=2)).strftime('%Y-%m-%d')
    
    # 최근 경기 데이터를 가져와서 필터링 (ai_prediction_history 조회)
    docs = db.collection('ai_prediction_history').order_by('match_time', direction='DESCENDING').limit(100).get()
    
    hits = []
    misses = []
    
    for doc in docs:
        data = doc.to_dict()
        match_time_str = data.get('match_time', '')
        
        # 최근 이틀 내의 경기들만 대상
        if yesterday_str in match_time_str or two_days_ago_str in match_time_str:
            status = data.get('status')
            if status in ('HIT', 'MISS'):
                if status == 'HIT':
                    hits.append(data)
                else:
                    misses.append(data)
                    
    report_text = generate_result_report(hits, misses)
    
    if not report_text:
        print("  [!] 어제 채점된 경기 결과가 없습니다. 업로드를 건너뜁니다.")
        return
        
    print("생성된 리포트 내용:")
    print(report_text)
    print("-" * 30)
    
    # 2. Buffer API를 통해 활성화된 SNS (트위터/인스타 등)에 동시 업로드
    print("  [>] Buffer 서비스로 전송 중...")
    if not buffer_service.is_configured:
        print("  [!] Buffer Access Token이 설정되지 않아 업로드를 건너뜁니다.")
        return
        
    image_url = None
    if hits:
        best_hit = hits[0]
        if "factors" not in best_hit:
            best_hit["factors"] = [{"name": "AI 예측 적중", "score": best_hit.get("confidence", 80)}]
        try:
            from app.services.card_generator import generate_card_and_upload
            print(f"  [>] 대표 적중 경기 '{best_hit.get('match_id')}'의 카드 이미지 생성 및 업로드 중...")
            image_url = await generate_card_and_upload(best_hit)
            if image_url:
                print(f"  [✅] 카드 이미지 생성 완료: {image_url}")
            else:
                print("  [!] 카드 이미지 생성 실패 (None 반환)")
        except Exception as card_e:
            print(f"  [❌] 카드 이미지 생성 중 오류: {card_e}")

    result = await buffer_service.publish_post(text=report_text, image_url=image_url)
    if result.get("success"):
        print(f"  [✅] SNS 업로드 완료! {result.get('published', 0)}개 채널에 발송됨.")
    else:
        print(f"  [❌] SNS 업로드 실패: {result.get('error', 'Unknown Error')}")
        if result.get("details"):
            print(f"  세부 정보: {result.get('details')}")

if __name__ == "__main__":
    asyncio.run(main())
