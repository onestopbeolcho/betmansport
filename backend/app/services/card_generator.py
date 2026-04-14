"""
Match Analysis Card Generator — SNS 마케팅 이미지 생성
- PIL/Pillow 기반 서버 사이드 이미지 생성
- 경기 분석 결과를 시각적 카드로 변환
- Firebase Storage 업로드 → 공개 URL 반환
"""
import io
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def _create_match_card(match_data: Dict, width: int = 1080, height: int = 1080) -> bytes:
    """
    PIL을 사용하여 경기 분석 카드 이미지 생성 (Instagram 정사각형).
    Returns: PNG bytes
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        logger.error("Pillow not installed. Run: pip install Pillow")
        return b""

    # ── 데이터 추출 ──
    home = match_data.get("team_home_ko", match_data.get("team_home", "홈팀"))
    away = match_data.get("team_away_ko", match_data.get("team_away", "원정팀"))
    league = match_data.get("league", "리그")
    confidence = match_data.get("confidence", 0)
    recommendation = match_data.get("recommendation", "")
    home_prob = match_data.get("home_win_prob", 0)
    draw_prob = match_data.get("draw_prob", 0)
    away_prob = match_data.get("away_win_prob", 0)
    factors = match_data.get("factors", [])[:4]

    rec_text = "홈 승" if recommendation == "HOME" else "원정 승" if recommendation == "AWAY" else "무승부"

    # ── 이미지 생성 ──
    img = Image.new("RGB", (width, height), color=(15, 15, 25))
    draw = ImageDraw.Draw(img)

    # 폰트 설정 (시스템 기본 사용 또는 동적 다운로드)
    font_path_regular = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
    font_path_bold = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

    if not os.path.exists(font_path_regular):
        import urllib.request
        logger.info("Downloading NanumGothic font dynamically...")
        tmp_font = "/tmp/NanumGothic.ttf"
        if not os.path.exists(tmp_font):
            try:
                url = "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Bold.ttf"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response, open(tmp_font, 'wb') as out_file:
                    out_file.write(response.read())
            except Exception as e:
                logger.error(f"Failed to download font: {e}")
        font_path_regular = tmp_font
        font_path_bold = tmp_font
    
    try:
        font_lg = ImageFont.truetype(font_path_bold, 48)
        font_md = ImageFont.truetype(font_path_regular, 36)
        font_sm = ImageFont.truetype(font_path_regular, 28)
        font_xs = ImageFont.truetype(font_path_regular, 22)
    except (OSError, IOError):
        font_lg = ImageFont.load_default()
        font_md = font_lg
        font_sm = font_lg
        font_xs = font_lg

    # ── 배경 그라데이션 효과 ──
    for y in range(height):
        r = int(15 + (25 - 15) * y / height)
        g = int(15 + (20 - 15) * y / height)
        b = int(25 + (45 - 25) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # ── 상단 로고/브랜드 영역 ──
    # 핑크-퍼플 그라데이션 헤더 바
    for y in range(0, 80):
        ratio = y / 80
        r = int(147 + (99 - 147) * ratio)
        g = int(51 + (102 - 51) * ratio)
        b = int(234 + (241 - 234) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    draw.text((40, 20), "SCORENIX", fill=(255, 255, 255), font=font_lg)
    draw.text((380, 30), "AI MATCH ANALYSIS", fill=(220, 220, 255), font=font_sm)

    # ── 리그 표시 ──
    draw.text((40, 110), f"📍 {league}", fill=(180, 180, 220), font=font_md)

    # ── VS 카드 영역 ──
    # 홈팀 영역
    draw.rounded_rectangle([(40, 180), (520, 360)], radius=16, fill=(30, 30, 50))
    draw.text((60, 200), "HOME", fill=(130, 130, 180), font=font_xs)
    draw.text((60, 240), home, fill=(255, 255, 255), font=font_md)
    draw.text((60, 300), f"{home_prob:.1f}%", fill=(100, 220, 160), font=font_lg)

    # VS
    draw.text((525, 240), "VS", fill=(147, 51, 234), font=font_lg)

    # 원정팀 영역
    draw.rounded_rectangle([(600, 180), (1040, 360)], radius=16, fill=(30, 30, 50))
    draw.text((620, 200), "AWAY", fill=(130, 130, 180), font=font_xs)
    draw.text((620, 240), away, fill=(255, 255, 255), font=font_md)
    draw.text((620, 300), f"{away_prob:.1f}%", fill=(234, 100, 100), font=font_lg)

    # 무승부 확률
    draw.rounded_rectangle([(350, 370), (730, 430)], radius=12, fill=(40, 40, 60))
    draw.text((380, 380), f"DRAW  {draw_prob:.1f}%", fill=(200, 200, 230), font=font_sm)

    # ── AI 추천 영역 ──
    # 신뢰도 색상
    if confidence >= 70:
        conf_color = (0, 230, 118)  # 초록
    elif confidence >= 55:
        conf_color = (255, 193, 7)  # 노랑
    else:
        conf_color = (234, 100, 100)  # 빨강

    draw.rounded_rectangle([(40, 470), (1040, 620)], radius=16, fill=(25, 25, 45))
    # 상단 라벨
    draw.text((60, 490), "🧠 AI RECOMMENDATION", fill=(147, 51, 234), font=font_sm)
    # 추천 텍스트
    draw.text((60, 540), rec_text, fill=conf_color, font=font_lg)
    # 신뢰도 바
    bar_w = int(500 * confidence / 100)
    draw.rounded_rectangle([(500, 545), (1020, 585)], radius=10, fill=(50, 50, 70))
    if bar_w > 0:
        draw.rounded_rectangle([(500, 545), (500 + bar_w, 585)], radius=10, fill=conf_color)
    draw.text((500 + bar_w + 10, 548), f"{confidence:.0f}%", fill=conf_color, font=font_sm)

    # ── 핵심 팩터 영역 ──
    draw.text((40, 660), "📊 KEY FACTORS", fill=(147, 51, 234), font=font_sm)

    factor_y = 710
    factor_colors = [
        (100, 220, 160),
        (100, 180, 255),
        (255, 193, 7),
        (234, 130, 130),
    ]
    for i, factor in enumerate(factors):
        name = factor.get("name", f"Factor {i+1}")
        score = factor.get("score", 0)
        color = factor_colors[i % len(factor_colors)]

        draw.rounded_rectangle([(40, factor_y), (1040, factor_y + 60)], radius=10, fill=(30, 30, 50))
        draw.text((60, factor_y + 12), name, fill=(200, 200, 230), font=font_sm)
        # 스코어 바
        bar_x = 550
        bar_len = int(430 * abs(score) / 100) if score != 0 else 0
        draw.rounded_rectangle([(bar_x, factor_y + 15), (bar_x + 430, factor_y + 45)], radius=8, fill=(50, 50, 70))
        if bar_len > 0:
            draw.rounded_rectangle([(bar_x, factor_y + 15), (bar_x + bar_len, factor_y + 45)], radius=8, fill=color)
        draw.text((bar_x + bar_len + 8, factor_y + 15), f"{score:.0f}", fill=color, font=font_xs)
        factor_y += 75

    # ── 하단 워터마크 ──
    draw.rounded_rectangle([(0, height - 70), (width, height)], radius=0, fill=(20, 20, 35))
    draw.text((40, height - 55), "scorenix.com", fill=(147, 51, 234), font=font_sm)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    draw.text((700, height - 50), now_str, fill=(120, 120, 160), font=font_xs)

    # ── PNG 변환 ──
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_card_and_upload(match_data: Dict) -> Optional[str]:
    """
    경기 분석 카드 이미지를 생성하고 Firebase Storage에 업로드.
    Returns: 공개 URL or None
    """
    try:
        # 1. 이미지 생성
        png_bytes = _create_match_card(match_data)
        if not png_bytes:
            return None

        # 2. Firebase Storage에 업로드
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
    for pred in predictions[:3]:  # 최대 3장
        url = await generate_card_and_upload(pred)
        results.append({
            "match_id": pred.get("match_id", ""),
            "image_url": url,
        })
    return results
