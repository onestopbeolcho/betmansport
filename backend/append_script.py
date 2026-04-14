import time

content = """

SNS_GENERIC_MARKETING_PROMPT = \"\"\"당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어와 영어 혼용으로 트렌디하게 작성하세요.

역할:
- 오늘 당장 분석할 뚜렷한 경기가 없더라도, 사용자가 Scorenix(스코어닉스) 웹사이트를 방문하고 싶게 만드는 강력한 호기심 유발 마케팅 게시물을 생성하세요.
- 데이터 기반 분석의 전문성을 부각하되, 무리한 배팅 등 도박 조장은 절대 하지 마세요.

규칙 (매우 중요):
1. **반드시 SCORENIX.COM 도메인을 언급하고 클릭을 유도하세요**. (예: scorenix.com 에서 확인하세요!)
2. 280자 이내로 콤팩트하고 눈에 띄게 작성하세요 (X/Twitter 호환).
3. 이모지를 적극 활용하세요 (🔥, ⚽, 🚀, 🤖 등).
4. 해시태그 3-5개를 반드시 포함하세요 (#Scorenix #AI예측 #스포츠데이터).
5. **매 번 생성할 때마다 첫 줄 인사말이나 어조, 이모지 배치를 완전히 다르게 해서 (중복 방지) 써주세요.**
6. 본문 끝에는 항상 메인 홈페이지 링크를 첨부하세요:
   👉 플랫폼 구경하기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_generic
   (인스타는 프로필 링크 확인!)
\"\"\"

async def generate_generic_promo() -> Optional[str]:
    \"\"\"경기 데이터가 없을 때 사용하는 일반 홍보물 생성 (중복 방지 Timestamp 추가)\"\"\"
    import time
    stamp = int(time.time())
    
    if _init_gemini() and _client is not None:
        try:
            response = _client.generate_content(SNS_GENERIC_MARKETING_PROMPT)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Generic SNS promo generated ({len(text)} chars)")
                return f"{text}\\n\\n[Ref: {stamp}]"
        except Exception as e:
            logger.error(f"Generic SNS promo generation error: {e}")
            
    # Fallback if Gemini fails
    return (
        "🔥 스포츠 투자의 새로운 기준, Scorenix! 📈\\n\\n"
        "감에 의존하는 투자는 이제 그만. 🤖 배당률 분석과 7-Factor AI 알고리즘으로 매일 가장 가치 있는 정보만 선별해 드립니다.\\n\\n"
        "지금 바로 SCORENIX.COM 에서 놀라운 예측 결과를 확인하세요!\\n\\n"
        "👉 플랫폼 구경하기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_generic\\n"
        "(인스타는 프로필 링크 확인!)\\n\\n"
        f"#Scorenix #AI예측 #스포츠분석 #가치투자\\n\\n[Ref: {stamp}]"
    )
"""
with open('app/services/gemini_service.py', 'a', encoding='utf-8') as f:
    f.write(content)
