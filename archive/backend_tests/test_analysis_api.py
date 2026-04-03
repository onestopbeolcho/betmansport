
import httpx
import asyncio
import sys
import json

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

async def test_analysis():
    url = "http://localhost:8000/api/analysis/ask"
    
    scenarios = [
        {"name": "Greeting (Guardrail)", "query": "안녕하세요 도와주세요"},
        {"name": "Irrelevant (Guardrail)", "query": "파스타 만드는 법 알려줘"},
        {"name": "Valid Match (Mock Data)", "query": "맨체스터 시티 분석해봐"} 
    ]
    
    print(f"Testing Analysis API at: {url}\n")
    
    async with httpx.AsyncClient() as client:
        for scenario in scenarios:
            print(f"--- Scenario: {scenario['name']} ---")
            print(f"Query: {scenario['query']}")
            
            try:
                response = await client.post(url, json={"query": scenario['query']})
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Match Found: {data.get('match_found')}")
                    print(f"Match Name: {data.get('match_name')}")
                    print(f"Response Preview: {data.get('response')[:50]}...")
                    if data.get('match_found'):
                        print("✅ SUCCESS: Correctly identified match.")
                    elif scenario['name'] == "Valid Match (Mock Data)":
                        print("❌ FAILURE: Failed to identify valid match.")
                    else:
                         print("✅ SUCCESS: Correctly rejected/guided.")
                else:
                    print(f"❌ Error: {response.status_code}")
                    print(response.text)
            except Exception as e:
                print(f"❌ Connection Error: {e}")
            
            print("\n")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_analysis())
