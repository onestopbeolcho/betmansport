import os
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip, AudioFileClip, ColorClip

# Windows 환경에서는 ImageMagick 경로 설정이 필요할 수 있습니다.
# 설치 후 아래 경로를 본인의 환경에 맞게 수정하세요.
# os.environ["IMAGEMAGICK_BINARY"] = r"C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\magick.exe"

def create_short_video(bg_video_path, audio_path, text_segments, output_path):
    """
    쇼츠/틱톡용 세로형(9:16) 영상을 생성하는 PoC 함수
    
    :param bg_video_path: 배경 영상 경로 (또는 색상 배경 대체 가능)
    :param audio_path: TTS 오디오 파일 경로
    :param text_segments: 자막 구간 리스트 [{"start": 0, "end": 2, "text": "안녕"}, ...]
    :param output_path: 렌더링될 mp4 파일 저장 경로
    """
    
    # 1. 오디오 로드
    if not os.path.exists(audio_path):
        print(f"오디오 파일이 없습니다: {audio_path}")
        return
        
    audio_clip = AudioFileClip(audio_path)
    duration = audio_clip.duration
    
    # 2. 배경 설정 (세로형 해상도 1080x1920)
    if os.path.exists(bg_video_path):
        # 배경 영상을 불러오고 해상도 조정 및 오디오 길이에 맞게 자름
        bg_clip = VideoFileClip(bg_video_path).resize(height=1920)
        # 화면 중앙을 1080x1920 비율로 크롭
        bg_clip = bg_clip.crop(x_center=bg_clip.w/2, y_center=bg_clip.h/2, width=1080, height=1920)
        bg_clip = bg_clip.subclip(0, duration)
    else:
        # 배경 영상이 없으면 검은색 배경 사용
        print("배경 영상이 없어 검은색 기본 배경을 사용합니다.")
        bg_clip = ColorClip(size=(1080, 1920), color=(15, 15, 20)).set_duration(duration)

    bg_clip = bg_clip.set_audio(audio_clip)

    # 3. 자막(Text) 클립 생성
    clips = [bg_clip]
    
    for segment in text_segments:
        start_time = segment["start"]
        end_time = min(segment["end"], duration)
        text = segment["text"]
        
        # 틱톡/쇼츠 스타일 팝업 텍스트 (화면 중앙, 굵고 큰 폰트)
        # 폰트는 환경에 따라 다를 수 있으므로 기본값인 'Arial' 또는 'Malgun-Gothic' 사용 권장
        try:
            txt_clip = TextClip(
                text, 
                fontsize=90, 
                color='white', 
                font='Malgun-Gothic-Bold', # 한글 지원 폰트
                stroke_color='black', 
                stroke_width=4,
                method='caption',
                size=(900, None), # 너비 제한으로 자동 줄바꿈
                align='center'
            )
            
            # 자막 위치(화면 중앙) 및 표시 시간 설정
            txt_clip = txt_clip.set_position('center').set_start(start_time).set_end(end_time)
            clips.append(txt_clip)
            
        except Exception as e:
            print(f"텍스트 클립 생성 중 오류 발생 (ImageMagick 확인 필요): {e}")
            break

    # 4. 합성 및 렌더링
    final_video = CompositeVideoClip(clips)
    
    print("영상 렌더링 시작...")
    # 빠른 렌더링을 위해 스레드 사용 및 적절한 프리셋 설정
    final_video.write_videofile(
        output_path, 
        fps=30, 
        codec="libx264", 
        audio_codec="aac", 
        threads=4, 
        preset="ultrafast"
    )
    print(f"렌더링 완료: {output_path}")

if __name__ == "__main__":
    # 테스트용 데이터
    test_audio = "test_tts.mp3"  # 사전에 짧은 mp3 파일을 준비해야 합니다.
    test_bg = "background.mp4"   # 틱톡 배경용 mp4 영상 (없으면 검은 배경)
    
    # [시간(초), 시간(초), 텍스트] 형식의 더미 데이터
    dummy_subtitles = [
        {"start": 0.0, "end": 2.5, "text": "스코어닉스 AI가 분석한"},
        {"start": 2.5, "end": 5.0, "text": "오늘 무조건 이기는 경기 3가지!"},
        {"start": 5.0, "end": 7.5, "text": "첫 번째 맨시티. 압도적 승리가 예상됩니다."},
        {"start": 7.5, "end": 10.0, "text": "최종 픽 조합은 채널 멤버십에서 확인하세요!"}
    ]
    
    # 오디오 파일이 없을 경우 테스트를 위한 안내
    if not os.path.exists(test_audio):
        print(f"==================================================")
        print(f"[{test_audio}] 파일이 존재하지 않습니다!")
        print(f"테스트를 위해 짧은 10초짜리 mp3 파일을 스크립트 폴더에 넣어주세요.")
        print(f"==================================================")
    else:
        create_short_video(test_bg, test_audio, dummy_subtitles, "output_shorts_test.mp4")
