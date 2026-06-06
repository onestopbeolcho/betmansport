"""
Scorenix Video Concatenation Engine
===================================
MoviePy를 사용하여 여러 비디오 클립을 초고퀄리티로 병합합니다.
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import os
import argparse
from pathlib import Path
from typing import List

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from moviepy.editor import (
        VideoFileClip, AudioFileClip, CompositeAudioClip, concatenate_videoclips
    )
except ImportError:
    print("❌ moviepy 패키지가 필요합니다. 'pip install moviepy'를 실행하세요.")
    sys.exit(1)


def concatenate_videos(
    video_paths: List[str],
    output_path: str,
    bgm_path: str = None,
    bgm_volume: float = 0.08,
    transition_duration: float = 0.0,
    quality: str = "high"
) -> bool:
    """
    여러 비디오 파일을 읽어 하나의 고화질 비디오로 병합합니다.

    Args:
        video_paths: 병합할 비디오 파일 경로 리스트
        output_path: 저장될 최종 비디오 경로
        bgm_path: 배경 음악 파일 경로 (선택)
        bgm_volume: 배경 음악 볼륨 크기 (0.0 ~ 1.0)
        transition_duration: 클립 간 교차 페이드(crossfade) 지속 시간(초)
        quality: 화질 설정 ('high' 또는 'standard')

    Returns:
        성공 여부 (bool)
    """
    if not video_paths:
        print("❌ 병합할 비디오 파일이 지정되지 않았습니다.")
        return False

    print(f"🎬 비디오 병합 시작 (총 {len(video_paths)}개 파일) -> {output_path}")
    clips = []
    
    # 1. 파일 존재 여부 확인 및 로드
    for path in video_paths:
        if not os.path.exists(path):
            print(f"❌ 비디오 파일을 찾을 수 없습니다: {path}")
            # 이미 로드된 클립 닫기
            for c in clips:
                c.close()
            return False
        
        print(f"  [+] 비디오 로드 중: {os.path.basename(path)}")
        clips.append(VideoFileClip(path))

    if not clips:
        return False

    # 2. 다른 해상도의 비디오 통일 (가장 큰 해상도로 리사이즈)
    max_w = max(c.w for c in clips)
    max_h = max(c.h for c in clips)
    print(f"  [Size] 대상 해상도로 자동 조정: {max_w}x{max_h}")

    resized_clips = []
    for c in clips:
        if c.w != max_w or c.h != max_h:
            print(f"    - 리사이즈 적용: {c.w}x{c.h} -> {max_w}x{max_h} ({os.path.basename(c.filename)})")
            resized_clips.append(c.resize(newsize=(max_w, max_h)))
        else:
            resized_clips.append(c)

    # 3. 비디오 연결 (트랜지션 지원)
    try:
        if transition_duration > 0.0 and len(resized_clips) > 1:
            print(f"  [Transition] {transition_duration}초 교차 페이드(crossfade) 적용 중...")
            # 각 클립에 crossfade 효과 설정
            fade_clips = []
            for i, clip in enumerate(resized_clips):
                if i > 0:
                    clip = clip.crossfadein(transition_duration)
                fade_clips.append(clip)
            # 음수 padding을 주어 겹치게 합성
            final_clip = concatenate_videoclips(
                fade_clips, method="compose", padding=-transition_duration
            )
        else:
            final_clip = concatenate_videoclips(resized_clips, method="compose")

        # 4. 배경 음악(BGM) 믹싱
        if bgm_path and os.path.exists(bgm_path):
            print(f"  [BGM] 배경음악 믹싱 중: {os.path.basename(bgm_path)} (볼륨: {bgm_volume})")
            from moviepy.audio.fx.volumex import volumex
            
            bgm = AudioFileClip(bgm_path)
            if bgm.duration < final_clip.duration:
                from moviepy.audio.fx.audio_loop import audio_loop
                bgm = audio_loop(bgm, duration=final_clip.duration)
            else:
                bgm = bgm.subclip(0, final_clip.duration)
            
            bgm = bgm.fx(volumex, bgm_volume)

            if final_clip.audio:
                # 원본 오디오와 BGM 믹싱
                final_audio = CompositeAudioClip([final_clip.audio, bgm])
            else:
                final_audio = bgm
            
            final_clip = final_clip.set_audio(final_audio)

        # 5. 초고퀄리티 인코딩 파라미터 세팅
        if quality == "high":
            bitrate = "12000k"
            preset = "slow"
        else:
            bitrate = "8000k"
            preset = "medium"

        print(f"  [REC] 인코딩 시작 (화질: {quality}, 비트레이트: {bitrate}, 프리셋: {preset})...")
        
        # 출력 폴더 생성
        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        final_clip.write_videofile(
            output_path,
            fps=30,
            codec="libx264",
            audio_codec="aac",
            bitrate=bitrate,
            threads=4,
            preset=preset,
        )

        print(f"✅ 비디오 병합 완료: {output_path}")
        return True

    except Exception as e:
        print(f"❌ 비디오 병합 실패: {e}")
        return False
    finally:
        # 리소스 해제
        for c in clips:
            c.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scorenix Video Concat CLI")
    parser.add_argument("--files", required=True, help="병합할 비디오 파일 목록 (쉼표로 구분)")
    parser.add_argument("--output", required=True, help="출력할 최종 비디오 파일 경로")
    parser.add_argument("--bgm", help="믹싱할 BGM 파일 경로")
    parser.add_argument("--bgm-vol", type=float, default=0.08, help="BGM 볼륨 크기 (기본값: 0.08)")
    parser.add_argument("--transition", type=float, default=0.0, help="교차 페이드 지속 시간(초)")
    parser.add_argument("--quality", choices=["high", "standard"], default="high", help="인코딩 화질 (기본값: high)")

    args = parser.parse_args()
    video_list = [f.strip() for f in args.files.split(",")]

    success = concatenate_videos(
        video_paths=video_list,
        output_path=args.output,
        bgm_path=args.bgm,
        bgm_volume=args.bgm_vol,
        transition_duration=args.transition,
        quality=args.quality
    )
    sys.exit(0 if success else 1)
