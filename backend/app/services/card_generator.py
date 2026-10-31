"""
Match Analysis Card Generator — 베트맨 공식 게임 SNS 마케팅 이미지 생성
- PIL/Pillow 기반 서버 사이드 이미지 생성
- 베트맨 공식 회차명/경기번호(축구토토 승무패 14경기, 프로토 승부식, 승5패, 스페셜N) 및 구간 분류(단독 우위 1순위 / 경합 주의) 표시
- Firebase Storage 업로드 → 공개 URL 반환
"""
import io
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def _get_fonts():
    """한글/영문 폰트를 안전하게 로드 (Windows 로컬 및 Linux Cloud Run 모두 지원)"""
    from PIL import ImageFont
    import tempfile

    candidates_bold = [
        "C:/Windows/Fonts/malgunbd.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        os.path.join(tempfile.gettempdir(), "NanumGothicBold.ttf"),
    ]
    candidates_reg = [
        "C:/Windows/Fonts/malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        os.path.join(tempfile.gettempdir(), "NanumGothicBold.ttf"),
    ]

    font_path_bold = next((p for p in candidates_bold if os.path.exists(p)), None)
    font_path_reg = next((p for p in candidates_reg if os.path.exists(p)), None)

    if not font_path_bold:
        import urllib.request
        tmp_font = os.path.join(tempfile.gettempdir(), "NanumGothicBold.ttf")
        if not os.path.exists(tmp_font):
            try:
                url = "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Bold.ttf"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as response, open(tmp_font, "wb") as out_file:
                    out_file.write(response.read())
            except Exception as e:
                logger.error(f"Failed to download font: {e}")
        font_path_bold = tmp_font
        font_path_reg = tmp_font

    try:
        return {
            "xxl": ImageFont.truetype(font_path_bold, 58),
            "xl": ImageFont.truetype(font_path_bold, 44),
            "lg": ImageFont.truetype(font_path_bold, 36),
            "md": ImageFont.truetype(font_path_bold, 28),
            "sm": ImageFont.truetype(font_path_reg or font_path_bold, 23),
            "xs": ImageFont.truetype(font_path_reg or font_path_bold, 19),
        }
    except Exception:
        default_f = ImageFont.load_default()
        return {k: default_f for k in ("xxl", "xl", "lg", "md", "sm", "xs")}


def _strip_emojis(text: str) -> str:
    """NanumGothic 등 일반 한글 폰트에서 깨지는(☒ 두부 박스) 이모지 제거"""
    import re
    if not text:
        return ""
    return re.sub(r"[\U00010000-\U0010ffff\u2600-\u27BF\uFE0F]", "", str(text)).strip()


def _fit_text(draw, text: str, font_primary, font_fallback, max_width: int):
    """텍스트가 박스 너비를 넘어가면 작은 폰트로 자동 전환 및 말줄임"""
    clean = _strip_emojis(text)
    try:
        bbox = draw.textbbox((0, 0), clean, font=font_primary)
        if (bbox[2] - bbox[0]) <= max_width:
            return clean, font_primary
        bbox2 = draw.textbbox((0, 0), clean, font=font_fallback)
        if (bbox2[2] - bbox2[0]) <= max_width:
            return clean, font_fallback
        while len(clean) > 4:
            clean = clean[:-1]
            b = draw.textbbox((0, 0), clean + "…", font=font_fallback)
            if (b[2] - b[0]) <= max_width:
                return clean + "…", font_fallback
    except Exception:
        pass
    return clean, font_fallback


