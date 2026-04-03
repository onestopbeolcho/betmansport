"""
베트맨 메인 페이지에서 "진행 중인 모든 회차" API 찾기
"""
from playwright.sync_api import sync_playwright
import json
import time

def intercept_betman_main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = context.new_page()
        
        all_requests = []
        
        # Intercept all network requests
        def handle_request(request):
            if 'betman.co.kr' in request.url:
                all_requests.append({
                    'url': request.url,
                    'method': request.method,
                    'post_data': request.post_data,
                })
                print(f"\n📡 {request.method} {request.url}")
                if request.post_data:
                    print(f"   Payload: {request.post_data[:200]}")
        
        page.on('request', handle_request)
        
        # Visit main page
        print("베트맨 메인 페이지 방문 중...")
        page.goto("https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do")
        
        # Wait for page to load
        time.sleep(5)
        
        # Log all captured requests
        print(f"\n\n{'='*60}")
        print(f"총 {len(all_requests)}개 요청 캡처")
        print(f"{'='*60}\n")
        
        for req in all_requests:
            if '/api/' in req['url'] or '.do' in req['url']:
                print(f"{req['method']} {req['url']}")
                if req['post_data']:
                    print(f"  → {req['post_data'][:100]}")
        
        # Save to file
        with open('betman_requests.json', 'w', encoding='utf-8') as f:
            json.dump(all_requests, f, ensure_ascii=False, indent=2)
        
        print(f"\n\n전체 요청 목록 저장: betman_requests.json")
        
        input("\n\n브라우저 닫으려면 Enter...")
        browser.close()

if __name__ == "__main__":
    intercept_betman_main()
