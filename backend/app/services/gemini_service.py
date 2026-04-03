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
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _client = genai.GenerativeModel("gemini-2.0-flash")
        logger.info("✅ Gemini client initialized (google-generativeai SDK)")
        return True
    except ImportError:
        logger.error("google-generativeai package not installed. Run: pip install -U google-generativeai")
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
            response = _client.generate_content(prompt)
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


# ═══════════════════════════════════════════════════
# Phase 4: ML 결과 기반 리포트 생성 (해설가 전용)
# ═══════════════════════════════════════════════════

REPORTER_PROMPT = """당신은 Scorenix의 AI 스포츠 데이터 분석관입니다. 한국어로 답변하세요.

역할:
- ML 모델이 산출한 승률 예측 결과(JSON)를 받아 유저 친화적인 마크다운 리포트를 작성합니다.
- 예측 결과의 근거가 되는 핵심 변수(Feature)를 자연어로 설명합니다.
- 수학적 계산은 하지 않습니다. ML이 이미 계산한 결과를 해설만 합니다.

규칙:
1. 제공된 JSON 데이터만 사용하세요. 외부 정보를 추가하지 마세요.
2. 도박을 조장하지 마세요.
3. "이것은 AI 예측 결과이며, 최종 판단은 본인의 판단이 중요합니다"를 포함하세요.
4. Markdown 형식으로 깔끔하게 작성하세요.
5. 500자 이내로 간결하게 작성하세요.
"""

ERROR_NOTE_PROMPT = """당신은 Scorenix의 VIP 데이터 분석관입니다. 한국어로 답변하세요.

역할:
- AI 오답 분석 JSON을 받아 프리미엄 마크다운 리포트(오답 노트)를 작성합니다.
- 이 실패를 통해 AI가 무엇을 학습했고, 어떻게 더 똑똑해졌는지 유저가 신뢰할 수 있는 톤으로 서술합니다.
- 투자자들이 "AI가 성장하고 있구나"라고 느낄 수 있는 전문적이면서도 솔직한 어조를 사용하세요.

규칙:
1. 제공된 JSON만 사용하세요.
2. 500자 이내로 작성하세요.
3. Markdown 형식으로 작성하세요.
4. 반드시 "📊 AI 학습 노트"라는 제목으로 시작하세요.
"""


async def generate_ml_report(ml_result: dict) -> str:
    """
    Phase 4: ML 예측 결과 JSON → Gemini → 유저 친화적 리포트.
    토큰 절감: 원천 데이터 대신 초압축 JSON만 전달.
    
    일반 경기: gemini-2.0-flash (비용 절감)
    """
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = REPORTER_PROMPT + "\n\nML 예측 결과 JSON:\n" + json.dumps(ml_result, ensure_ascii=False, indent=2)
            prompt += "\n\n위 JSON 결과를 바탕으로 이 경기의 분석 리포트를 작성하세요."

            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"ML report generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"ML report generation error: {e}")

    # Fallback: simple formatted output
    return _format_ml_result_simple(ml_result)


async def generate_error_note_report(error_note: dict) -> Optional[str]:
    """
    Phase 4: 오답 노트 JSON → Gemini Pro → VIP 마크다운 리포트.
    VIP 전용이므로 gemini-2.5-pro 사용 (고품질 추론).
    """
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = ERROR_NOTE_PROMPT + "\n\n오답 분석 JSON:\n" + json.dumps(error_note, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 AI 학습 노트를 작성하세요."

            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"Error note report generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Error note generation error: {e}")

    return None


def _format_ml_result_simple(ml_result: dict) -> str:
    """Simple formatting when Gemini is unavailable."""
    preds = ml_result.get("predictions", {})
    home_pct = round(preds.get("home_win", 0.33) * 100, 1)
    draw_pct = round(preds.get("draw", 0.33) * 100, 1)
    away_pct = round(preds.get("away_win", 0.33) * 100, 1)
    rec = ml_result.get("recommendation", "")
    confidence = ml_result.get("confidence", 0)
    engine = ml_result.get("engine", "unknown")
    match_id = ml_result.get("match_id", "")

    teams = match_id.split("_")
    home = teams[0] if len(teams) >= 2 else "홈팀"
    away = teams[1] if len(teams) >= 2 else "원정팀"

    features_text = ""
    for f in ml_result.get("top_features", [])[:3]:
        features_text += f"- **{f['feature']}**: {f['value']} (중요도 {f['importance']})\n"

    return f"""### 🤖 AI 예측 리포트: {home} vs {away}

**ML 엔진:** `{engine}` | **신뢰도:** {confidence}%

| 결과 | 확률 |
|------|------|
| {home} 승 | {home_pct}% |
| 무승부 | {draw_pct}% |
| {away} 승 | {away_pct}% |

**추천:** {rec} ({confidence}%)

**핵심 변수:**
{features_text}
_※ AI 예측 결과이며, 최종 판단은 본인의 판단이 중요합니다._
"""


