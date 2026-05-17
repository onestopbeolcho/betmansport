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
        return out[:3] if len(out) >= 3 else _dummy()
    except Exception as e:
        print(f"  [!] Data load failed: {e}")
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


# ─── 대본 (매번 다른 템플릿) ──────────────────────────────
def build_script(matches, mode="membership"):
    """
    랜덤 템플릿으로 매번 다른 느낌의 대본을 생성합니다.
    - membership: 3개 경기 모두 명확한 분석 및 승률 예측 제공 (구독자용 분석 명확한 영상)
    - marketing: 1번째 경기 상세 오픈 + 2, 3번째 경기는 스코어닉스 웹사이트 방문 유도 (마케팅/유입용 영상)
    """
    import random
    m1, m2, m3 = matches
    today = datetime.datetime.now().strftime("%m월 %d일")
    hour = datetime.datetime.now().strftime("%H시")

    # 팀명 축약 (긴 이름이 박스를 넘기지 않도록)
    def short(name, max_len=8):
        if len(name) <= max_len:
            return name
        if '&' in name:
            return name.split('&')[0].strip()
        return name[:max_len]

    h1, h2, h3 = short(m1['home']), short(m2['home']), short(m3['home'])
    a1, a2, a3 = short(m1['away']), short(m2['away']), short(m3['away'])

    if mode == "membership":
        # 1. 멤버십(구독자용) 대본: 3개 경기 전체 완벽 정밀 분석 제공
        intros = [
            f"자, 집중! 스코어닉스 유튜브 멤버십 회원님들만을 위한 {today} AI 승률 예측 리포트입니다. 가장 확실한 꿀경기 세 개, 바로 정밀하게 뜯어볼게요.",
            f"안녕하세요! {today} 스코어닉스 멤버십 회원 전용 리포트입니다. 정밀 분석한 AI 배당 흐름과 최종 승률 예측, 지금 바로 상세히 공개합니다.",
            f"주목! 스코어닉스 VIP 멤버십 특별 브리핑입니다. {today} 배당 데이터와 정밀 통계를 심층 조합하여 엄선한 오늘의 분석 탑 쓰리 시작합니다."
        ]
        intro_captions = [
            f"[MEMBERSHIP VIP]\n{today} VIP 전용\nAI 데이터 분석 리포트",
            f"[PREMIUM ONLY]\n{today} 멤버십 전용\n정밀 배당 예측 TOP 3",
            f"[VIP REPORT]\n{today} 실시간 분석\n승률 순위 탑 3"
        ]
        intro_idx = random.randint(0, len(intros) - 1)

        def match_tts(m, order):
            templates = [
                f"{order} 분석 경기는, {m['home']} 대 {m['away']}입니다. {m['reason']} AI 데이터 환산 승률은 무려 {m['win_prob']}%로 홈팀 우위가 통계적으로 확실합니다.",
                f"{order} 순위는, {m['home']}과 {m['away']}의 격돌! {m['reason']} AI 정밀 예측 승률은 {m['win_prob']}%로 최종 분석되었습니다.",
                f"마지막 {order} 경기는 {m['home']} 대 {m['away']}입니다. {m['reason']} 통계적 승률 {m['win_prob']}%로 홈팀의 우세가 예상됩니다."
            ]
            idx = 0 if "첫" in order else (1 if "두" in order else 2)
            return templates[idx]

        def match_caption(m, h, a):
            return f"{h}\nvs\n{a}\n\n[VIP 추천] 승률 {m['win_prob']}%\n배당 홈 {m.get('home_odds', '?')}x"

        ctas = [
            "오늘 멤버십 전용 정밀 분석은 여기까지입니다! 스코어닉스 닷컴(scorenix.com)에 로그인하시면 모든 경기의 7-팩터 정밀 분석 데이터와 AI 자동 조합기를 무제한으로 사용하실 수 있습니다. 항상 감사드립니다!",
            "구독자 회원님들을 위해 엄선한 3경기 완벽 분석이었습니다. 스코어닉스 닷컴에서 VIP 계정을 즉시 연동하시고 오늘 준비된 프리미엄 조합 픽을 바로 확인해보세요!"
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
            {"tts": match_tts(m3, "세 번째"), "caption": match_caption(m3, h3, a3), "scene": "match"},
            {"tts": ctas[cta_idx], "caption": cta_captions[cta_idx], "scene": "cta"},
        ]

    else:
        # 2. 마케팅(유입/일반공개용) 대본: 1번째 경기 상세 오픈 + 2/3번째 경기 티저
        intros = [
            f"자, 주목! {today} 스포츠 배당 데이터 분석! 스코어닉스 AI가 오늘 무조건 확인해야 할 승률 탑 쓰리 경기를 들고 왔습니다.",
            f"다들 주목하세요! {today} 실시간 해외 배당판이 요동치고 있습니다. AI가 검증한 가장 확실한 오늘의 경기 TOP 3를 바로 공개합니다."
        ]
        intro_captions = [
            f"[PUBLIC REPORT]\n{today} 실시간\nAI 추천 경기 TOP 3",
            f"[TODAY PICK]\n{today} 대박 예상 경기\n실시간 배당 분석"
        ]
        intro_idx = random.randint(0, len(intros) - 1)

        m1_tts = f"먼저, 승률이 가장 높은 첫 번째 대박 경기는 바로 {m1['home']} 대 {m1['away']}입니다. {m1['reason']} AI 환산 승률 무려 {m1['win_prob']}%로 홈팀이 엄청나게 유리한 구도입니다."
        m1_cap = f"{h1}\nvs\n{a1}\n\n[AI 추천] 승률 {m1['win_prob']}%\n배당 홈 {m1.get('home_odds', '?')}x"

        m2_tts = f"그리고 두 번째로 예측되는 대박 매치인 {m2['home']} 대 {m2['away']} 경기와, 세 번째 매치인 {m3['home']} 대 {m3['away']}의 실시간 승리 예측 정보는요."
        m2_cap = f"2순위: {h2} vs {a2}\n3순위: {h3} vs {a3}\n\n과연 AI의 최종 선택은?"

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
            {"tts": m3_tts, "caption": m3_cap, "scene": "match"},
            {"tts": ctas[cta_idx], "caption": cta_captions[cta_idx], "scene": "cta"},
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


