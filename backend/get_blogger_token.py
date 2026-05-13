import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow

# Blogger API 연동을 위한 필수 권한 (Scope) 설정
SCOPES = ['https://www.googleapis.com/auth/blogger']

def main():
    print("🚀 [Step 1/2] Blogger OAuth2 인증을 시작합니다.")
    print("동일한 폴더에 GCP에서 다운받은 'credentials.json' 파일이 있어야 합니다.\n")
    
    if not os.path.exists("credentials.json"):
        print("❌ 오류: 'credentials.json' 파일이 없습니다!")
        print("구글 클라우드 콘솔에서 OAuth 2.0 클라이언트 ID를 생성하고 JSON을 다운받아 backend/credentials.json 으로 저장해주세요.")
        return

    try:
        # 브라우저를 열어 사용자에게 권한을 요청
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)

        # 발급 완료된 토큰 추출
        refresh_token = creds.refresh_token
        client_id = creds.client_id
        client_secret = creds.client_secret
        
        print("\n✅ [성공] 인증이 완료되었습니다! 다음 키 값들을 복사하여 .env 에 저장하세요:\n")
        print("="*60)
        print(f"BLOGGER_CLIENT_ID={client_id}")
        print(f"BLOGGER_CLIENT_SECRET={client_secret}")
        print(f"BLOGGER_REFRESH_TOKEN={refresh_token}")
        print("="*60)
        
        # .env 파일에 자동 추가 시도
        env_path = ".env"
        if os.path.exists(env_path):
            with open(env_path, "a", encoding="utf-8") as f:
                f.write(f"\n# Blogger API 자동 추가 토큰\n")
                f.write(f"BLOGGER_CLIENT_ID={client_id}\n")
                f.write(f"BLOGGER_CLIENT_SECRET={client_secret}\n")
                f.write(f"BLOGGER_REFRESH_TOKEN={refresh_token}\n")
            print("\n💡 [자동화 완료] 현재 폴더의 .env 파일 맨 아래에 설정값들을 자동으로 추가해두었습니다!")
        else:
            print("\n💡 .env 파일이 백엔드 최상단 루트에 없어서 자동 추가는 생략했습니다. 직접 복사해주세요.")
            
    except Exception as e:
        print(f"\n❌ 인증 중 에러가 발생했습니다: {e}")

if __name__ == '__main__':
    main()
