import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/blogger']

def main():
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    # 강제로 다시 동의 화면을 띄워 refresh_token을 반드시 받아옴
    creds = flow.run_local_server(port=0, prompt='consent')

    env_content = f"""
BLOGGER_CLIENT_ID={creds.client_id}
BLOGGER_CLIENT_SECRET={creds.client_secret}
BLOGGER_REFRESH_TOKEN={creds.refresh_token}
"""
    # 백엔드 루트가 아닌 최상단 프로젝트 폴더의 .env에 기록
    parent_env = os.path.join(os.path.dirname(__file__), "..", ".env")
    
    if os.path.exists(parent_env):
        with open(parent_env, "a", encoding="utf-8") as f:
            f.write("\n# Blogger API Keys\n")
            f.write(env_content)
        print("SUCCESS_SAVED_TO_ENV")
    else:
        with open("token.txt", "w", encoding="utf-8") as f:
            f.write(env_content)
        print("SUCCESS_SAVED_TO_TOKEN_TXT")

if __name__ == '__main__':
    main()
