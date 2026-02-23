"""
Gemini AI Service — 스포츠 베팅 분석 LLM 연동
- google-genai SDK (Gemini 2.5 Flash)
- 배당 데이터 기반 분석 프롬프트 생성
- API 키 없을 시 규칙 기반 분석 폴백
"""
import logging
from typing import Optional
from app.models.config import config

logger = logging.getLogger(__name__)

# Lazy load
_client = None
_initialized = False


def _init_gemini() -> bool:
    """Lazy-init Gemini client. Only runs once."""
    global _client, _initialized
    if _initialized:
        return _client is not None

    _initialized = True
    api_key = config.gemini_api_key
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured — using rule-based fallback")
        return False

    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        logger.info("✅ Gemini client initialized (google-genai SDK)")
        return True
    except ImportError:
        logger.error("google-genai package not installed. Run: pip install -U google-genai")
        return False
    except Exception as e:
        logger.error(f"Gemini init failed: {e}")
        return False


SYSTEM_PROMPT = """당신은 스포츠 베팅 분석 전문 AI입니다. 한국어로 답변하세요.

역할:
- 배당률 데이터를 기반으로 경기를 분석합니다.
- Pinnacle(해외 기준 배당)과 Betman(국내 배당)의 차이를 설명합니다.
- 통계적 관점에서 기대값(EV)이 양수인 구간을 찾습니다.
- 감정이 아닌 데이터 기반으로 객관적 분석을 제공합니다.

규칙:
1. 절대 도박을 조장하지 마세요.
2. 모든 분석에 "이것은 참고 자료이며, 최종 결정은 본인의 판단입니다"를 포함하세요.
3. 배당률에서 추론 가능한 확률만 언급하세요. 확인되지 않은 내부 정보는 사용하지 마세요.
4. Markdown 형식으로 깔끔하게 답변하세요.
5. 무리한 확신 표현은 피하세요.

분석 구조:
1. 배당률 기반 승률 분석
2. 양팀 비교 (배당 흐름 기반)
3. 그래서, 어디에 가치가 있는지 (밸류벳 판별)
4. 투자 제안 (안정/공격 옵션)
"""


def _build_match_prompt(match_data: dict, query: str) -> str:
    """Build a match-contextual prompt for Gemini."""
    home = match_data.get("team_home", "홈팀")
    away = match_data.get("team_away", "원정팀")
    ho = match_data.get("home_odds", 0)
    do = match_data.get("draw_odds", 0)
    ao = match_data.get("away_odds", 0)
    league = match_data.get("league", "")

    bh = match_data.get("betman_home_odds")
    bd = match_data.get("betman_draw_odds")
    ba = match_data.get("betman_away_odds")

    prompt = f"""사용자 질문: {query}

분석 대상 경기:
- 리그: {league}
- {home} vs {away}
- Pinnacle 배당: 홈 {ho} / 무 {do} / 원정 {ao}
"""
    if bh and ba:
        prompt += f"- Betman 배당: 홈 {bh} / 무 {bd} / 원정 {ba}\n"

        if ho > 1.0 and bh > 0:
            eff_home = round((bh / ho) * 100, 1)
            prompt += f"- 홈 배당 효율: {eff_home}%\n"
        if ao > 1.0 and ba > 0:
            eff_away = round((ba / ao) * 100, 1)
            prompt += f"- 원정 배당 효율: {eff_away}%\n"

    prompt += "\n위 데이터를 바탕으로 분석 리포트를 작성하세요."
    return prompt


async def analyze_match(match_data: dict, query: str) -> str:
    """
    Main entry: Gemini LLM analysis with rule-based fallback.
    """
    if _init_gemini() and _client is not None:
        try:
            prompt = SYSTEM_PROMPT + "\n\n" + _build_match_prompt(match_data, query)
            response = _client.models.generate_content(
                model="gemini-2.5-flash-preview-05-20",
                contents=prompt,
            )
            text = response.text.strip()
            if text:
                logger.info(f"Gemini analysis generated ({len(text)} chars)")
                return text
            else:
                logger.warning("Gemini returned empty response, using fallback")
        except Exception as e:
            logger.error(f"Gemini API error: {e}, using fallback")

    # --- Rule-based fallback ---
    return _generate_rule_based(match_data, query)


def _generate_rule_based(match_data: dict, query: str) -> str:
    """Rule-based analysis when Gemini is unavailable."""
    home = match_data.get("team_home_ko", match_data.get("team_home", "홈팀"))
    away = match_data.get("team_away_ko", match_data.get("team_away", "원정팀"))
    ho = float(match_data.get("home_odds", 0))
    do = float(match_data.get("draw_odds", 0))
    ao = float(match_data.get("away_odds", 0))

    if ho <= 0 or ao <= 0:
        return f"### {home} vs {away}\n\n현재 이 경기의 배당 데이터를 불러올 수 없습니다."

    home_prob = round((1 / ho) * 100, 1)
    away_prob = round((1 / ao) * 100, 1)
    draw_prob = round((1 / do) * 100, 1) if do > 0 else 0

    if ho < ao:
        fav, fav_prob = home, home_prob
        favor_desc = "홈팀 우세"
    else:
        fav, fav_prob = away, away_prob
        favor_desc = "원정팀 우세"

    bh = match_data.get("betman_home_odds")
    ba = match_data.get("betman_away_odds")
    value_section = ""
    if bh and ba and ho > 1.0 and ao > 1.0:
        eff_home = round((float(bh) / ho) * 100, 1)
        eff_away = round((float(ba) / ao) * 100, 1)
        best_side = "홈" if eff_home > eff_away else "원정"
        best_eff = max(eff_home, eff_away)
        badge = "✅ 밸류" if best_eff > 100 else "📊 일반"
        value_section = f"""
**3. 배당 효율 분석** {badge}
| 포지션 | Betman | Pinnacle | 효율 |
|--------|--------|----------|------|
| 홈 승 | {bh} | {ho} | {eff_home}% |
| 원정 승 | {ba} | {ao} | {eff_away}% |

→ **{best_side} 배당 효율 {best_eff}%** — {'국내 배당이 해외보다 유리!' if best_eff > 100 else '해외 대비 약간 낮은 수준입니다.'}
"""

    return f"""### 🤖 AI 분석 리포트: {home} vs {away}

**1. 배당률 기반 승률 예측**
| 포지션 | 배당 | 추정 확률 |
|--------|------|-----------|
| {home} 승 | {ho} | {home_prob}% |
| 무승부 | {do} | {draw_prob}% |
| {away} 승 | {ao} | {away_prob}% |

**2. 핵심 포인트**
- 해외 배당 기준 **{fav}** ({favor_desc}, 추정 {fav_prob}%)
- Pinnacle 'True Odds' 기반 객관적 분석
{value_section}
**4. 투자 제안**
- 🟢 안정: **{fav} 승** (추정 적중률 높음)
- 🟡 공격: 반대 결과에 소액 분산 고려

_※ 이 분석은 배당 데이터를 기반으로 생성되었습니다. 최종 결정은 본인의 판단이 중요합니다._
"""
