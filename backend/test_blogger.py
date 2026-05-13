import asyncio
import sys
import os

# 백엔드 루트를 시스템 패스에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.models.config import config

from app.services.blogger_service import blogger_service

async def test():
    print(f"Testing Blogger ID: {config.blogger_blog_id}")
    print("Refreshing Token...")
    success = await blogger_service._refresh_access_token()
    if not success:
        print("❌ 실패: 리프레시 토큰으로 액세스 토큰을 발급받지 못했습니다.")
        return
        
    print("✅ 액세스 토큰 정상 발급 완료!")
    print("Sending Test Post...")
    res = await blogger_service.publish_post(
        title="[테스트] 구글 블로그 연동 자동 포스팅 시스템 테스트",
        content="""
        <h1>테스트 성공!</h1>
        <p>백엔드 파이썬 시스템에서 블로거 API를 통해 자동으로 글이 발행되었습니다.</p>
        <p>이건 테스트 글이므로 확인 후 삭제하셔도 좋습니다.</p>
        """,
        labels=["테스트"]
    )
    if res:
        print(f"🎉 성공! URL: {res.get('url')}")
    else:
        print("❌ 포스팅 실패.")

if __name__ == "__main__":
    asyncio.run(test())
