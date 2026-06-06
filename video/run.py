"""
Scorenix Video CLI Runner
커맨드라인에서 영상 유형을 선택하여 자동 제작합니다.

사용법:
  python video/run.py --type accuracy_reveal
  python video/run.py --type odds_drop_alert --no-overlay
  python video/run.py --list
  python video/run.py --all

환경변수 (로그인 필요 시나리오):
  SCORENIX_TEST_EMAIL=test@example.com
  SCORENIX_TEST_PASSWORD=yourpassword
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import argparse
import asyncio
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from video.scenarios import SCENARIO_MAP
from video.producer import produce
from video.overlay import apply_overlay
from video.concat import concatenate_videos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


async def make_video(
    scenario_name: str,
    apply_subtitles: bool = True,
    headless: bool = True,
) -> str:
    """
    지정한 유형의 영상을 제작합니다.

    Returns:
        최종 출력 파일 경로 (str)
    """
    if scenario_name not in SCENARIO_MAP:
        raise ValueError(f"알 수 없는 시나리오: {scenario_name}. 가능한 값: {list(SCENARIO_MAP.keys())}")

    ScenarioClass = SCENARIO_MAP[scenario_name]
    scenario = ScenarioClass()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1단계: Playwright로 webm 녹화
    raw_webm = str(OUTPUT_DIR / f"{scenario_name}_{timestamp}_raw.webm")
    ok = await produce(scenario, raw_webm, headless=headless)

    if not ok:
        raise RuntimeError(f"영상 녹화 실패: {scenario_name}")

    # 2단계: ffmpeg 자막 합성
    if apply_subtitles and scenario.overlay_texts:
        final_mp4 = str(OUTPUT_DIR / f"{scenario_name}_{timestamp}.mp4")
        ok2 = apply_overlay(
            input_path=raw_webm,
            output_path=final_mp4,
            overlay_texts=scenario.overlay_texts,
            video_width=scenario.viewport_width,
            video_height=scenario.viewport_height,
        )
        # raw webm 정리
        if ok2:
            os.remove(raw_webm)
            return final_mp4
        else:
            logger.warning("자막 합성 실패 — 원본 webm을 반환합니다.")
            return raw_webm
    else:
        # 자막 없이 webm 그대로 반환
        return raw_webm


def main():
    parser = argparse.ArgumentParser(
        description="Scorenix 자동 영상 제작 및 병합 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
영상 유형:
  accuracy_reveal   — AI 적중률 공개 (35초)
  odds_drop_alert   — 배당 급락 경보 (45초)
  ai_analysis       — AI 분석 시연 (60초) [로그인 필요]
  vip_showcase      — VIP 기능 공개 (45초) [로그인 필요]
  tax_calculator    — 세금 계산기 (35초)

사용법 예시:
  # 단일 영상 제작
  python video/run.py --type accuracy_reveal
  
  # 여러 시나리오 영상을 차례대로 자동 연결하여 하나의 영상으로 병합
  python video/run.py --concat accuracy_reveal,odds_drop_alert --output-name combined_report.mp4
  
  # 병합 시 트랜지션 및 BGM 추가
  python video/run.py --concat accuracy_reveal,tax_calculator --transition 0.5 --bgm backend/bgm.mp3
        """
    )
    parser.add_argument("--type", "-t", help="단일 영상 유형 선택")
    parser.add_argument("--all", "-a", action="store_true", help="모든 유형 개별 제작")
    parser.add_argument("--list", "-l", action="store_true", help="사용 가능한 유형 목록")
    parser.add_argument("--no-overlay", action="store_true", help="자막 합성 건너뜀")
    parser.add_argument("--headed", action="store_true", help="브라우저 화면 표시 (디버그용)")
    
    # Concatenation 관련 옵션
    parser.add_argument("--concat", help="병합할 영상 유형 목록 (쉼표로 구분)")
    parser.add_argument("--output-name", help="병합 완료된 비디오 파일명 (기본값: combined_[시간].mp4)")
    parser.add_argument("--bgm", help="병합 시 믹싱할 BGM 파일 경로")
    parser.add_argument("--bgm-vol", type=float, default=0.08, help="BGM 볼륨 (기본값: 0.08)")
    parser.add_argument("--transition", type=float, default=0.0, help="교차 페이드 트랜지션 지속 시간(초)")
    parser.add_argument("--quality", choices=["high", "standard"], default="high", help="병합 비디오 화질 (기본값: high)")

    args = parser.parse_args()

    if args.list:
        print("\n[사용 가능한 영상 유형]\n")
        for name, cls in SCENARIO_MAP.items():
            s = cls()
            print(f"  {name:<25} {s.description}")
            print(f"  {'':25} 길이: {s.duration}초  로그인: {'필요' if s.requires_login else '불필요'}\n")
        return

    apply_subtitles = not args.no_overlay
    headless = not args.headed

    if args.all:
        types_to_make = list(SCENARIO_MAP.keys())
    elif args.type:
        types_to_make = [args.type]
    elif args.concat:
        types_to_make = [t.strip() for t in args.concat.split(",") if t.strip()]
    else:
        parser.print_help()
        return

    generated_files = []
    for t in types_to_make:
        print(f"\n{'='*50}")
        print(f"[제작 중]: {t}")
        print(f"{'='*50}")
        try:
            output = asyncio.run(make_video(t, apply_subtitles, headless))
            print(f"완료: {output}\n")
            generated_files.append(output)
        except Exception as e:
            print(f"실패: {e}\n")
            logger.exception(e)

    # 지정한 시나리오들의 제작이 모두 성공적으로 완료되었을 때 병합 수행
    if args.concat and len(generated_files) > 1:
        print(f"\n{'='*50}")
        print(f"[자동 비디오 병합 작업 시작]")
        print(f"{'='*50}")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_name = args.output_name or f"combined_{timestamp}.mp4"
        if not out_name.endswith(".mp4"):
            out_name += ".mp4"
        
        combined_output = str(OUTPUT_DIR / out_name)
        
        success = concatenate_videos(
            video_paths=generated_files,
            output_path=combined_output,
            bgm_path=args.bgm,
            bgm_volume=args.bgm_vol,
            transition_duration=args.transition,
            quality=args.quality
        )
        
        if success:
            print(f"\n🎉 병합 완료! 최종 비디오 경로: {combined_output}\n")
        else:
            print("\n❌ 일부 비디오의 병합 처리에 실패하였습니다.\n")
    elif args.concat:
        print("\n⚠️ 병합할 영상 개수가 부족합니다. (최소 2개 이상의 유효한 시나리오가 필요합니다.)\n")


if __name__ == "__main__":
    main()
