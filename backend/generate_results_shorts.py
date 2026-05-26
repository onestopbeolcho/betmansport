import os
import sys
import datetime
from datetime import timedelta

sys.path.append(os.getcwd())
from app.db.firestore import get_firestore_db

def fetch_yesterday_results():
    db = get_firestore_db()
    now = datetime.datetime.utcnow()
    yesterday_str = (now - timedelta(days=1)).strftime('%Y-%m-%d')
    two_days_ago_str = (now - timedelta(days=2)).strftime('%Y-%m-%d')
    
    docs = db.collection('predictions').order_by('match_time', direction='DESCENDING').limit(100).get()
    
    hits = []
    misses = []
    
    for doc in docs:
        data = doc.to_dict()
        match_time_str = data.get('match_time', '')
        
        if yesterday_str in match_time_str or two_days_ago_str in match_time_str:
            if 'is_matched' in data and data['is_matched'] is not None:
                if data['is_matched'] is True:
                    hits.append(data)
                else:
                    misses.append(data)
    return hits, misses

def build_results_script(hits, misses):
    total = len(hits) + len(misses)
    if total == 0:
        return None
        
    accuracy = round((len(hits) / total) * 100, 1)
    
    # 숏폼 영상용 대본 (아바타가 읽을 내용)
    script = f"안녕하세요! 스코어닉스 AI 어제자 적중 리포트입니다. 어제 저희 AI는 총 {total}경기를 분석하여 무려 {accuracy}%의 적중률을 기록했습니다. "
    
    if hits:
        script += "특히 "
        for hit in hits[:2]:
            home = hit.get('team_home_ko') or hit.get('team_home', '알수없음')
            script += f"{home} 경기의 예측을 정확하게 맞춰냈고요. "
            
    script += "오늘도 데이터 기반의 날카로운 분석으로 찾아뵙겠습니다. 프로필 링크에서 스코어닉스 최신 픽을 확인하세요!"
    return script

def generate_result_video():
    print("=== 결과 영상 렌더링 스크립트 시작 ===")
    hits, misses = fetch_yesterday_results()
    script = build_results_script(hits, misses)
    
    if not script:
        print("  [!] 어제 채점된 경기 결과가 없습니다. 영상 렌더링을 건너뜁니다.")
        return
        
    print(f"대본 준비 완료: {script}")
    
    output_dir = os.path.join(os.path.expanduser("~"), "Desktop", "scorenix_shorts")
    os.makedirs(output_dir, exist_ok=True)
    
    ts = datetime.datetime.now().strftime("%m%d_%H%M")
    out_file = os.path.join(output_dir, f"scorenix_results_{ts}.mp4")
    
    try:
        # ai_avatar_service의 전체 파이프라인(TTS + DID) 호출
        from ai_avatar_service import create_full_avatar_clip
        
        success = create_full_avatar_clip(script, out_file)
        if success:
            print(f"  [✅] 결과 영상 렌더링 완료! 파일이 바탕화면에 저장되었습니다: {out_file}")
        else:
            print(f"  [❌] 영상 생성 실패 (ElevenLabs 또는 D-ID 오류)")
    except Exception as e:
        print(f"  [❌] 영상 생성 중 오류 발생: {e}")

if __name__ == "__main__":
    generate_result_video()
