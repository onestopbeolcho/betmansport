import sys
import os
import logging

# 프로젝트 루트 추가
sys.path.append(os.getcwd())

logging.basicConfig(level=logging.INFO)

def main():
    print("==============================================")
    print("   스코어닉스 유튜브 채널 연동 (1회 인증)")
    print("==============================================")
    print("\n[안내] 잠시 후 브라우저가 열립니다.")
    print("유튜브 채널이 있는 구글 계정으로 로그인하고")
    print("'권한 허용'을 눌러주세요.\n")
    
    try:
        from app.services.youtube_uploader import get_youtube_service
        service = get_youtube_service()
        print("\n✅ 축하합니다! 유튜브 채널 연동에 성공했습니다.")
        print("이제 영상 제작 시 자동으로 업로드가 가능합니다.")
    except Exception as e:
        print(f"\n❌ 연동 실패: {e}")
        
    print("\n이 창을 닫으셔도 됩니다.")

if __name__ == "__main__":
    main()
