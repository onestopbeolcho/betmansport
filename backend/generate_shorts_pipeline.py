"""
Scorenix Shorts Video Generator v4.0 - AI Avatar Edition
=========================================================
- ElevenLabs TTS: 사람과 구분 불가한 자연스러운 음성 (폴백: Edge TTS)
- D-ID Avatar: AI 앵커가 실제로 말하는 듯한 영상 생성 (폴백: 정적 배경)
- Ken Burns: 정지 이미지에 천천히 줌인하여 영상 느낌 연출
- Glassmorphism: 반투명 라운드 자막 박스 + 자동 줄바꿈
- BGM 자동 믹싱
- 장면별 데이터 카드 렌더링
"""
import os
import datetime
import asyncio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Pillow 10+ / MoviePy 1.0.3 호환 패치
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import (
    VideoFileClip, ImageClip, CompositeVideoClip,
    AudioFileClip, ColorClip, concatenate_videoclips, vfx
)

# ─── 데이터 ────────────────────────────────────────────
try:
    from app.models.betman_db import load_betman_data
except ImportError:
    load_betman_data = None

WIDTH, HEIGHT = 1080, 1920  # 쇼츠 9:16


def fetch_top_matches():
    if load_betman_data is None:
        return _dummy()
    try:
        db = load_betman_data()
        rounds = db.get("rounds", {})
        rid = db.get("last_round_id")
        rd = rounds.get(rid, {})
        matches = rd.get("matches", []) if isinstance(rd, dict) else rd
        if not matches:
            return _dummy()

        out = []
        for m in matches:
            try:
                h_odds = float(m.get("home_odds", 0))
                d_odds = float(m.get("draw_odds", 0)) if m.get("draw_odds") else 0
                a_odds = float(m.get("away_odds", 0)) if m.get("away_odds") else 0

                if h_odds <= 1.1:
                    continue

                h_prob = round(100 / h_odds, 1)
                a_prob = round(100 / a_odds, 1) if a_odds > 1 else 0
                gap = round(h_prob - a_prob, 1)

                # 실제 수치 기반 분석 근거 생성
                reason = _build_data_reason(h_odds, a_odds, d_odds, gap, m.get("league", ""))

                out.append({
                    "home": m["team_home"],
                    "away": m["team_away"],
                    "ai_pick": m["team_home"],
                    "win_prob": int(h_prob),
                    "home_odds": h_odds,
                    "away_odds": a_odds,
                    "draw_odds": d_odds,
                    "odds_gap": gap,
                    "is_betman": True,
                    "league": m.get("league", ""),
                    "reason": reason,
                })
            except Exception:
                continue
        out.sort(key=lambda x: x["win_prob"], reverse=True)
        return out[:2] if len(out) >= 2 else _dummy()[:2]
    except Exception as e:
        print(f"  [!] Betman data load failed or empty: {e}")
        # --- Fallback: Fetch from AI Predictions API ---
        print("  [>] Falling back to AI Predictions API...")
        try:
            import urllib.request
            import json
            req = urllib.request.Request(
                "https://scorenix-backend-n5dv44kdaa-du.a.run.app/api/ai/predictions",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            res = urllib.request.urlopen(req, timeout=10)
            data = json.loads(res.read().decode('utf-8'))
            preds = data.get("predictions", [])
            
            if not preds:
                print("  [!] API returned no predictions. Using dummy.")
                return _dummy()
                
            out = []
            for p in preds:
                home = p.get("team_home_ko") or p.get("team_home", "")
                away = p.get("team_away_ko") or p.get("team_away", "")
                win_prob = p.get("home_win_prob") or p.get("confidence", 0)
                
                # Mock odds since API might not have them directly in the top-level
                h_odds = round(100 / win_prob, 2) if win_prob else 1.5
                
                out.append({
                    "home": home,
                    "away": away,
                    "ai_pick": p.get("recommendation", "HOME"),
                    "win_prob": int(win_prob),
                    "home_odds": h_odds,
                    "away_odds": 3.0,
                    "draw_odds": 3.5,
                    "odds_gap": int(win_prob) - 30, # Mock gap
                    "is_betman": False,
                    "league": p.get("league", ""),
                    "reason": f"AI 팩터 분석에 따르면 홈 팀의 승리({int(win_prob)}%)가 매우 유력합니다."
                })
            
            out.sort(key=lambda x: x["win_prob"], reverse=True)
            return out[:2] if len(out) >= 2 else _dummy()[:2]
            
        except Exception as api_err:
            print(f"  [!] Fallback failed: {api_err}")
            return _dummy()


def _build_data_reason(h_odds, a_odds, d_odds, gap, league):
    """실제 배당 수치를 기반으로 구체적인 분석 근거 생성"""
    import random

    parts = []

    # 1. 배당 비교 수치
    if h_odds < 1.4:
        parts.append(f"홈 배당 {h_odds}배로 북메이커들도 홈 승리를 압도적으로 예상하고 있고요")
    elif h_odds < 1.7:
        parts.append(f"홈 배당 {h_odds} 대 원정 배당 {a_odds}로, 홈 팀이 확실히 유리한 구도예요")
    else:
        parts.append(f"배당상으로는 홈 {h_odds} 대 원정 {a_odds}인데, 숨겨진 가치가 있어요")

    # 2. 확률 격차
    if gap > 30:
        parts.append(f"AI 환산 승률 격차가 {gap}%포인트나 벌어져 있어요")
    elif gap > 15:
        parts.append(f"승률 차이가 {gap}%포인트로 데이터상 우위가 뚜렷해요")
    else:
        parts.append(f"승률 차이 {gap}%포인트, 박빙이지만 미세하게 홈이 앞서요")

    # 3. 무승부 배당 분석
    if d_odds and d_odds > 3.5:
        parts.append("무승부 배당이 높아서 승부가 한쪽으로 갈릴 가능성이 커요")
    elif d_odds and d_odds < 3.0:
        parts.append("다만 무승부 가능성도 있으니 조합 시 참고하세요")

    # 랜덤으로 2~3개 선택하여 조합
    selected = random.sample(parts, min(len(parts), random.choice([2, 3])))
    return ". ".join(selected) + "."


def _dummy():
    return [
        {"home": "맨시티", "away": "아스널", "ai_pick": "맨시티",
         "win_prob": 78, "home_odds": 1.32, "away_odds": 3.40, "draw_odds": 4.50,
         "odds_gap": 48.6, "league": "EPL", "is_betman": False,
         "reason": "홈 배당 1.32배로 북메이커들도 홈 승리를 압도적으로 예상하고 있고요. AI 환산 승률 격차가 48.6%포인트나 벌어져 있어요."},
        {"home": "레알마드리드", "away": "바르셀로나", "ai_pick": "레알마드리드",
         "win_prob": 72, "home_odds": 1.55, "away_odds": 2.80, "draw_odds": 3.60,
         "odds_gap": 28.9, "league": "La Liga", "is_betman": False,
         "reason": "홈 배당 1.55 대 원정 배당 2.80으로 홈 팀이 확실히 유리한 구도예요. 승률 차이가 28.9%포인트로 데이터상 우위가 뚜렷해요."},
        {"home": "바이에른뮌헨", "away": "도르트문트", "ai_pick": "바이에른뮌헨",
         "win_prob": 81, "home_odds": 1.25, "away_odds": 4.00, "draw_odds": 5.00,
         "odds_gap": 55.0, "league": "Bundesliga", "is_betman": False,
         "reason": "홈 배당 1.25배로 북메이커들도 홈 승리를 압도적으로 예상하고 있고요. 무승부 배당이 높아서 승부가 한쪽으로 갈릴 가능성이 커요."},
    ]


# ─── Firestore 비디오 설정 로드 헬퍼 ────────────────────────
def load_video_settings():
    try:
        from app.models.config_db import get_video_config
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                from app.db.firestore import get_firestore_db
                db = get_firestore_db()
                doc = db.collection("system_config").document("video_config").get()
                if doc.exists:
                    return doc.to_dict()
        except RuntimeError:
            return asyncio.run(get_video_config())
    except Exception as e:
        print(f"  [!] Failed to load remote video config, using defaults: {e}")
    
    return {
        "tts_voice_ko": "ko-KR-SunHiNeural",
        "tts_voice_en": "en-US-EmmaNeural",
        "tts_voice_ja": "ja-JP-NanamiNeural",
        "tts_speed_ko": "+15%",
        "tts_speed_en": "+12%",
        "tts_speed_ja": "+10%",
        "tts_pitch_ko": "+5Hz",
        "tts_pitch_en": "+0Hz",
        "tts_pitch_ja": "+0Hz",
        "subtitle_base_size_intro": 68,
        "subtitle_base_size_match": 54,
        "subtitle_font_ko": "malgun.ttf",
        "subtitle_font_bold_ko": "malgunbd.ttf",
    }


# ─── 대본 (매번 다른 템플릿) ──────────────────────────────
def build_script(matches, mode="membership"):
    """
    랜덤 템플릿으로 매번 다른 느낌의 대본을 생성합니다.
    - membership: 3개 경기 모두 명확한 분석 및 승률 예측 제공 (구독자용 분석 명확한 영상)
    - marketing: 1번째 경기 상세 오픈 + 2, 3번째 경기는 스코어닉스 웹사이트 방문 유도 (마케팅/유입용 영상)
    - winning: 어제 AI가 실제로 적중한 경기를 자랑하며 신뢰성을 어필하는 영상 (적중 인증)
    - educational: 감이 아닌 기대값(EV) 투자 및 7-Factor AI 원리를 설명하는 교육용 영상
    - top_picks: 오늘 밤 가장 신뢰도가 급증한 경기 TOP 3를 요약 소개하며 사이트 유도
    """
    import random
    cfg = load_video_settings()
    today = datetime.datetime.now().strftime("%m월 %d일")
    hour = datetime.datetime.now().strftime("%H시")

    # ─── Gemini AI Generative Scriptwriting 시도 ───
    try:
        from app.services.gemini_service import generate_video_script_korean
        ai_script = generate_video_script_korean(matches, mode)
        if ai_script and isinstance(ai_script, list) and len(ai_script) >= 3:
            print(f"  [AI] Generative Script successfully created by Gemini (mode: {mode})")
            return ai_script
    except Exception as ai_err:
        print(f"  [!] Generative script error ({ai_err}) - falling back to template system")

    # 팀명 축약 (긴 이름이 박스를 넘기지 않도록)
    def short(name, max_len=8):
        if not name:
            return ""
        if len(name) <= max_len:
            return name
        if '&' in name:
            return name.split('&')[0].strip()
        return name[:max_len]

    if mode == "winning":
        # matches에 최근 적중된 경기 리스트(hits)가 담겨옵니다.
        if not matches or not isinstance(matches, list):
            m1 = {"home": "레알마드리드", "away": "바르셀로나", "recommendation": "HOME", "home_score": 3, "away_score": 1, "confidence": 75}
        else:
            m1 = matches[0]

        h1 = short(m1.get('home') or m1.get('team_home', '홈팀'))
        a1 = short(m1.get('away') or m1.get('team_away', '원정팀'))
        rec = m1.get('recommendation', 'HOME')
        rec_ko = "홈 승" if rec == "HOME" else "원정 승" if rec == "AWAY" else "무승부"
        h_score = m1.get('home_score', 0)
        a_score = m1.get('away_score', 0)
        conf = m1.get('confidence', 0)

        intros = cfg.get("winning_intros") or [
            f"대박! 스코어닉스 AI의 무시무시한 예측 정확도, 숫자로 직접 증명합니다. {today} 적중 결과 리포트 시작합니다.",
            f"다들 주목하세요! 어제 AI가 예측한 빅매치가 또 한 번 완벽하게 맞아떨어졌습니다. {today} 적중 현황 공개합니다."
        ]
        intro_caps = cfg.get("winning_intro_caps") or [
            f"[HIT REPORT]\n{today} AI 예측\n실제 적중 성과",
            f"[AI ACCURACY]\n데이터가 증명한\n실시간 적중 인증"
        ]
        intros = [i.replace("{today}", today) for i in intros]
        intro_caps = [c.replace("{today}", today) for c in intro_caps]
        intro_idx = random.randint(0, len(intros) - 1)

        m1_tts = f"적중의 주인공은 바로 {h1} 대 {a1} 경기였습니다! AI는 이 경기를 {conf:.0f}%의 신뢰도로 {rec_ko}을 예측했었는데요."
        m1_cap = f"{h1}\nvs\n{a1}\n\n[AI 예측] {rec_ko}\n신뢰도 {conf:.0f}%"

        m2_tts = f"경기 결과 스코어 {h_score} 대 {a_score}로, AI가 짚어낸 {rec_ko} 방향이 한치의 오차도 없이 통쾌하게 적중했습니다!"
        m2_cap = f"최종 스코어\n[ {h_score} : {a_score} ]\n\nAI 예측 완벽 적중! ✅"

        m3_tts = "감정에 치우치는 촉 베팅은 결국 잃을 수밖에 없습니다. 철저한 통계와 기대값으로 무장한 AI 분석만이 유일한 해결책입니다."
        m3_cap = "감에 의존하는 토토는 끝!\n\n데이터 통계로 스마트하게 📈"

        ctas = cfg.get("winning_ctas") or [
            "네이버에 스코어닉스를 검색하고 홈페이지에 접속해 보세요! 매일 쏟아지는 경기들의 AI 정밀 분석 픽과 리포트가 전면 무료로 공개되어 있습니다. 지금 바로 확인해 보세요!",
            "구독과 좋아요를 누르고 스코어닉스 닷컴(scorenix.com)에 로그인하시면 모든 예정 경기의 7-Factor 승률 카드를 무제한으로 보실 수 있습니다. 프로필 링크를 클릭해 보세요!"
        ]
        cta_caps = cfg.get("winning_cta_caps") or [
            "네이버 검색창에 [ 스코어닉스 ]\n\nscorenix.com 전면 무료!",
            "7-Factor 실시간 분석 카드\n\n프로필 링크 클릭 시 즉시 확인"
        ]
        cta_idx = random.randint(0, len(ctas) - 1)

        return [
            {"tts": intros[intro_idx], "caption": intro_caps[intro_idx], "scene": "intro"},
            {"tts": m1_tts, "caption": m1_cap, "scene": "match"},
            {"tts": m2_tts, "caption": m2_cap, "scene": "match"},
            {"tts": m3_tts, "caption": m3_cap, "scene": "match"},
            {"tts": ctas[cta_idx], "caption": cta_caps[cta_idx], "scene": "cta"},
        ]

    elif mode == "educational":
        intros = cfg.get("educational_intros") or [
            "아직도 느낌과 감으로 경기 결과를 찍고 계신가요? 스포츠 투자로 절대 잃지 않는 핵심 가치 투자 법칙 1가지를 알려드릴게요.",
            "잠깐! 좋아하는 팀을 응원하는 마음으로 베팅하고 있다면 이 영상을 꼭 보세요. 돈을 벌기 위해 반드시 알아야 할 데이터 공식입니다."
        ]
        intro_caps = cfg.get("educational_intro_caps") or [
            "[INVESTMENT MIND]\n스포츠 투자의 패러다임\n감에서 데이터로 바꾸기",
            "[DATA FORMULA]\n돈 버는 투자자들이\n비밀리에 쓰는 분석 원칙"
        ]
        intros = [i.replace("{today}", today) for i in intros]
        intro_caps = [c.replace("{today}", today) for c in intro_caps]
        intro_idx = random.randint(0, len(intros) - 1)

        topic_idx = random.randint(0, 1)
        if topic_idx == 0:
            m1_tts = "핵심은 바로 기대값, 즉 Expected Value 투자입니다. 이기는 팀을 잘 맞추는 것보다, 배당 대비 이길 확률이 높아 기대 가치가 플러스인 포지션만 진입하는 것이 수학적으로 이기는 유일한 길입니다."
            m1_cap = "기대값(EV) 투자 원칙\n\n배당 대비 이길 확률이 높은\n'플러스 밸류'에만 진입하라! 📊"
        else:
            m1_tts = "스코어닉스는 배당 흐름, 순위, 최근 폼, 상대 전적, 라인업 임팩트, 동기부여, 배당 밸류 등 7가지 핵심 팩터를 수학적으로 분석하여 감정이 배제된 정밀 확률을 실시간으로 도출해 냅니다."
            m1_cap = "🤖 7-Factor AI 알고리즘\n\n배당/폼/H2H/로스터/동기부여 등\n7개 빅데이터 실시간 계량화!"

        m2_tts = "감정이나 팬심은 철저히 배제하고, 수학적 기대값이 유리할 때 기계적으로 진입하는 것. 이것이 스포츠 베팅이 아닌 진짜 데이터 투자의 시작입니다."
        m2_cap = "팬심과 감정은 0%!\n\n철저하게 숫자로만 진입 📉"

        ctas = cfg.get("educational_ctas") or [
            "스코어닉스 닷컴(scorenix.com)에서는 이 모든 기대값 분석 결과를 가입 즉시 전면 무료로 실시간 공개하고 있습니다."
        ]
        cta_caps = cfg.get("educational_cta_caps") or [
            "이 모든 기대값 데이터가\n\nscorenix.com 에서 100% 무료!"
        ]
        cta_idx = random.randint(0, len(ctas) - 1)

        return [
            {"tts": intros[intro_idx], "caption": intro_caps[intro_idx], "scene": "intro"},
            {"tts": m1_tts, "caption": m1_cap, "scene": "match"},
            {"tts": m2_tts, "caption": m2_cap, "scene": "match"},
            {"tts": ctas[cta_idx], "caption": cta_caps[cta_idx], "scene": "cta"},
        ]
    elif mode == "top_picks":
        if not matches or len(matches) < 2:
            matches = _dummy()[:2]
        m1, m2 = matches[:2]

        h1, h2 = short(m1['home']), short(m2['home'])
        a1, a2 = short(m1['away']), short(m2['away'])

        intros = [
            f"오늘 밤과 새벽! 절대 놓쳐선 안 될 해외 배당판 급변 매치! 스코어닉스 AI가 엄선한 초고신뢰도 경기 탑 투 바로 브리핑합니다.",
            f"주목하세요! {today} 배당 흐름 데이터가 폭발하고 있습니다. AI 신뢰도가 급증하고 있는 오늘의 추천 매치 TOP 2 대공개!"
        ]
        intro_caps = [
            f"[HOT PICKS]\n{today} 배당 판도 변화\nAI 추천 매치 TOP 2",
            f"[TODAY TOP 2]\n실시간 데이터 기반\n오늘의 신뢰도 상위 매치"
        ]
        intro_idx = random.randint(0, len(intros) - 1)

        m1_tts = f"첫 번째 경기는 {m1['home']} 대 {m1['away']}입니다. {m1['reason']} AI 환산 승률 무려 {m1['win_prob']}%로 어느 한쪽의 통계적 우위가 매우 뚜렷하게 관측됩니다."
        m1_cap = f"{h1}\nvs\n{a1}\n\n[AI 신뢰도] {m1['win_prob']}%\n배당 홈 {m1.get('home_odds', '?')}x"

        m2_tts = f"그리고 두 번째 빅매치 {m2['home']} 대 {m2['away']} 경기의 실시간 데이터 분석 결과와 최종 승리 추천 픽은요."
        m2_cap = f"2순위: {h2} vs {a2}\n\n과연 AI가 선택한 최종 픽은?"

        m3_tts = "오직 스코어닉스 공식 웹사이트 scorenix.com 에서 100% 무료로 지금 즉시 공개하고 있습니다! 한발 빠르게 전체 대진표와 실시간 배당을 확인하러 접속하세요."
        m3_cap = "네이버에 [ 스코어닉스 ] 검색!\n\nscorenix.com 전면 무료 오픈!"

        ctas = [
            "네이버 검색창에 스코어닉스를 검색하고 프로필 링크를 클릭해 보세요! 전 세계 30개 리그의 실시간 7-팩터 승률 카드를 무료로 받아보실 수 있습니다.",
            "구독과 좋아요를 누르고 지금 바로 스코어닉스 닷컴(scorenix.com)에 로그인하세요. 오늘 완벽히 준비된 기대값 극대화 조합 픽을 전부 확인하실 수 있습니다!"
        ]
        cta_caps = [
            "실시간 스포츠 데이터 허브\n\n스코어닉스(scorenix.com)",
            "구독 & 좋아요 누르고\n\n최고의 조합 리포트 받기 🔥"
        ]
        cta_idx = random.randint(0, len(ctas) - 1)

        return [
            {"tts": intros[intro_idx], "caption": intro_caps[intro_idx], "scene": "intro"},
            {"tts": m1_tts, "caption": m1_cap, "scene": "match"},
            {"tts": m2_tts, "caption": m2_cap, "scene": "match"},
            {"tts": m3_tts, "caption": m3_cap, "scene": "cta"},
        ]

    else:
        if not matches or len(matches) < 2:
            matches = _dummy()[:2]
        m1, m2 = matches[:2]
        h1, h2 = short(m1['home']), short(m2['home'])
        a1, a2 = short(m1['away']), short(m2['away'])

        if mode == "membership":
            # 1. 멤버십(구독자용) 대본: 2개 경기 전체 완벽 정밀 분석 제공
            intros = [
                f"자, 집중! 스코어닉스 유튜브 멤버십 회원님들만을 위한 {today} AI 승률 예측 리포트입니다. 가장 확실한 꿀경기 두 개, 바로 정밀하게 뜯어볼게요.",
                f"안녕하세요! {today} 스코어닉스 멤버십 회원 전용 리포트입니다. 정밀 분석한 AI 배당 흐름과 최종 승률 예측, 지금 바로 상세히 공개합니다.",
                f"주목! 스코어닉스 VIP 멤버십 특별 브리핑입니다. {today} 배당 데이터와 정밀 통계를 심층 조합하여 엄선한 오늘의 분석 탑 투 시작합니다."
            ]
            intro_captions = [
                f"[MEMBERSHIP VIP]\n{today} VIP 전용\nAI 데이터 분석 리포트",
                f"[PREMIUM ONLY]\n{today} 멤버십 전용\n정밀 배당 예측 TOP 2",
                f"[VIP REPORT]\n{today} 실시간 분석\n승률 순위 탑 2"
            ]
            intro_idx = random.randint(0, len(intros) - 1)

            def match_tts(m, order):
                templates = [
                    f"{order} 분석 경기는, {m['home']} 대 {m['away']}입니다. {m['reason']} AI 데이터 환산 승률은 무려 {m['win_prob']}%로 홈팀 우위가 통계적으로 확실합니다.",
                    f"{order} 순위는, {m['home']}과 {m['away']}의 격돌! {m['reason']} AI 정밀 예측 승률은 {m['win_prob']}%로 최종 분석되었습니다."
                ]
                idx = 0 if "첫" in order else 1
                return templates[idx]

            def match_caption(m, h, a):
                return f"{h}\nvs\n{a}\n\n[VIP 추천] 승률 {m['win_prob']}%\n배당 홈 {m.get('home_odds', '?')}x"

            ctas = [
                "오늘 멤버십 전용 정밀 분석은 여기까지입니다! 스코어닉스 닷컴(scorenix.com)에 로그인하시면 모든 경기의 7-팩터 정밀 분석 데이터와 AI 자동 조합기를 무제한으로 사용하실 수 있습니다. 항상 감사드립니다!",
                "구독자 회원님들을 위해 엄선한 2경기 완벽 분석이었습니다. 스코어닉스 닷컴에서 VIP 계정을 즉시 연동하시고 오늘 준비된 프리미엄 조합 픽을 바로 확인해보세요!"
            ]
            cta_captions = [
                "멤버십 회원 연동 완료\n\nscorenix.com 무제한 이용",
                "VIP 전용 실시간 조합기\n\nscorenix.com 즉시 확인"
            ]
            cta_idx = random.randint(0, len(ctas) - 1)

            return [
                {"tts": intros[intro_idx], "caption": intro_captions[intro_idx], "scene": "intro"},
                {"tts": match_tts(m1, "첫 번째"), "caption": match_caption(m1, h1, a1), "scene": "match"},
                {"tts": match_tts(m2, "두 번째"), "caption": match_caption(m2, h2, a2), "scene": "match"},
                {"tts": ctas[cta_idx], "caption": cta_captions[cta_idx], "scene": "cta"},
            ]

        else:
            # 2. 마케팅(유입/일반공개용) 대본: 1번째 경기 상세 오픈 + 2번째 경기 티저
            intros = [
                f"자, 주목! {today} 스포츠 배당 데이터 분석! 스코어닉스 AI가 오늘 무조건 확인해야 할 승률 탑 투 경기를 들고 왔습니다.",
                f"다들 주목하세요! {today} 실시간 해외 배당판이 요동치고 있습니다. AI가 검증한 가장 확실한 오늘의 경기 TOP 2를 바로 공개합니다."
            ]
            intro_captions = [
                f"[PUBLIC REPORT]\n{today} 실시간\nAI 추천 경기 TOP 2",
                f"[TODAY PICK]\n{today} 대박 예상 경기\n실시간 배당 분석"
            ]
            intro_idx = random.randint(0, len(intros) - 1)

            m1_tts = f"먼저, 승률이 가장 높은 첫 번째 대박 경기는 바로 {m1['home']} 대 {m1['away']}입니다. {m1['reason']} AI 환산 승률 무려 {m1['win_prob']}%로 홈팀이 엄청나게 유리한 구도입니다."
            m1_cap = f"{h1}\nvs\n{a1}\n\n[AI 추천] 승률 {m1['win_prob']}%\n배당 홈 {m1.get('home_odds', '?')}x"

            m2_tts = f"그리고 두 번째로 예측되는 대박 매치인 {m2['home']} 대 {m2['away']} 경기의 실시간 승리 예측 정보는요."
            m2_cap = f"2순위: {h2} vs {a2}\n\n과연 AI의 최종 선택은?"

            m3_tts = "스코어닉스 닷컴 웹사이트에서 100% 전면 무료로 즉시 공개해 드리고 있습니다! 지금 바로 전체 대진표와 실시간 배당을 확인하러 오세요."
            m3_cap = "네이버에 [ 스코어닉스 ] 검색!\n\n scorenix.com 무료 확인"

            ctas = [
                "스코어닉스 닷컴(scorenix.com)에 오시면 전 세계 30개 리그의 결장자 정보와 실시간 AI 분석 카드를 가입 즉시 무료로 보실 수 있습니다. 지금 바로 프로필 링크를 클릭해 보세요!",
                "구독과 좋아요 누르고 네이버에 스코어닉스를 검색해 보세요. 매일 쏟아지는 프리미엄 AI 분석 픽을 100% 무료로 볼 수 있는 유일한 기회, 절대 놓치지 마세요!"
            ]
            cta_captions = [
                "실시간 스포츠 데이터 허브\n\n스코어닉스(scorenix.com)",
                "네이버 검색창에 [ 스코어닉스 ]\n\n프로필 링크 클릭 시 즉시 접속"
            ]
            cta_idx = random.randint(0, len(ctas) - 1)

            return [
                {"tts": intros[intro_idx], "caption": intro_captions[intro_idx], "scene": "intro"},
                {"tts": m1_tts, "caption": m1_cap, "scene": "match"},
                {"tts": m2_tts, "caption": m2_cap, "scene": "match"},
                {"tts": m3_tts, "caption": m3_cap, "scene": "cta"},
            ]




# ─── TTS (ElevenLabs 우선 → Edge TTS 폴백) ──────────────
try:
    from ai_avatar_service import (
        elevenlabs_tts, is_elevenlabs_available, is_did_available,
        create_talking_head, PRESENTER_IMAGE
    )
except ImportError:
    def elevenlabs_tts(*a, **k): return False
    def is_elevenlabs_available(): return False
    def is_did_available(): return False
    def create_talking_head(*a, **k): return False
    PRESENTER_IMAGE = ""


def apply_audio_ducking(bgm_clip, speech_clip, duck_vol=0.03, normal_vol=0.12, threshold=0.015, attack=0.15, release=0.35):
    """
    미리 말소리 진폭(Envelope)을 추출한 뒤 BGM 음량을 동적으로 조절하는 프로페셔널 오디오 덕킹 필터
    """
    duration = speech_clip.duration
    fps = 10  # 0.1초마다 샘플링
    n_samples = int(duration * fps)
    times = np.linspace(0, duration, n_samples)
    
    amps = []
    for t in times:
        try:
            frame = speech_clip.get_frame(t)
            amps.append(np.max(np.abs(frame)))
        except Exception:
            amps.append(0.0)
            
    envelope = []
    current_vol = normal_vol
    for amp in amps:
        target_vol = duck_vol if amp > threshold else normal_vol
        if target_vol < current_vol:
            current_vol = current_vol - (current_vol - target_vol) * (1.0 / max(1, fps * attack))
            current_vol = max(current_vol, duck_vol)
        else:
            current_vol = current_vol + (target_vol - current_vol) * (1.0 / max(1, fps * release))
            current_vol = min(current_vol, normal_vol)
        envelope.append(current_vol)
        
    def get_vol(t):
        if isinstance(t, np.ndarray):
            indices = np.clip((t * fps).astype(int), 0, len(envelope) - 1)
            return np.array([envelope[idx] for idx in indices])[:, np.newaxis]
        else:
            idx = min(int(t * fps), len(envelope) - 1)
            return envelope[idx]
            
    return bgm_clip.fl(lambda gf, t: gf(t) * get_vol(t))


async def _tts_async(text, path, lang="ko"):
    import edge_tts
    cfg = load_video_settings()
    
    # 언어별 최적의 성우 지정
    voice_map = {
        "ko": cfg.get("tts_voice_ko", "ko-KR-SunHiNeural"),
        "en": cfg.get("tts_voice_en", "en-US-EmmaNeural"),
        "ja": cfg.get("tts_voice_ja", "ja-JP-NanamiNeural")
    }
    voice = voice_map.get(lang, "ko-KR-SunHiNeural")
    
    # 속도를 언어별로 튜닝
    rate_map = {
        "ko": cfg.get("tts_speed_ko", "+15%"),
        "en": cfg.get("tts_speed_en", "+12%"),
        "ja": cfg.get("tts_speed_ja", "+10%")
    }
    rate = rate_map.get(lang, "+15%")
    
    # 피치 지정
    pitch_map = {
        "ko": cfg.get("tts_pitch_ko", "+5Hz"),
        "en": cfg.get("tts_pitch_en", "+0Hz"),
        "ja": cfg.get("tts_pitch_ja", "+0Hz")
    }
    pitch = pitch_map.get(lang, "+5Hz" if lang == "ko" else "+0Hz")
    
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(path)


def generate_tts(text, path, lang="ko"):
    """ElevenLabs (최고 품질) → Edge TTS (무료 폴백) → gTTS (최종 폴백)"""
    # 1차: ElevenLabs (API 키 있으면)
    if is_elevenlabs_available():
        if elevenlabs_tts(text, path):
            return
        print("    [>] ElevenLabs failed, trying Edge TTS...")

    # 2차: Edge TTS
    try:
        asyncio.run(_tts_async(text, path, lang))
        return
    except Exception as e:
        print(f"    [!] Edge TTS failed ({e}), falling back to gTTS")

    # 3차: gTTS
    from gtts import gTTS
    gTTS(text=text, lang=lang).save(path)



# ─── 자막 이미지 렌더링 ─────────────────────────────────
def render_caption(text, scene="match", mode="marketing"):
    """장면 유형별/테마별 디자인이 다른 자막 카드 생성 (자동 줄바꿈 + 폰트 자동 축소)"""
    cfg = load_video_settings()
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 폰트 로드 함수
    def load_font(size, bold=False):
        try:
            font_ko = cfg.get("subtitle_font_ko", "malgun.ttf")
            font_bold_ko = cfg.get("subtitle_font_bold_ko", "malgunbd.ttf")
            name = font_bold_ko if bold else font_ko
            return ImageFont.truetype(name, size)
        except Exception:
            return ImageFont.load_default()

    # 안전 영역: 화면 너비의 85%
    safe_w = int(WIDTH * 0.85)

    # 장면별 기본 폰트 크기
    base_size_intro = int(cfg.get("subtitle_base_size_intro", 68))
    base_size_match = int(cfg.get("subtitle_base_size_match", 54))
    base_size = base_size_intro if scene == "intro" else base_size_match

    # 자동 줄바꿈 + 폰트 크기 자동 축소
    font = load_font(base_size, bold=(scene == "intro"))
    wrapped = _wrap_text(draw, text, font, safe_w)

    # 줄이 너무 많으면 폰트 축소 (최소 36까지)
    while len(wrapped) > 9 and base_size > 36:
        base_size -= 4
        font = load_font(base_size, bold=(scene == "intro"))
        wrapped = _wrap_text(draw, text, font, safe_w)

    # 각 줄 크기 계산
    spacing = 16
    line_data = []
    total_h = 0
    for line in wrapped:
        if not line.strip():
            total_h += 14
            line_data.append(("", 0, 14))
            continue
        bbox = draw.textbbox((0, 0), line, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        total_h += h + spacing
        line_data.append((line, w, h))

    # 박스 크기
    pad = 45
    content_w = max((d[1] for d in line_data), default=0)
    box_w = min(content_w + pad * 2, WIDTH - 60)

    # 장면별 Y 위치
    if scene == "intro":
        center_y = HEIGHT // 2
    elif scene == "cta":
        center_y = HEIGHT // 2 + 100
    else:
        center_y = HEIGHT // 2 + 80

    box_h = total_h + pad * 2
    box_x1 = (WIDTH - box_w) // 2
    box_y1 = center_y - box_h // 2
    box_x2 = box_x1 + box_w
    box_y2 = box_y1 + box_h

    # 장면별/테마별 컬러 스킴 (프리미엄 네온 테마)
    if scene == "intro":
        if mode == "winning":
            box_color = (15, 25, 20, 230)  # 다크 그린
            accent = (255, 215, 0, 255)     # 골드
            border = (255, 215, 0, 180)
        elif mode == "educational":
            box_color = (25, 25, 30, 230)  # 다크 그레이
            accent = (0, 255, 180, 255)     # 민트
            border = (0, 255, 180, 180)
        elif mode == "top_picks":
            box_color = (30, 15, 30, 230)  # 다크 바이올렛
            accent = (255, 100, 255, 255)   # 네온 핑크
            border = (255, 100, 255, 180)
        else:
            box_color = (10, 10, 30, 230)
            accent = (255, 215, 0, 255)
            border = (255, 215, 0, 180)
    elif scene == "cta":
        if mode == "winning":
            box_color = (15, 25, 20, 230)
            accent = (255, 215, 0, 255)
            border = (255, 215, 0, 180)
        elif mode == "educational":
            box_color = (25, 25, 30, 230)
            accent = (0, 255, 180, 255)
            border = (0, 255, 180, 180)
        elif mode == "top_picks":
            box_color = (30, 15, 30, 230)
            accent = (255, 100, 255, 255)
            border = (255, 100, 255, 180)
        else:
            box_color = (30, 10, 15, 230)
            accent = (255, 80, 80, 255)
            border = (255, 80, 80, 180)
    else:
        if mode == "winning":
            box_color = (15, 20, 15, 220)
            accent = (100, 220, 160, 255)   # 라이트 에메랄드
            border = (100, 220, 160, 180)
        elif mode == "educational":
            box_color = (20, 20, 25, 220)
            accent = (0, 255, 180, 255)
            border = (0, 255, 180, 180)
        elif mode == "top_picks":
            box_color = (25, 15, 25, 220)
            accent = (255, 100, 255, 255)
            border = (255, 100, 255, 180)
        else:
            box_color = (15, 20, 35, 220)
            accent = (0, 255, 255, 255)
            border = (0, 200, 255, 180)

    # 그림자(Drop Shadow) 효과 추가
    try:
        from PIL import ImageFilter
        shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle([box_x1 + 15, box_y1 + 15, box_x2 + 15, box_y2 + 15], radius=30, fill=(0, 0, 0, 180))
        shadow = shadow.filter(ImageFilter.GaussianBlur(15))
        img.paste(shadow, (0, 0), shadow)

        # 반투명 박스 + 테두리
        draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], radius=25, fill=box_color)
        draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], radius=25, outline=border, width=3)
        # 이너 글로우(Inner Glow) 느낌을 위한 얇은 추가 테두리
        draw.rounded_rectangle([box_x1+2, box_y1+2, box_x2-2, box_y2-2], radius=23, outline=(255, 255, 255, 30), width=1)
    except AttributeError:
        draw.rectangle([box_x1, box_y1, box_x2, box_y2], fill=box_color)

    # 텍스트 렌더링 (그림자 추가)
    cur_y = box_y1 + pad
    for line, w, h in line_data:
        if not line:
            cur_y += 14
            continue
        x = (WIDTH - w) // 2

        highlight_keys = ["승률", "승리", "유리", "TOP", "확인", "배당", "격차", "%", "vs", "DATA", "LIVE", "ODDS", "AI", "HOME", ">>", "리포트", "적중", "성공", "기대값", "Expected", "공개", "꿀팁", "1가지를"]
        color = accent if any(k in line for k in highlight_keys) else (255, 255, 255, 255)

        # 텍스트 강한 그림자
        draw.text((x + 3, cur_y + 3), line, font=font, fill=(0, 0, 0, 220))
        draw.text((x + 1, cur_y + 1), line, font=font, fill=(0, 0, 0, 150))
        draw.text((x, cur_y), line, font=font, fill=color)
        cur_y += h + spacing

    return np.array(img)