def _create_match_card(match_data: Dict, width: int = 1080, height: int = 1080) -> bytes:
    """
    PIL을 사용하여 베트맨 공식 게임 방송 그래픽 수준의 경기 분석 카드 이미지 생성 (Instagram 1080x1080 정사각형).
    이모지 깨짐(☒) 원천 방지 + 베트맨 공식 회차명/경기번호 + 구간 분류(단독 우위 1순위 / 경합 주의) 표시.
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        logger.error("Pillow not installed. Run: pip install Pillow")
        return b""

    fonts = _get_fonts()

    # ── 데이터 추출 ──
    home = _strip_emojis(match_data.get("team_home_ko") or match_data.get("team_home", "홈팀"))
    away = _strip_emojis(match_data.get("team_away_ko") or match_data.get("team_away", "원정팀"))
    betman_home = _strip_emojis(match_data.get("betman_home") or home)
    betman_away = _strip_emojis(match_data.get("betman_away") or away)
    round_title = _strip_emojis(match_data.get("round_title") or "축구토토 승무패 · 프로토 승부식")
    game_no_label = _strip_emojis(match_data.get("game_no_label") or "핵심매치")
    role_badge = _strip_emojis(match_data.get("role_badge") or "단독 우위 (1순위 주력)")
    league = _strip_emojis(match_data.get("league", "프리미어리그"))
    confidence = float(match_data.get("confidence", 65) or 65)
    recommendation = match_data.get("recommendation", "HOME")
    home_prob = float(match_data.get("home_win_prob", 50) or 50)
    draw_prob = float(match_data.get("draw_prob", 0) or 0)
    away_prob = float(match_data.get("away_win_prob", 50) or 50)
    factors = match_data.get("factors", [])[:4]

    match_time_raw = str(match_data.get("match_time") or "")
    date_str = match_time_raw.split("T")[0].split(" ")[0] if match_time_raw else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    is_two_way = draw_prob <= 0.5 or any(sp in league.upper() for sp in ["MLB", "NBA", "NHL", "야구", "하키"])
    rec_team = f"1순위: {home} 우세" if recommendation == "HOME" else (f"1순위: {away} 우세" if recommendation == "AWAY" else "1순위: 무승부(접전) 경합")

    # ── 딥 네이비 퀀트 배경 그라데이션 ──
    img = Image.new("RGB", (width, height), color=(10, 14, 26))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        r = int(9 + (16 - 9) * y / height)
        g = int(13 + (23 - 13) * y / height)
        b = int(26 + (42 - 26) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # ── 상단 브랜드 헤더 바 (사이버 시안-인디고) ──
    for y in range(0, 88):
        ratio = y / 88
        r = int(12 + (20 - 12) * ratio)
        g = int(24 + (38 - 24) * ratio)
        b = int(52 + (78 - 52) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    draw.line([(0, 88), (width, 88)], fill=(0, 212, 255), width=3)

    # SCORENIX 로고 + 베트맨 공식 대상경기 뱃지
    draw.text((44, 22), "SCORENIX", fill=(0, 212, 255), font=fonts["xl"])
    draw.rounded_rectangle([(290, 27), (685, 65)], radius=8, fill=(18, 42, 78), outline=(0, 212, 255), width=2)
    draw.text((308, 33), "베트맨 공식 대상경기 AI 리포트", fill=(230, 248, 255), font=fonts["sm"])
    draw.text((820, 33), f"DATE | {date_str}", fill=(160, 185, 220), font=fonts["sm"])

    # ── 베트맨 회차 & 경기번호 + 구간 분류 바 ──
    draw.rounded_rectangle([(44, 112), (1036, 168)], radius=12, fill=(18, 28, 48), outline=(40, 60, 95), width=1)
    draw.rounded_rectangle([(58, 124), (170, 156)], radius=6, fill=(0, 212, 255))
    draw.text((70, 128), game_no_label, fill=(10, 14, 26), font=fonts["xs"])
    round_header = f"{round_title}  |  {league}"
    rh_txt, _ = _fit_text(draw, round_header, fonts["md"], fonts["sm"], 540)
    draw.text((185, 124), rh_txt, fill=(255, 255, 255), font=fonts["sm"])

    role_bg = (16, 185, 129) if "단독" in role_badge else (245, 158, 11)
    draw.rounded_rectangle([(725, 122), (1020, 158)], radius=8, fill=role_bg)
    rb_txt, _ = _fit_text(draw, role_badge, fonts["xs"], fonts["xs"], 275)
    draw.text((740, 128), rb_txt, fill=(10, 20, 15), font=fonts["xs"])

    # ── 메인 매치업 & 시뮬레이션 확률 카드 ──
    home_highlight = recommendation == "HOME"
    draw.rounded_rectangle(
        [(44, 188), (496, 405)],
        radius=18,
        fill=(22, 36, 60) if home_highlight else (18, 26, 44),
        outline=(0, 230, 160) if home_highlight else (45, 60, 90),
        width=3 if home_highlight else 1,
    )
    draw.text((70, 206), f"HOME  |  베트맨: {betman_home}", fill=(0, 212, 255), font=fonts["xs"])
    h_txt, h_font = _fit_text(draw, home, fonts["lg"], fonts["md"], 400)
    draw.text((70, 242), h_txt, fill=(255, 255, 255), font=h_font)
    draw.text((70, 312), f"{home_prob:.1f}%", fill=(16, 235, 160), font=fonts["xxl"])
    draw.text((285, 340), "AI 시뮬레이션 승률", fill=(150, 175, 210), font=fonts["xs"])

    # 중앙 VS 원형 배지
    draw.ellipse([(504, 260), (576, 332)], fill=(30, 45, 78), outline=(0, 212, 255), width=2)
    draw.text((519, 278), "VS", fill=(0, 212, 255), font=fonts["md"])

    # 원정팀 카드
    away_highlight = recommendation == "AWAY"
    draw.rounded_rectangle(
        [(584, 188), (1036, 405)],
        radius=18,
        fill=(22, 36, 60) if away_highlight else (18, 26, 44),
        outline=(0, 230, 160) if away_highlight else (45, 60, 90),
        width=3 if away_highlight else 1,
    )
    draw.text((610, 206), f"AWAY  |  베트맨: {betman_away}", fill=(245, 158, 11), font=fonts["xs"])
    a_txt, a_font = _fit_text(draw, away, fonts["lg"], fonts["md"], 400)
    draw.text((610, 242), a_txt, fill=(255, 255, 255), font=a_font)
    draw.text((610, 312), f"{away_prob:.1f}%", fill=(251, 191, 36), font=fonts["xxl"])
    draw.text((825, 340), "AI 시뮬레이션 승률", fill=(150, 175, 210), font=fonts["xs"])

    # 하단 확률 비교 게이지 바
    bar_y = 422
    bar_h = 26
    total_w = 992
    draw.rounded_rectangle([(44, bar_y), (1036, bar_y + bar_h)], radius=12, fill=(30, 40, 65))
    hw = max(40, int(total_w * (home_prob / 100.0)))
    draw.rounded_rectangle([(44, bar_y), (44 + hw, bar_y + bar_h)], radius=12, fill=(16, 185, 129))
    if not is_two_way and draw_prob > 0:
        dw = max(30, int(total_w * (draw_prob / 100.0)))
        draw.rectangle([(44 + hw, bar_y), (min(1036, 44 + hw + dw), bar_y + bar_h)], fill=(100, 116, 139))
        draw.text((420, bar_y + 32), f"무승부(5점차 접전) 확률 {draw_prob:.1f}%", fill=(170, 185, 210), font=fonts["xs"])
    else:
        draw.text((380, bar_y + 32), "2-Way 승패 시뮬레이션 (무승부 없음)", fill=(150, 175, 210), font=fonts["xs"])

    # ── AI 시뮬레이션 결론 박스 ──
    conf_color = (16, 235, 160) if confidence >= 65 else (251, 191, 36)
    draw.rounded_rectangle([(44, 490), (1036, 622)], radius=16, fill=(18, 30, 52), outline=(0, 212, 255), width=2)
    draw.rounded_rectangle([(68, 508), (370, 540)], radius=6, fill=(0, 212, 255))
    draw.text((82, 513), "BETMAN AI BALANCE SIGNAL", fill=(10, 14, 26), font=fonts["xs"])

    rec_fit, rec_font = _fit_text(draw, rec_team, fonts["xl"], fonts["lg"], 470)
    draw.text((68, 552), rec_fit, fill=conf_color, font=rec_font)

    # 우측 신뢰도 게이지
    draw.text((580, 510), f"머신러닝 신뢰도 지수: {confidence:.0f}%", fill=(220, 235, 255), font=fonts["sm"])
    gauge_w = int(420 * min(100.0, max(10.0, confidence)) / 100.0)
    draw.rounded_rectangle([(580, 552), (1000, 590)], radius=10, fill=(35, 48, 75))
    draw.rounded_rectangle([(580, 552), (580 + gauge_w, 590)], radius=10, fill=conf_color)

    # ── 3-Pillar 핵심 팩터 스코어보드 ──
    draw.text((44, 644), "3-PILLAR QUANT FACTORS  |  베트맨 배당·투표율 & 전력 교차 검증", fill=(0, 212, 255), font=fonts["sm"])

    factor_y = 684
    factor_colors = [
        (16, 235, 160),
        (56, 189, 248),
        (251, 191, 36),
        (167, 139, 250),
    ]
    for i, factor in enumerate(factors):
        name = _strip_emojis(factor.get("name", f"핵심 팩터 {i+1}"))
        score = float(factor.get("score", 60) or 60)
        detail = _strip_emojis(factor.get("detail", ""))
        color = factor_colors[i % len(factor_colors)]

        draw.rounded_rectangle([(44, factor_y), (1036, factor_y + 64)], radius=12, fill=(18, 26, 44), outline=(38, 52, 82), width=1)
        draw.text((68, factor_y + 10), name, fill=(240, 245, 255), font=fonts["sm"])
        if detail:
            det_txt, _ = _fit_text(draw, detail, fonts["xs"], fonts["xs"], 460)
            draw.text((68, factor_y + 37), det_txt, fill=(145, 165, 200), font=fonts["xs"])

        bar_x = 560
        bar_len = int(380 * min(100.0, max(5.0, abs(score))) / 100.0)
        draw.rounded_rectangle([(bar_x, factor_y + 20), (bar_x + 380, factor_y + 44)], radius=8, fill=(35, 48, 75))
        draw.rounded_rectangle([(bar_x, factor_y + 20), (bar_x + bar_len, factor_y + 44)], radius=8, fill=color)
        draw.text((bar_x + 392, factor_y + 18), f"{score:.0f}점", fill=color, font=fonts["sm"])
        factor_y += 74

    # ── 하단 O2O 판매점 & 커뮤니티 무료해금 안내 바 ──
    draw.rectangle([(0, height - 82), (width, height)], fill=(12, 20, 38))
    draw.line([(0, height - 82), (width, height - 82)], fill=(0, 212, 255), width=2)
    draw.text((44, height - 56), "scorenix.com  |  베트맨 14경기 통합 밸런스 표 · 판매점 & 커뮤니티 무료해금", fill=(0, 212, 255), font=fonts["sm"])
    draw.text((835, height - 52), "@scorenix_official", fill=(170, 190, 225), font=fonts["xs"])

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_card_and_upload(match_data: Dict) -> Optional[str]:
    """
    경기 분석 카드 이미지를 생성하고 Firebase Storage에 업로드.
    Returns: 공개 URL or None
    """
    try:
        png_bytes = _create_match_card(match_data)
        if not png_bytes:
            return None

        from google.cloud import storage as gcs
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "smart-proto-inv-2026-sns-assets")
        client = gcs.Client()
        bucket = client.bucket(bucket_name)

        match_id = match_data.get("match_id", "unknown")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        blob_path = f"marketing/cards/{timestamp}_{match_id}.png"

        blob = bucket.blob(blob_path)
        blob.upload_from_string(png_bytes, content_type="image/png")

        try:
            blob.make_public()
            public_url = blob.public_url
        except Exception as acl_e:
            logger.warning(f"Failed to make_public: {acl_e}. Using assumed URL...")
            public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"

        logger.info(f"✅ Card uploaded: {public_url}")
        return public_url

    except Exception as e:
        logger.error(f"Card generation/upload error: {e}")
        return None


async def generate_cards_for_predictions(predictions: list) -> list:
    """여러 경기에 대한 카드 이미지를 생성하고 URL 반환"""
    results = []
    for pred in predictions[:3]:
        url = await generate_card_and_upload(pred)
        results.append({
            "match_id": pred.get("match_id", ""),
            "image_url": url,
        })
    return results


def _create_winning_card(hit_data: Dict, width: int = 1080, height: int = 1080) -> bytes:
    """
    백테스트 검증 일치 카드 이미지 생성 (베트맨 공식 대상경기 방송 그래픽 스타일).
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        logger.error("Pillow not installed")
        return b""

    fonts = _get_fonts()
    home = _strip_emojis(hit_data.get("team_home_ko") or hit_data.get("team_home", "홈팀"))
    away = _strip_emojis(hit_data.get("team_away_ko") or hit_data.get("team_away", "원정팀"))
    league = _strip_emojis(hit_data.get("league", "베트맨 대상경기"))
    rec = hit_data.get("recommendation", "HOME")
    rec_text = f"{home} 우세" if rec == "HOME" else (f"{away} 우세" if rec == "AWAY" else "무승부")
    h_score = hit_data.get("home_score", 0)
    a_score = hit_data.get("away_score", 0)
    confidence = float(hit_data.get("confidence", 80) or 80)

    img = Image.new("RGB", (width, height), color=(10, 20, 18))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        r = int(10 + (15 - 10) * y / height)
        g = int(22 + (36 - 22) * y / height)
        b = int(18 + (28 - 18) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    draw.rectangle([(0, 0), (width, 88)], fill=(16, 185, 129))
    draw.text((44, 22), "SCORENIX", fill=(10, 20, 15), font=fonts["xl"])
    draw.text((310, 30), "BETMAN AI BACKTEST VERIFIED", fill=(10, 25, 18), font=fonts["md"])

    draw.text((44, 120), f"[{league}] 베트맨 대상경기 AI 시뮬레이션 검증 완료", fill=(160, 235, 195), font=fonts["lg"])

    draw.rounded_rectangle([(44, 190), (1036, 440)], radius=20, fill=(18, 35, 28), outline=(16, 185, 129), width=2)
    h_txt, h_f = _fit_text(draw, home, fonts["xl"], fonts["lg"], 400)
    a_txt, a_f = _fit_text(draw, away, fonts["xl"], fonts["lg"], 400)
    draw.text((80, 225), h_txt, fill=(255, 255, 255), font=h_f)
    draw.text((600, 225), a_txt, fill=(255, 255, 255), font=a_f)

    score_text = f"{h_score}   :   {a_score}"
    draw.text((390, 320), score_text, fill=(16, 235, 160), font=fonts["xxl"])

    draw.rounded_rectangle([(140, 485), (940, 610)], radius=20, fill=(16, 185, 129))
    draw.text((200, 520), "단독 우위 1순위 시뮬레이션 검증 일치", fill=(10, 20, 15), font=fonts["xl"])

    draw.rounded_rectangle([(44, 650), (1036, 840)], radius=16, fill=(20, 40, 32), outline=(45, 90, 70), width=1)
    draw.text((80, 685), f"시뮬레이션 1순위 지표: {rec_text}", fill=(220, 255, 235), font=fonts["lg"])
    draw.text((80, 755), f"당시 머신러닝 신뢰도: {confidence:.0f}%  |  베트맨 3-Pillar 검증 완료", fill=(160, 230, 190), font=fonts["md"])

    draw.rectangle([(0, height - 82), (width, height)], fill=(12, 26, 20))
    draw.text((44, height - 55), "scorenix.com  |  전국 6,500개 판매점 & 승부예측 커뮤니티 무료해금", fill=(16, 235, 160), font=fonts["sm"])

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_winning_card_and_upload(hit_data: Dict) -> Optional[str]:
    """
    적중 인증 카드를 생성하고 Firebase Storage에 업로드.
    Returns: 공개 URL 또는 None
    """
    try:
        png_bytes = _create_winning_card(hit_data)
        if not png_bytes:
            return None

        from google.cloud import storage as gcs
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "smart-proto-inv-2026-sns-assets")
        client = gcs.Client()
        bucket = client.bucket(bucket_name)

        match_id = hit_data.get("match_id", "hit")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        blob_path = f"marketing/winning_cards/{timestamp}_{match_id}.png"

        blob = bucket.blob(blob_path)
        blob.upload_from_string(png_bytes, content_type="image/png")

        try:
            blob.make_public()
            public_url = blob.public_url
        except Exception:
            public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"

        logger.info(f"✅ Winning Card uploaded: {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"Winning Card generation/upload error: {e}")
        return None
