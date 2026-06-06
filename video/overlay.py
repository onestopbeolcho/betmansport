"""
Overlay Module — ffmpeg를 사용하여 자막 텍스트를 영상에 합성합니다.
"""
import logging
import os
import shutil
import subprocess
import tempfile
from typing import List, Optional

from .scenarios.base import OverlayText

logger = logging.getLogger(__name__)

# ffmpeg 실행 파일 경로 탐색
def _find_ffmpeg() -> Optional[str]:
    """ffmpeg 실행 경로 반환"""
    # PATH에서 먼저 탐색
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg
    # 일반적인 Windows 설치 경로
    candidates = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\ffmpeg\ffmpeg.exe"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def _escape_text(text: str) -> str:
    """ffmpeg drawtext용 특수문자 이스케이핑"""
    # 콜론, 작은따옴표, 역슬래시 이스케이프
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "\\'")
    text = text.replace(":", "\\:")
    return text


def _build_vf_filter(overlay_texts: List[OverlayText], video_height: int = 960) -> str:
    """
    여러 OverlayText를 ffmpeg -vf drawtext 필터 문자열로 변환
    """
    if not overlay_texts:
        return "null"

    filters = []
    for ot in overlay_texts:
        text = _escape_text(ot.text)
        font_size = ot.font_size

        # 세로 위치 계산
        if ot.position == "top":
            y_expr = f"h*0.08"
        elif ot.position == "center":
            y_expr = f"(h-text_h)/2"
        else:  # bottom
            y_expr = f"h*0.82"

        # drawtext 필터
        dt = (
            f"drawtext="
            f"text='{text}':"
            f"fontsize={font_size}:"
            f"fontcolor={ot.color}:"
            f"font='Malgun Gothic':"
            f"box=1:"
            f"boxcolor={ot.box_color}:"
            f"boxborderw=12:"
            f"x=(w-text_w)/2:"
            f"y={y_expr}:"
            f"enable='between(t,{ot.start_sec},{ot.end_sec})'"
        )
        filters.append(dt)

    return ", ".join(filters)


def apply_overlay(
    input_path: str,
    output_path: str,
    overlay_texts: List[OverlayText],
    video_width: int = 540,
    video_height: int = 960,
) -> bool:
    """
    입력 영상에 자막을 합성하여 MP4로 저장합니다.

    Args:
        input_path: 원본 webm 파일 경로
        output_path: 자막 합성된 mp4 저장 경로
        overlay_texts: OverlayText 목록
        video_width: 영상 가로 크기
        video_height: 영상 세로 크기

    Returns:
        성공 여부 (bool)
    """
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        logger.error("❌ ffmpeg를 찾을 수 없습니다. PATH에 ffmpeg를 추가하거나 설치하세요.")
        return False

    vf_filter = _build_vf_filter(overlay_texts, video_height)

    # 출력 디렉토리 생성
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    cmd = [
        ffmpeg,
        "-y",                     # 덮어쓰기
        "-i", input_path,          # 입력
        "-vf", vf_filter,          # 자막 필터
        "-c:v", "libx264",         # MP4 인코딩
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "aac",
        "-movflags", "+faststart", # 웹 스트리밍 최적화
        output_path,
    ]

    logger.info(f"🔤 자막 합성 중: {os.path.basename(input_path)} → {os.path.basename(output_path)}")
    logger.debug(f"ffmpeg 명령: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,
        )

        if result.returncode == 0:
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            logger.info(f"✅ 자막 합성 완료: {output_path} ({size_mb:.1f} MB)")
            return True
        else:
            logger.error(f"❌ ffmpeg 오류:\n{result.stderr[-2000:]}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("❌ ffmpeg 타임아웃 (5분 초과)")
        return False
    except Exception as e:
        logger.error(f"❌ ffmpeg 실행 오류: {e}")
        return False
