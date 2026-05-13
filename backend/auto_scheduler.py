import time
import schedule
import datetime
import os
import sys

# 프로젝트 루트를 경로에 추가 (모듈 임포트용)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from generate_shorts_pipeline import generate_video

def auto_job():
    print(f"\n[{datetime.datetime.now()}] 🚀 자동 쇼츠 생성 및 업로드 사이클 시작...")
    
    # 바탕화면에 결과물 저장
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    timestamp = datetime.datetime.now().strftime("%m%d_%H%M")
    output_filename = f"스코어닉스_자동업로드_{timestamp}.mp4"
    output_path = os.path.join(desktop, output_filename)
    
    # 배경 영상 경로 (기본값)
    bg_video = "background.mp4"
    
    try:
        # 영상 생성 및 자동 업로드 (auto_upload=True)
        generate_video(bg_video, output_path, auto_upload=True)
        
        # 로그 기록
        with open("automation_log.txt", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now()}] ✅ 업로드 성공: {output_filename}\n")
            
        print(f"[{datetime.datetime.now()}] ✅ 한 주기가 성공적으로 완료되었습니다.")
        
    except Exception as e:
        error_msg = f"[{datetime.datetime.now()}] ❌ 오류 발생: {str(e)}\n"
        print(error_msg)
        with open("automation_log.txt", "a", encoding="utf-8") as f:
            f.write(error_msg)

# --- 스케줄 설정 ---
# 하루 6번 (4시간 간격)
schedule.every(4).hours.do(auto_job)

# 특정 시간에 딱딱 올리고 싶다면 아래처럼 설정 가능 (주석 해제 후 사용)
# schedule.every().day.at("08:00").do(auto_job)
# schedule.every().day.at("12:00").do(auto_job)
# schedule.every().day.at("16:00").do(auto_job)
# schedule.every().day.at("20:00").do(auto_job)

print("==================================================")
print(" 🤖 스코어닉스 쇼츠 자동화 시스템 가동 중...")
print(f" 현재 시각: {datetime.datetime.now()}")
print(" 이 창을 유지하면 4시간마다 영상이 자동 업로드됩니다.")
print("==================================================")

# 프로그램을 켜자마자 첫 영상을 즉시 올리려면 아래 주석을 해제하세요.
# auto_job()

while True:
    schedule.run_pending()
    time.sleep(60) # 1분마다 체크