async def _tts_async(text, path):
    import edge_tts
    # 텐션있는 여성 음성(SunHi)에 속도와 피치를 조절하여 AI 느낌 감소
    voice = "ko-KR-SunHiNeural"
    # 속도를 +15%로 조금 빠르게, 피치를 +5Hz 올려 아나운서보다 유튜버 느낌으로 세팅
    communicate = edge_tts.Communicate(text, voice, rate="+15%", pitch="+5Hz")
    await communicate.save(path)


def generate_tts(text, path):
    """ElevenLabs (최고 품질) → Edge TTS (무료 폴백) → gTTS (최종 폴백)"""
    # 1차: ElevenLabs (API 키 있으면)
    if is_elevenlabs_available():
        if elevenlabs_tts(text, path):
            return
        print("    [>] ElevenLabs failed, trying Edge TTS...")

    # 2차: Edge TTS
    try:
        asyncio.run(_tts_async(text, path))
        return
    except Exception as e:
        print(f"    [!] Edge TTS failed ({e}), falling back to gTTS")

    # 3차: gTTS
    from gtts import gTTS
    gTTS(text=text, lang="ko").save(path)


# ─── 자막 이미지 렌더링 ─────────────────────────────────
def render_caption(text, scene="match"):
    """장면 유형별 디자인이 다른 자막 카드 생성 (자동 줄바꿈 + 폰트 자동 축소)"""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 폰트 로드 함수
    def load_font(size, bold=False):
        try:
            name = "malgunbd.ttf" if bold else "malgun.ttf"
            return ImageFont.truetype(name, size)
        except Exception:
            return ImageFont.load_default()

    # 안전 영역: 화면 너비의 85%
    safe_w = int(WIDTH * 0.85)

    # 장면별 기본 폰트 크기
    base_size = 68 if scene == "intro" else 54

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

    # 장면별 컬러 스킴 (프리미엄 네온 테마)
    if scene == "intro":
        box_color = (10, 10, 30, 230)
        accent = (255, 215, 0, 255)
        border = (255, 215, 0, 180)
    elif scene == "cta":
        box_color = (30, 10, 15, 230)
        accent = (255, 80, 80, 255)
        border = (255, 80, 80, 180)
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

        highlight_keys = ["승률", "승리", "유리", "TOP", "확인", "배당", "격차", "%", "vs", "DATA", "LIVE", "ODDS", "AI", "HOME", ">>", "리포트"]
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
def generate_video(bg_video_path, output_path, auto_upload=False, use_avatar=False, mode="membership"):
    matches = fetch_top_matches()
    script = build_script(matches, mode=mode)

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

    # 1) 배경 준비
    ai_bg = os.path.join(os.path.dirname(__file__), "premium_bg.png") # 프리미엄 배경 적용
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
        print("  [*] AI background image loaded")
    else:
        base_bg = ColorClip(size=(WIDTH, HEIGHT), color=(12, 12, 25)).set_duration(120)
        bg_is_video = False

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
        generate_tts(seg["tts"], audio_path)
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
            # 기존 방식: 정적 배경 + Ken Burns
            if bg_is_video:
                t0 = (sum(c.duration for c in clips)) % base_bg.duration
                t1 = min(t0 + dur, base_bg.duration)
                bg_seg = base_bg.subclip(t0, t1)
                if bg_seg.duration < dur:
                    bg_seg = bg_seg.set_duration(dur)
            else:
                zoom_start = 1.0 + i * 0.02
                zoom_end = zoom_start + 0.06
                bg_seg = ken_burns(base_bg, dur, zoom_start, zoom_end)

        bg_seg = bg_seg.set_audio(audio)

        # 자막 카드 (아바타 모드일 때는 하단에 배치, Slide-up 애니메이션 적용)
        cap_arr = render_caption(seg["caption"], seg["scene"])
        
        # 슬라이드 인 애니메이션 함수 (0.5초 동안 아래에서 위로 올라옴)
        def slide_up(t):
            # t가 0에서 0.5로 갈 때, offset이 100에서 0으로 줄어듦
            progress = min(1.0, t * 2) 
            # Ease-out 수식
            ease = 1 - (1 - progress) * (1 - progress)
            offset = 150 * (1 - ease)
            return ("center", offset)
            
        if used_avatar:
            # 아바타 영상 위에는 자막을 하단 고정 (위치 고정)
            cap_clip = (ImageClip(cap_arr)
                        .set_duration(dur)
                        .set_position(("center", HEIGHT - 500))
                        .crossfadein(0.3)
                        .crossfadeout(0.2))
        else:
            cap_clip = (ImageClip(cap_arr)
                        .set_duration(dur)
                        .set_position(slide_up)
                        .crossfadein(0.3)
                        .crossfadeout(0.2))

        layers = [bg_seg]
        if not used_avatar:
            layers.append(hl_clip.set_duration(dur))
        layers.append(cap_clip)

        comp = CompositeVideoClip(layers)
        clips.append(comp)

    # 4) 연결
    print("\n  [CUT] Stitching scenes...")
    final = concatenate_videoclips(clips, method="compose")

    # 5) BGM 믹싱
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
        bgm = bgm.fx(volumex, 0.08)  # 목소리보다 훨씬 작게

        final = final.set_audio(
            CompositeAudioClip([final.audio, bgm])
        )

    # 6) 렌더링 (고품질)
    print("  [REC] Encoding final video (high quality)...")
    final.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        bitrate="8000k",   # 고화질 비트레이트
        threads=4,
        preset="medium",   # ultrafast → medium 으로 품질 대폭 향상
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
            f"[#] {now.strftime('%Y년 %m월 %d일 %H시')} 기준 AI 데이터 분석\n\n"
            "스코어닉스 AI가 실시간 배당 데이터를 분석하여\n"
            "통계적으로 유리한 경기를 선별한 리포트입니다.\n\n"
            "[!] 본 영상은 데이터 분석 결과이며 투자 권유가 아닙니다.\n\n"
            "[>] 전체 분석 리포트: https://scorenix.com\n\n"
            "#스포츠분석 #AI분석 #배당분석 #데이터분석 #shorts"
        )
        tags = ["스포츠분석", "AI분석", "배당분석", "데이터분석",
                "토토분석", "프로토", "shorts", "스코어닉스"]

        vid = upload_to_youtube(video_path, random.choice(titles), desc, tags)
        if vid:
            print(f"  [OK] YouTube upload success! https://youtu.be/{vid}")
            return True
        else:
            print("  [X] Upload failed")
            return False
    except Exception as e:
        print(f"  [X] YouTube error: {e}")
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
                
                # 멤버십 정밀분석용 & 마케팅 유입용 영상 두 가지를 항상 분리해서 생성!
                out_membership = os.path.join(output_dir, f"scorenix_membership_{ts}.mp4")
                out_marketing = os.path.join(output_dir, f"scorenix_marketing_{ts}.mp4")

                print(f"\n[+] Generating MEMBERSHIP (Subscriber) Video: {out_membership}")
                generate_video("background.mp4", out_membership,
                               auto_upload=False, use_avatar=args.avatar, mode="membership")

                print(f"\n[+] Generating MARKETING (Funnel) Video: {out_marketing}")
                generate_video("background.mp4", out_marketing,
                               auto_upload=False, use_avatar=args.avatar, mode="marketing")

                # 마케팅 영상을 유튜브 업로드 (멤버십 영상은 전용 혜택이므로 로컬에 그대로 유지)
                # 유튜브 API를 통해 업로드하더라도, 데스크톱에 보존해야 다른 SNS 계정에도 수동/자동으로 업로드 가능!
                # 따라서 os.remove(out) 코드는 완벽히 제거/주석처리하여 삭제하지 않고 보존합니다.
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
        # 수동 모드
        ts = datetime.datetime.now().strftime("%m%d_%H%M")
        
        # 멤버십 정밀분석용 & 마케팅 유입용 영상 두 가지를 항상 분리해서 생성!
        out_membership = os.path.join(output_dir, f"scorenix_membership_{ts}.mp4")
        out_marketing = os.path.join(output_dir, f"scorenix_marketing_{ts}.mp4")

        print(f"\n[+] Generating MEMBERSHIP (Subscriber) Video: {out_membership}")
        generate_video("background.mp4", out_membership,
                       auto_upload=False, use_avatar=args.avatar, mode="membership")

        print(f"\n[+] Generating MARKETING (Funnel) Video: {out_marketing}")
        generate_video("background.mp4", out_marketing,
                       auto_upload=False, use_avatar=args.avatar, mode="marketing")

        print(f"  [SAVE] Both videos successfully saved on Desktop at: {output_dir}")

        choice = input("\n[>>] Upload MARKETING video to YouTube? (y/n): ")
        if choice.strip().lower() == "y":
            _upload(out_marketing)

        os.startfile(output_dir)

