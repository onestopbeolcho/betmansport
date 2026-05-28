import os
import sys
import asyncio
import logging

PROJECT_BACKEND = os.path.dirname(os.path.abspath(__file__))
sys.path.append(PROJECT_BACKEND)

from app.services.browser_recorder import record_page

async def main():
    logging.basicConfig(level=logging.INFO)
    print("--- starting browser recording test ---")
    
    # 1. 스코어닉스 예측 페이지 또는 메인페이지 지정
    url = "https://scorenix.com"
    output_webm = os.path.join(PROJECT_BACKEND, "test_record.webm")
    
    # 10초 동안 녹화 수행
    success = await record_page(url, output_webm, duration=12.0)
    
    if not success:
        print("❌ 녹화 실패!")
        return
        
    print(f"✅ WebM 녹화 파일 생성됨: {output_webm}")
    
    # 2. MoviePy를 사용해서 MP4로 변환하고 세로 비율 크롭 확인
    try:
        from moviepy.editor import VideoFileClip
        print("Converting WebM to MP4 using MoviePy...")
        output_mp4 = os.path.join(PROJECT_BACKEND, "background.mp4")
        
        clip = VideoFileClip(output_webm)
        # 540x960 9:16 비디오 그대로 MP4 변환 및 오디오 제거(배경 무음 처리)
        clip.without_audio().write_videofile(
            output_mp4,
            codec="libx264",
            audio=False,
            preset="ultrafast",
            threads=4
        )
        print(f"🎉 성공! 최종 배경 동영상 파일 생성됨: {output_mp4}")
        clip.close()
        
    except Exception as e:
        print(f"❌ 동영상 변환 중 에러 발생: {e}")

if __name__ == "__main__":
    asyncio.run(main())
