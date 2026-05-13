import os
from datetime import datetime

def fetch_top_matches():
    """
    TODO: 실제 Firestore DB 또는 내부 데이터베이스를 조회하여
    오늘 진행되는 경기 중 AI 예측 승률이 가장 높은 '핵심 경기' 3개를 가져옵니다.
    
    (현재는 백엔드 연동을 가정하여 더미 데이터를 반환합니다)
    """
    return [
        {"home": "맨시티", "away": "아스널", "ai_pick": "맨시티", "win_prob": 78},
        {"home": "레알마드리드", "away": "바르셀로나", "ai_pick": "레알마드리드", "win_prob": 72},
        {"home": "바이에른뮌헨", "away": "도르트문트", "ai_pick": "바이에른뮌헨", "win_prob": 81}
    ]

def generate_video_script_data(matches):
    """
    경기 데이터를 바탕으로 TTS에 들어갈 전체 텍스트와
    영상 자막 합성을 위한 구간별 텍스트(세그먼트) 데이터를 동적으로 생성합니다.
    """
    
    # 1. 훅 (Hook)
    hook_text = "스코어닉스 AI가 분석한 오늘 무조건 이기는 경기 3가지!"
    
    # 2. 미끼 픽 (첫 번째 경기 오픈)
    match1 = matches[0]
    pick1_text = f"첫 번째, {match1['home']} 대 {match1['away']}."
    pick1_desc = f"AI 데이터 분석 결과 {match1['ai_pick']}의 압도적 승리가 예상됩니다."
    
    # 3. 블라인드 처리 (두 번째, 세 번째 경기)
    match2 = matches[1]
    match3 = matches[2]
    blind_text = f"나머지 두 경기는 승률 {match2['win_prob']}%와 {match3['win_prob']}%의 확실한 VIP 경기입니다."
    
    # 4. 수익화 멤버십 유도 (Call to Action)
    cta_text = "가려진 2경기의 최종 픽과 수익 극대화 조합은 스코어닉스 채널 멤버십에서 지금 바로 확인하세요!"
    
    # 전체 오디오용 텍스트 (gTTS 변환용)
    full_tts_text = f"{hook_text} {pick1_text} {pick1_desc} {blind_text} {cta_text}"
    
    # 영상 자막(TextClip)용 시간 분할 데이터
    # 실제 프로덕션에서는 글자 수 기반 비례식이나 OpenAI Whisper API를 통해 정확한 싱크를 맞춥니다.
    subtitles = [
        {"start": 0.0, "end": 3.0, "text": hook_text},
        {"start": 3.0, "end": 5.0, "text": pick1_text},
        {"start": 5.0, "end": 8.0, "text": pick1_desc},
        {"start": 8.0, "end": 12.0, "text": blind_text},
        {"start": 12.0, "end": 16.0, "text": "나머지 VIP 최종 픽 조합은\n채널 멤버십에서 확인하세요!"}
    ]
    
    return full_tts_text, subtitles

if __name__ == "__main__":
    print("==================================================")
    print(" [1단계] 백엔드에서 오늘의 AI 예측 데이터 수집 중...")
    print("==================================================")
    top_matches = fetch_top_matches()
    for i, m in enumerate(top_matches, 1):
        print(f" {i}. {m['home']} vs {m['away']} (예상: {m['ai_pick']} 승 / 승률: {m['win_prob']}%)")
        
    print("\n==================================================")
    print(" [2단계] 쇼츠 대본 및 자막 데이터 자동 생성 완료")
    print("==================================================")
    tts_text, subtitles = generate_video_script_data(top_matches)
    
    print("\n[오디오용 전체 텍스트 (TTS 입력용)]")
    print("--------------------------------------------------")
    print(tts_text)
    
    print("\n[영상 자막 타임라인 (MoviePy 입력용)]")
    print("--------------------------------------------------")
    for sub in subtitles:
        print(f" [{sub['start']}s ~ {sub['end']}s] : {sub['text'].replace(chr(10), ' ')}")
        
    print("\n이 데이터를 이전의 video_generator_poc.py에 넘겨주면 전체 자동화가 완성됩니다!")