def _wrap_text(draw, text, font, max_width):
    """텍스트를 max_width 내로 자동 줄바꿈"""
    result = []
    for paragraph in text.split('\n'):
        if not paragraph.strip():
            result.append("")
            continue
        # 한글은 글자 단위, 영문/숫자는 단어 단위
        words = []
        buf = ""
        for ch in paragraph:
            if ch == ' ':
                if buf:
                    words.append(buf)
                    buf = ""
                words.append(' ')
            else:
                buf += ch
        if buf:
            words.append(buf)

        current = ""
        for w in words:
            test = current + w
            bbox = draw.textbbox((0, 0), test.strip(), font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = test
            else:
                if current.strip():
                    result.append(current.strip())
                current = w.lstrip()
        if current.strip():
            result.append(current.strip())
    return result


# ─── 헤드라인 바 ────────────────────────────────────────
def render_headline():
    img = Image.new("RGBA", (WIDTH, 160), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("malgunbd.ttf", 38)
    except Exception:
        font = ImageFont.load_default()

    today = datetime.datetime.now().strftime("%m월 %d일")
    text = f"[ {today} ]  SCORENIX  AI  REPORT"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]

    # 상단 바
    try:
        draw.rounded_rectangle([30, 10, WIDTH - 30, 140], radius=20,
                               fill=(10, 10, 35, 230), outline=(100, 210, 255, 160), width=2)
    except AttributeError:
        draw.rectangle([30, 10, WIDTH - 30, 140], fill=(10, 10, 35, 230))

    x = (WIDTH - tw) // 2
    draw.text((x, 48), text, font=font, fill=(220, 230, 255, 255))
    return np.array(img)


# ─── Ken Burns Effect ───────────────────────────────────
def ken_burns(clip, duration, zoom_start=1.0, zoom_end=1.08):
    """정지 이미지에 느린 줌인 효과를 적용하여 영상 느낌 연출"""
    w, h = clip.size

    def make_frame(t):
        progress = t / duration if duration > 0 else 0
        zoom = zoom_start + (zoom_end - zoom_start) * progress
        frame = clip.get_frame(0)

        # 줌 크롭 계산
        new_w = int(w / zoom)
        new_h = int(h / zoom)
        x1 = (w - new_w) // 2
        y1 = (h - new_h) // 2
        cropped = frame[y1:y1 + new_h, x1:x1 + new_w]

        # 원본 크기로 리사이즈
        pil_img = Image.fromarray(cropped)
        pil_img = pil_img.resize((w, h), Image.LANCZOS)
        return np.array(pil_img)

    from moviepy.video.VideoClip import VideoClip
    return VideoClip(make_frame, duration=duration)


# ─── BGM ────────────────────────────────────────────────
def get_bgm():
    bgm_path = os.path.join(os.path.dirname(__file__), "bgm.mp3")
    if not os.path.exists(bgm_path):
        print("  [~] BGM not found - downloading free sample...")
        import urllib.request
        try:
            url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
            urllib.request.urlretrieve(url, bgm_path)
            print("  [OK] BGM downloaded")
        except Exception as e:
            print(f"  [!] BGM download failed: {e}")
    return bgm_path


# ─── 메인 영상 생성 ─────────────────────────────────────
def generate_video(bg_video_path, output_path, auto_upload=False, use_avatar=False, mode="membership", lang="ko"):
    if mode == "winning":
        try:
            from app.models.prediction_db import get_recent_ai_predictions
            import asyncio
            matches = asyncio.run(get_recent_ai_predictions(limit=5, status="HIT"))
            print(f"  [AI] Loaded {len(matches)} HIT predictions from Firestore")
        except Exception as e:
            print(f"  [!] Failed to load HIT predictions: {e}")
            matches = []
    else:
        matches = fetch_top_matches()

    script = build_script(matches, mode=mode)

    # ─── 다국어 번역 (Gemini API 이용) ───
    if lang != "ko":
        print(f"\n[i18n] Translating video content to '{lang}' via Gemini...")
        try:
            from app.services.gemini_service import translate_text
            for i, seg in enumerate(script):
                orig_tts = seg["tts"]
                orig_cap = seg["caption"]
                seg["tts"] = translate_text(orig_tts, lang)
                seg["caption"] = translate_text(orig_cap, lang)
                print(f"  [{i+1}/{len(script)}] Translated: {seg['tts'][:20]}...")
        except Exception as trans_e:
            print(f"  [!] Translation failed, using original script: {trans_e}")

    # AI 아바타 모드 체크
    avatar_mode = use_avatar and is_did_available() and is_elevenlabs_available()

    print("=" * 50)
    if avatar_mode:
        print(" [AI] Scorenix AI Avatar Shorts v4.0 - Rendering")
    else:
        print(" [>>] Scorenix Premium Shorts v4.0 - Rendering")
    if is_elevenlabs_available():
        print(" [MIC] TTS: ElevenLabs (premium)")
    else:
        print(" [MIC] TTS: Edge TTS (free)")
    print("=" * 50)

    # ─── 실시간 플랫폼 모바일 화면 자동 녹화 ───
    if not use_avatar and mode in ("marketing", "winning", "educational", "top_picks"):
        if os.path.exists(bg_video_path):
            try:
                os.remove(bg_video_path)
            except Exception:
                pass
        try:
            from app.services.browser_recorder import record_page
            print(f"\n[>>] Real-time Browser Recording started for mode '{mode}'...")
            
            target_url = "https://scorenix.com"
            tmp_webm = os.path.join(os.path.dirname(__file__), "_tmp_record.webm")
            
            import asyncio
            success = asyncio.run(record_page(target_url, tmp_webm, duration=60.0))
            
            if success and os.path.exists(tmp_webm):
                print(f"  [+] Web screen recorded. Compiling silent background: {bg_video_path}")
                bg_clip = VideoFileClip(tmp_webm)
                bg_clip.without_audio().write_videofile(
                    bg_video_path,
                    codec="libx264",
                    audio=False,
                    preset="ultrafast",
                    threads=4
                )
                bg_clip.close()
                try:
                    os.remove(tmp_webm)
                except Exception:
                    pass
                print("  [OK] Dynamic web screen background compiled successfully!")
            else:
                print("  [!] Browser recording failed. Falling back to static templates.")
        except Exception as record_err:
            print(f"  [FAIL] Browser recording error: {record_err}. Using fallback templates.")

    # 1) 배경 준비
    bg_filename = "premium_bg.png"
    if mode == "winning":
        bg_filename = "premium_bg_winning.png"
    elif mode == "educational":
        bg_filename = "premium_bg_edu.png"
    elif mode == "top_picks":
        bg_filename = "premium_bg_toppicks.png"

    ai_bg = os.path.join(os.path.dirname(__file__), bg_filename)
    if not os.path.exists(ai_bg):
        ai_bg = os.path.join(os.path.dirname(__file__), "premium_bg.png")

    if os.path.exists(bg_video_path):
        base_bg = VideoFileClip(bg_video_path).resize(height=HEIGHT)
        base_bg = base_bg.crop(x_center=base_bg.w // 2, y_center=HEIGHT // 2,
                               width=WIDTH, height=HEIGHT)
        bg_is_video = True
    elif os.path.exists(ai_bg):
        base_bg = ImageClip(ai_bg).set_duration(120)
        # 안전하게 리사이즈
        base_bg = base_bg.resize(newsize=(WIDTH, HEIGHT))
        bg_is_video = False
        print(f"  [*] AI background image loaded: {os.path.basename(ai_bg)}")
    else:
        base_bg = ColorClip(size=(WIDTH, HEIGHT), color=(12, 12, 25)).set_duration(120)
        bg_is_video = False

    # 1.1) 워터마크 채널 로고 준비
    logo_filename = "match_briefing_logo.png"
    if mode == "winning":
        logo_filename = "ai_vs_bookmaker_logo.png"
    elif mode == "educational":
        logo_filename = "investor_academy_logo.png"

    logo_path = os.path.join(os.path.dirname(__file__), logo_filename)
    if not os.path.exists(logo_path):
        # Fallback to video/
        logo_path = os.path.join(os.path.dirname(__file__), "video", logo_filename)

    logo_clip = None
    if os.path.exists(logo_path):
        try:
            # 110x110 크기 조절 후 우측 상단 고정
            logo_clip = (ImageClip(logo_path)
                         .resize(newsize=(110, 110))
                         .set_position((WIDTH - 150, 30))
                         .set_duration(120))
            print(f"  [*] Loaded channel logo: {logo_filename}")
        except Exception as logo_err:
            print(f"  [!] Failed to load logo: {logo_err}")

    # 2) 헤드라인
    hl_arr = render_headline()
    hl_clip = ImageClip(hl_arr).set_position(("center", 100))

    # 3) 장면별 렌더링
    clips = []
    avatar_clip_cache = None  # D-ID 영상은 전체 대본으로 1번만 생성

    for i, seg in enumerate(script):
        print(f"  [{i + 1}/{len(script)}] {seg['scene']}: {seg['tts'][:30]}...")

        # TTS
        audio_path = os.path.join(os.path.dirname(__file__), f"_tmp_audio_{i}.mp3")
        generate_tts(seg["tts"], audio_path, lang=lang)
        audio = AudioFileClip(audio_path)
        dur = audio.duration

        # ── 배경 결정 ──
        used_avatar = False

        if avatar_mode and seg["scene"] in ("intro", "cta"):
            # D-ID 아바타 모드: 인트로/CTA에 AI 앵커 영상 사용
            avatar_video_path = os.path.join(
                os.path.dirname(__file__), f"_tmp_avatar_{i}.mp4"
            )
            print(f"    [AI] Generating D-ID avatar for {seg['scene']}...")
            if create_talking_head(audio_path, avatar_video_path):
                try:
                    avatar_clip = VideoFileClip(avatar_video_path)
                    # 9:16 크기로 맞추기
                    avatar_clip = avatar_clip.resize(height=HEIGHT)
                    if avatar_clip.w > WIDTH:
                        avatar_clip = avatar_clip.crop(
                            x_center=avatar_clip.w // 2,
                            width=WIDTH, height=HEIGHT
                        )
                    elif avatar_clip.w < WIDTH:
                        # 좌우 검정 패딩
                        avatar_clip = CompositeVideoClip(
                            [ColorClip((WIDTH, HEIGHT), (10, 10, 25)).set_duration(dur),
                             avatar_clip.set_position("center")],
                            size=(WIDTH, HEIGHT)
                        )
                    bg_seg = avatar_clip.set_duration(dur)
                    used_avatar = True
                    print(f"    [OK] Avatar video applied!")
                except Exception as e:
                    print(f"    [!] Avatar clip failed: {e}")

        if not used_avatar:
            # 기존 방식: 정적 배경 (Ken Burns 제거하여 속도 최적화)
            if bg_is_video:
                t0 = (sum(c.duration for c in clips)) % base_bg.duration
                t1 = min(t0 + dur, base_bg.duration)
                bg_seg = base_bg.subclip(t0, t1)
                if bg_seg.duration < dur:
                    bg_seg = bg_seg.set_duration(dur)
            else:
                bg_seg = base_bg.set_duration(dur)

        bg_seg = bg_seg.set_audio(audio)

        # 자막 카드 (아바타 모드일 때는 하단에 배치, 일반 모드일 때는 중앙 또는 하단 고정)
        cap_arr = render_caption(seg["caption"], seg["scene"], mode=mode)
        
        if used_avatar:
            # 아바타 영상 위에는 자막을 하단 고정 (위치 고정)
            cap_clip = (ImageClip(cap_arr)
                        .set_duration(dur)
                        .set_position(("center", HEIGHT - 500))
                        .crossfadein(0.3)
                        .crossfadeout(0.2))
        else:
            # 일반 모드에서는 캡션을 화면 중앙 부근에 배치 (동적 애니메이션 함수 제거하여 속도 최적화)
            if seg["scene"] == "intro":
                y_pos = (HEIGHT - cap_arr.shape[0]) // 2
            elif seg["scene"] == "cta":
                y_pos = (HEIGHT - cap_arr.shape[0]) // 2 + 100
            else:
                y_pos = (HEIGHT - cap_arr.shape[0]) // 2 + 80
                
            cap_clip = (ImageClip(cap_arr)
                        .set_duration(dur)
                        .set_position(("center", y_pos))
                        .crossfadein(0.3)
                        .crossfadeout(0.2))

        layers = [bg_seg]
        if not used_avatar:
            layers.append(hl_clip.set_duration(dur))
            if logo_clip:
                layers.append(logo_clip.set_duration(dur))
        layers.append(cap_clip)

        comp = CompositeVideoClip(layers)
        clips.append(comp)

    # 4) 연결
    print("\n  [CUT] Stitching scenes...")
    final = concatenate_videoclips(clips, method="compose")

    # 5) BGM 믹싱 (덕킹 효과 적용)
    bgm_path = get_bgm()
    if os.path.exists(bgm_path):
        print("  [~] Mixing BGM...")
        from moviepy.audio.fx.volumex import volumex
        from moviepy.audio.AudioClip import CompositeAudioClip

        bgm = AudioFileClip(bgm_path)
        if bgm.duration < final.duration:
            from moviepy.audio.fx.audio_loop import audio_loop
            bgm = audio_loop(bgm, duration=final.duration)
        else:
            bgm = bgm.subclip(0, final.duration)

        # 프로페셔널 덕킹 효과 적용
        try:
            print("  [~] Applying audio ducking to BGM...")
            bgm = apply_audio_ducking(bgm, final.audio)
        except Exception as duck_err:
            print(f"  [!] Ducking failed ({duck_err}) - falling back to fixed BGM volume")
            bgm = bgm.fx(volumex, 0.08)

        final = final.set_audio(
            CompositeAudioClip([final.audio, bgm])
        )

    # 6) 렌더링 (고품질)
    print("  [REC] Encoding final video (high quality)...")
    final.write_videofile(
        output_path,
        fps=15,   # Cloud Run 환경에서의 성능 극대화 및 타임아웃 방지를 위해 15fps로 조율
        codec="libx264",
        audio_codec="aac",
        bitrate="8000k",   # 고화질 비트레이트
        threads=4,
        preset="ultrafast",   # Cloud Run 환경에서의 타임아웃 방지를 위해 ultrafast로 유지
    )

    # 7) 임시 파일 정리
    for i in range(len(script)):
        for pattern in [f"_tmp_audio_{i}.mp3", f"_tmp_avatar_{i}.mp4"]:
            p = os.path.join(os.path.dirname(__file__), pattern)
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

    print(f"\n  [OK] Done! → {output_path}")

    # 8) 유튜브 업로드
    if auto_upload:
        _upload(output_path)

    return output_path


def _get_desktop():
    """사용자 실제 바탕화면 경로 (OneDrive 포함)"""
    home = os.path.expanduser("~")
    onedrive = os.path.join(home, "OneDrive", "Desktop")
    regular = os.path.join(home, "Desktop")
    return onedrive if os.path.isdir(onedrive) else regular


def _upload(video_path):
    import random
    try:
        from app.services.youtube_uploader import upload_to_youtube
        now = datetime.datetime.now()

        # 제목 변형 (매번 다른 제목)
        titles = [
            f"[AI 분석] {now.strftime('%m/%d')} 배당 데이터가 말하는 오늘의 경기 #shorts",
            f"{now.strftime('%m월%d일')} AI가 수치로 찍은 경기 분석 | SCORENIX #shorts",
            f"배당 데이터 분석 리포트 {now.strftime('%m.%d %H시')} #shorts",
            f"[{now.strftime('%m/%d')}] 오늘의 AI 데이터 분석 픽 #shorts",
            f"AI 배당 분석 {now.strftime('%m월 %d일 %H시')} 기준 리포트 #shorts",
        ]

        desc = (
            f"✦ {now.strftime('%Y년 %m월 %d일 %H시')} 기준 AI 데이터 분석\n\n"
            "스코어닉스 AI가 실시간 배당 데이터를 분석하여\n"
            "통계적으로 유리한 경기를 선별한 리포트입니다.\n\n"
            "※ 본 영상은 데이터 분석 결과이며 투자 권유가 아닙니다.\n\n"
            "👉 전체 분석 리포트: https://scorenix.com\n\n"
            "#스포츠분석 #AI분석 #배당분석 #데이터분석 #shorts"
        )
        tags = ["스포츠분석", "AI분석", "배당분석", "데이터분석",
                "토토분석", "프로토", "shorts", "스코어닉스"]

        vid = upload_to_youtube(video_path, random.choice(titles), desc, tags)
        if vid:
            print(f"  [OK] YouTube upload success! https://youtu.be/{vid}")
        else:
            print("  [X] YouTube upload failed")

        # ─── 구글 드라이브 업로드 비활성화 (OneDrive 동기화 대체) ───
        # print("  [Google Drive] Uploading video to shared Google Drive folder...")
        # try:
        #     from app.services.google_drive_service import google_drive_service
        #     from app.models.config_db import load_config_to_env
        #     load_config_to_env()
        #     drive_link = google_drive_service.upload_video(video_path)
        #     if drive_link:
        #         print(f"  [OK] Google Drive upload success! Link: {drive_link}")
        #     else:
        #         print("  [X] Google Drive upload failed")
        # except Exception as drive_e:
        #     print(f"  [X] Google Drive error: {drive_e}")

        return bool(vid)
    except Exception as e:
        print(f"  [X] YouTube / Upload error: {e}")
        return False


# ─── CLI Entry Point ────────────────────────────────────
if __name__ == "__main__":
    import argparse
    import time

    parser = argparse.ArgumentParser(description="Scorenix Shorts Generator v4.0")
    parser.add_argument("--loop", action="store_true", help="24H auto-upload mode")
    parser.add_argument("--interval", type=int, default=3, help="Hours between uploads")
    parser.add_argument("--avatar", action="store_true",
                        help="D-ID AI avatar mode (requires ELEVENLABS_API_KEY & DID_API_KEY)")
    parser.add_argument("--mode", type=str, choices=["marketing", "winning", "educational", "top_picks", "membership"],
                        help="Directly specify the video mode without interactive prompt")
    parser.add_argument("--auto-upload", action="store_true",
                        help="Skip prompt and upload the video to YouTube automatically")
    parser.add_argument("--lang", type=str, default="ko", choices=["ko", "en", "ja", "all"],
                        help="Target language for script/TTS (ko, en, ja, all)")
    args = parser.parse_args()

    # AI 서비스 상태 확인
    print()
    if args.avatar:
        try:
            from ai_avatar_service import check_status
            check_status()
        except ImportError:
            print("  [!] ai_avatar_service.py not found")
    print()

    desktop = _get_desktop()
    output_dir = os.path.join(desktop, "scorenix_shorts")
    os.makedirs(output_dir, exist_ok=True)

    if args.loop:
        print("=" * 50)
        mode = "[AI] AI Avatar" if args.avatar else "[>>] Premium"
        print(f" [!] 24H Auto-Upload [{mode}] (every {args.interval}h)")
        print(f" [DIR] Output: {output_dir}")
        print("=" * 50)

        upload_count = 0
        fail_count = 0

        while True:
            try:
                ts = datetime.datetime.now().strftime("%m%d_%H%M")
                hour = datetime.datetime.now().hour

                # KST 시간대별 쇼츠 유형 로테이션
                if 8 <= hour < 11:
                    marketing_mode = "top_picks"
                elif 12 <= hour < 15:
                    marketing_mode = "educational"
                elif 16 <= hour < 19:
                    marketing_mode = "winning"
                else:
                    marketing_mode = "marketing"

                # 멤버십 정밀분석용 & 마케팅 유입용 영상 두 가지를 항상 분리해서 생성!
                out_membership = os.path.join(output_dir, f"scorenix_membership_{ts}.mp4")
                out_marketing = os.path.join(output_dir, f"scorenix_shorts_{marketing_mode}_{ts}.mp4")

                print(f"\n[+] Generating MEMBERSHIP (Subscriber) Video: {out_membership}")
                generate_video("background.mp4", out_membership,
                               auto_upload=False, use_avatar=args.avatar, mode="membership")

                print(f"\n[+] Generating MARKETING [Type: {marketing_mode}] Video: {out_marketing}")
                generate_video("background.mp4", out_marketing,
                               auto_upload=False, use_avatar=args.avatar, mode=marketing_mode)

                # 마케팅 영상을 유튜브 업로드
                success = _upload(out_marketing)
                if success:
                    upload_count += 1
                    fail_count = 0
                    print(f"  [SAVE] Both videos successfully saved on Desktop at: {output_dir}")
                else:
                    fail_count += 1

                print(f"\n  [#] Total uploads: {upload_count} | Fails: {fail_count}")

                if fail_count >= 3:
                    print("  [!] 3 consecutive failures - waiting 30min")
                    time.sleep(1800)
                    fail_count = 0
                    continue

            except Exception as e:
                print(f"\n  [X] Pipeline error: {e}")
                fail_count += 1

            next_time = datetime.datetime.now() + datetime.timedelta(hours=args.interval)
            print(f"\n  [Z] Next upload at {next_time.strftime('%H:%M')}")
            time.sleep(args.interval * 3600)
    else:
        # 수동 모드 또는 비대화식 단일 실행 모드
        ts = datetime.datetime.now().strftime("%m%d_%H%M")
        
        if args.mode:
            marketing_mode = args.mode
            print(f"\n[>>] Non-interactive execution. Selected Mode: {marketing_mode.upper()}")
        else:
            print("\n[>>] Select MARKETING video mode:")
            print("  1. 경기 분석 티저 (marketing)")
            print("  2. 적중 인증 자랑 (winning)")
            print("  3. 가치 투자 교육 (educational)")
            print("  4. 오늘의 TOP 3 티저 (top_picks)")
            mode_choice = input("Select mode (1-4) [Default: 1]: ").strip()
            
            if mode_choice == "2":
                marketing_mode = "winning"
            elif mode_choice == "3":
                marketing_mode = "educational"
            elif mode_choice == "4":
                marketing_mode = "top_picks"
            else:
                marketing_mode = "marketing"

        # 3대 타겟 다국어 루프 생성
        target_langs = ["ko", "en", "ja"] if args.lang == "all" else [args.lang]
        
        for lang in target_langs:
            # 멤버십 정밀분석용 & 마케팅 유입용 영상 두 가지를 항상 분리해서 생성!
            out_membership = os.path.join(output_dir, f"scorenix_membership_{lang}_{ts}.mp4")
            out_marketing = os.path.join(output_dir, f"scorenix_shorts_{marketing_mode}_{lang}_{ts}.mp4")

            print(f"\n[+] Generating MEMBERSHIP (Subscriber) Video ({lang}): {out_membership}")
            generate_video("background.mp4", out_membership,
                           auto_upload=False, use_avatar=args.avatar, mode="membership", lang=lang)

            print(f"\n[+] Generating MARKETING [Type: {marketing_mode}] Video ({lang}): {out_marketing}")
            generate_video("background.mp4", out_marketing,
                           auto_upload=False, use_avatar=args.avatar, mode=marketing_mode, lang=lang)

        print(f"  [SAVE] Generated videos successfully saved on Desktop at: {output_dir}")

        if args.auto_upload:
            print(f"\n[>>] Auto-upload enabled. Uploading {marketing_mode.upper()} video to YouTube automatically...")
            _upload(out_marketing)
        else:
            choice = input(f"\n[>>] Upload {marketing_mode.upper()} video to YouTube? (y/n): ")
            if choice.strip().lower() == "y":
                _upload(out_marketing)

        try:
            os.startfile(output_dir)
        except Exception:
            pass