# ═══════════════════════════════════════════════════
# Phase 5: SNS 마케팅 콘텐츠 자동 생성
# ═══════════════════════════════════════════════════

SNS_MARKETING_PROMPT = """당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어와 영어 혼용으로 작성하세요.

역할:
- AI 예측 데이터를 받아 짧고 매력적인 SNS 게시물을 생성합니다.
- 사용자가 Scorenix 앱에 방문하고 싶게 만드는 흥미로운 톤을 사용하세요.
- 데이터 기반 분석의 정확성을 부각하되, 도박 조장은 절대 하지 마세요.

규칙:
1. 280자 이내로 작성하세요 (X/Twitter 호환).
2. 이모지를 적극 활용하세요.
3. 해시태그 3-5개를 포함하세요 (#Scorenix #AI분석 등).
4. "분석", "예측", "데이터" 등 합법적 용어만 사용하세요.
5. 절대 "도박", "베팅", "판돈" 등의 용어를 사용하지 마세요.
6. 반드시 "scorenix.com" 링크를 포함하세요.
7. 신뢰도가 높은 경기일수록 더 강한 톤으로 작성하세요.

출력 형식:
각 경기별 게시물을 ---로 구분하여 작성하세요.
"""


async def generate_sns_content(predictions: list) -> list:
    """
    Top N 예측 경기를 SNS 마케팅 콘텐츠로 변환.
    Returns: [{"match_id": str, "text": str, "confidence": float}]
    """
    if not predictions:
        return []

    # 고신뢰 순 정렬 → Top 3
    sorted_preds = sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True)
    top_picks = sorted_preds[:3]

    if _init_gemini() and _client is not None:
        try:
            import json
            match_summaries = []
            for p in top_picks:
                match_summaries.append({
                    "match": f"{p.get('team_home_ko', p.get('team_home', ''))} vs {p.get('team_away_ko', p.get('team_away', ''))}",
                    "league": p.get("league", ""),
                    "confidence": p.get("confidence", 0),
                    "recommendation": p.get("recommendation", ""),
                    "home_prob": p.get("home_win_prob", 0),
                    "draw_prob": p.get("draw_prob", 0),
                    "away_prob": p.get("away_win_prob", 0),
                    "factors_summary": [f.get("name", "") for f in p.get("factors", [])[:3]],
                })

            prompt = SNS_MARKETING_PROMPT + "\n\n오늘의 AI 추천 경기 데이터:\n" + json.dumps(match_summaries, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 각 경기별 SNS 게시물을 작성하세요."

            response = _client.generate_content(prompt)
            text = response.text.strip()

            if text:
                # Parse individual posts separated by ---
                posts = [p.strip() for p in text.split("---") if p.strip()]
                results = []
                for i, post_text in enumerate(posts):
                    if i < len(top_picks):
                        results.append({
                            "match_id": top_picks[i].get("match_id", ""),
                            "text": post_text,
                            "confidence": top_picks[i].get("confidence", 0),
                            "league": top_picks[i].get("league", ""),
                        })
                logger.info(f"✅ SNS content generated: {len(results)} posts")
                return results

        except Exception as e:
            logger.error(f"SNS content generation error: {e}")

    # Fallback: simple template
    return _generate_sns_fallback(top_picks)


def _generate_sns_fallback(predictions: list) -> list:
    """Gemini 없을 때 템플릿 기반 SNS 콘텐츠"""
    results = []
    for p in predictions:
        home = p.get("team_home_ko", p.get("team_home", "홈"))
        away = p.get("team_away_ko", p.get("team_away", "원정"))
        conf = p.get("confidence", 0)
        rec = p.get("recommendation", "")
        league = p.get("league", "")

        rec_label = "홈 승" if rec == "HOME" else "원정 승" if rec == "AWAY" else "무승부"
        fire = "🔥🔥" if conf >= 70 else "🔥" if conf >= 55 else "⚡"

        text = (
            f"{fire} {league}\n"
            f"{home} vs {away}\n\n"
            f"🧠 AI 분석: {rec_label} (신뢰도 {conf:.0f}%)\n"
            f"📊 7-Factor AI v2 기반 데이터 분석\n\n"
            f"👉 scorenix.com\n\n"
            f"#Scorenix #AI분석 #스포츠분석 #{league.replace(' ', '')}"
        )
        results.append({
            "match_id": p.get("match_id", ""),
            "text": text,
            "confidence": conf,
            "league": league,
        })
    return results


