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


SYSTEM_PROMPT = """당신은 Scorenix의 'AI 수석 데이터 분석관'입니다. 
당신의 목표는 단순한 예측을 넘어, 제공된 방대한 데이터를 종합하여 유저에게 '데이터 기반의 통찰력'을 제공하는 것입니다. 
한국어로 답변하되, 매우 전문적이고 분석적인 어조를 유지하세요.

역할:
1. 데이터 통합 분석: 배당률, 순위, 최근 폼, 상대 전적, 결장자 정보를 유기적으로 연결하여 해설합니다.
2. 가치 투자 관점: 단순히 '누가 이길까'가 아니라, '어디에 투자 가치(Expected Value)가 있는가'를 판별합니다.
3. 리스크 관리: 통계적 이변 가능성이나 데이터의 공백(라인업 미확정 등)을 짚어줍니다.

분석 원칙 (반드시 준수):
- '용어 정제': '베팅', '도박', '픽', '토토'라는 단어를 절대 사용하지 마세요. 대신 '분석', '투자', '예측', '밸류', '포지션', '리스크' 등의 용어를 사용합니다.
- '객관성': 감정적인 표현(예: "팬으로서 응원합니다")을 배제하고 오직 숫자로 증명하세요.
- '면책 조항': 모든 답변 끝에 "이 분석은 데이터 기반 예측일 뿐이며, 투자 결과에 대한 책임은 본인에게 있습니다."를 포함하세요.

보고서 구조 (Markdown 활용):
1. 📊 **매치 데이터 브리핑**: 배당률 기반 승률 및 양팀 기본 지표.
2. 🆚 **전력 심층 비교**: 리그 순위, 최근 5경기 폼(승/무/패), 공수 지표 분석.
3. 🤝 **상대 전적 (H2H)**: 최근 맞대결 경향 및 특이점.
4. 🏥 **핵심 변수 체크**: 주요 선수 결장 정보 및 라인업 영향력 분석.
5. 📉 **가치 분석 (Value Check)**: 해외(Pinnacle) 대비 국내(Betman) 배당 효율성 및 투자 가치 판별.
6. 🎯 **최종 전략 제안**: 데이터 기반 안정적/공격적 포지션 제안.
"""



def _build_match_prompt(match_data: dict, query: str) -> str:
    """Build a rich, contextual prompt for Gemini with full stats and factor scores."""
    from app.services.factor_scorer import calculate_factor_scores
    factor_results = calculate_factor_scores(match_data)
    total_score = factor_results.get("total_score", 50)
    details = factor_results.get("details", {})

    home = match_data.get("team_home_ko") or match_data.get("team_home", "홈팀")
    away = match_data.get("team_away_ko") or match_data.get("team_away", "원정팀")
    ho = match_data.get("home_odds", 0)
    do = match_data.get("draw_odds", 0)
    ao = match_data.get("away_odds", 0)
    league = match_data.get("league", "")

    # Basic Info
    prompt = f"### 분석 대상 경기: {home} vs {away} ({league})\n"
    prompt += f"사용자 질문: {query}\n\n"

    # 1. 팩터 스코어 보드 (중요)
    prompt += f"#### 1. 🤖 AI 다중 팩터 스코어보드 (홈팀 {home} 관점 유리도)\n"
    prompt += f"- **종합 기대 점수(Total Edge): {total_score}점** / 100점 (50점 이상이면 홈팀 유리, 50점 미만이면 원정팀 유리)\n"
    prompt += f"- [세부 팩터]: 기본 전력({details.get('power_rating')}점), 전술 상성({details.get('h2h_tactics')}점), 로스터 임팩트({details.get('roster_impact')}점), 동기부여({details.get('context_motivation')}점), 배당 밸류({details.get('value_ev')}점)\n\n"
    prompt += f"💡 지시사항: 위 스코어보드의 종합 점수와 세부 팩터의 불균형(예: 총점은 높으나 로스터 임팩트는 낮음 등)을 분석의 핵심 논거로 활용하세요.\n\n"

    # 2. Odds Data
    prompt += "#### 2. 배당 데이터 (Pinnacle)\n"
    prompt += f"- 승: {ho} / 무: {do} / 패: {ao}\n"
    
    bh = match_data.get("betman_home_odds")
    bd = match_data.get("betman_draw_odds")
    ba = match_data.get("betman_away_odds")
    if bh and ba:
        prompt += f"- 국내(Betman): 승 {bh} / 무 {bd} / 패 {ba}\n"
        if ho > 1.0 and bh > 0:
            prompt += f"- 홈 효율: {round((bh/ho)*100, 1)}% / 원정 효율: {round((ba/ao)*100, 1)}%\n"

    # 3. Standings & Form
    standings = match_data.get("standings", {})
    home_s = standings.get("home")
    away_s = standings.get("away")
    if home_s and away_s:
        prompt += "\n#### 3. 리그 순위 및 지표\n"
        prompt += f"- {home}: {home_s.get('rank')}위 ({home_s.get('points')}pts), 최근 폼: {home_s.get('form')}\n"
        prompt += f"- {away}: {away_s.get('rank')}위 ({away_s.get('points')}pts), 최근 폼: {away_s.get('form')}\n"
        prompt += f"- 득실: {home} ({home_s.get('goals_for')}:{home_s.get('goals_against')}) / {away} ({away_s.get('goals_for')}:{away_s.get('goals_against')})\n"

    # 4. Recent Matches (Form details)
    recent = match_data.get("recent_matches", {})
    if recent.get("home") or recent.get("away"):
        prompt += "\n#### 4. 최근 경기 결과 (Last 5)\n"
        if recent.get("home"):
            prompt += f"- {home}: " + ", ".join([f"{m.get('home_goals')}-{m.get('away_goals')}" for m in recent.get("home")[:3]]) + "\n"
        if recent.get("away"):
            prompt += f"- {away}: " + ", ".join([f"{m.get('home_goals')}-{m.get('away_goals')}" for m in recent.get("away")[:3]]) + "\n"

    # 5. H2H
    h2h = match_data.get("h2h")
    if h2h:
        prompt += "\n#### 5. 상대 전적 (H2H)\n"
        prompt += f"- 총 {h2h.get('total_matches')}경기: {home} {h2h.get('team_a_wins')}승, 무 {h2h.get('draws')}번, {away} {h2h.get('team_b_wins')}승\n"

    # 6. Injuries
    injuries = match_data.get("injuries", {})
    if injuries.get("home") or injuries.get("away"):
        prompt += "\n#### 6. 결장자 정보\n"
        if injuries.get("home"):
            prompt += f"- {home}: " + ", ".join([f"{i.get('player_name')}({i.get('reason')})" for i in injuries.get("home")]) + "\n"
        if injuries.get("away"):
            prompt += f"- {away}: " + ", ".join([f"{i.get('player_name')}({i.get('reason')})" for i in injuries.get("away")]) + "\n"

    # 7. Lineups
    lineups = match_data.get("lineups")
    if lineups:
        prompt += "\n#### 7. 예상 라인업 및 포메이션\n"
        for t_name, l_info in lineups.items():
            prompt += f"- {t_name}: {l_info.get('formation', 'N/A')}\n"

    prompt += "\n위의 종합 스코어보드와 데이터 원본을 바탕으로 전문적인 가치 투자 분석 리포트를 작성하세요."
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
- AI 예측 데이터를 받아 사용자가 웹사이트를 클릭하고 싶게 만드는(Click-Through) 호기심 유발 SNS 게시물을 생성합니다.
- 데이터 기반 분석의 전문성을 부각하되, 도박 조장은 절대 하지 마세요.

规则 (매우 중요):
1. [호기심 자극] 절대로 '누가 이길 것'인지 최종 예측 결과(추천 팀)를 본문에 쓰지 마세요.
   (나쁜 예: "AI는 레알 마드리드 승리를 예상합니다.")
   (좋은 예: "AI는 이 경기에서 81% 확률로 엄청난 결과를 예상했습니다. 누가 이길까요?")
2. 280자 이내로 작성하세요 (X/Twitter 호환).
3. 이모지를 적극 활용하세요.
4. 해시태그 3-5개를 포함하세요 (#Scorenix #AI분석 등).
5. "분석", "예측", "데이터" 등 합법적 용어만 사용하세요.
6. 반드시 각 경기 데이터에 함께 주어지는 `url_path` 값을 활용해 본문 맨 마지막에 상세 링크를 추가하세요!
   👉 상세 분석 보기: https://scorenix.com/ko/match/[제공된 url_path]?utm_source=sns&utm_medium=auto_post
   (단, 인스타그램용으로 사용할 수 있도록 "인스타는 프로필 링크 확인!" 이라는 문구도 살짝 덧붙이세요.)

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

    # 고신뢰 순 정렬 → Top 5 (하루 10건 목표: 스케줄러 2회 × 5건)
    sorted_preds = sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True)
    top_picks = sorted_preds[:5]

    if _init_gemini() and _client is not None:
        try:
            import json
            match_summaries = []
            for p in top_picks:
                match_id = p.get("match_id", "")
                
                # Fetch route path elements
                from app.api.endpoints.ai_predictions import get_slug
                slug = get_slug(p)
                match_time_raw = p.get("match_time") or ""
                date_param = ""
                if "T" in match_time_raw:
                    date_param = match_time_raw.split("T")[0]
                elif " " in match_time_raw:
                    date_param = match_time_raw.split(" ")[0]
                else:
                    date_param = match_time_raw
                
                match_summaries.append({
                    "match_id": match_id,
                    "url_path": f"{date_param}/{slug}",
                    "match": f"{p.get('team_home_ko', p.get('team_home', ''))} vs {p.get('team_away_ko', p.get('team_away', ''))}",
                    "league": p.get("league", ""),
                    "confidence": p.get("confidence", 0),
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
        league = p.get("league", "")
        match_id = p.get("match_id", "")

        from app.api.endpoints.ai_predictions import get_slug
        slug = get_slug(p)
        match_time_raw = p.get("match_time") or ""
        date_param = ""
        if "T" in match_time_raw:
            date_param = match_time_raw.split("T")[0]
        elif " " in match_time_raw:
            date_param = match_time_raw.split(" ")[0]
        else:
            date_param = match_time_raw

        fire = "🔥🔥" if conf >= 70 else "🔥" if conf >= 55 else "⚡"

        text = (
            f"{fire} {league}\n"
            f"{home} vs {away}\n\n"
            f"🧠 AI가 {conf:.0f}%의 신뢰도로 예측한 깜짝 결과는?!\n"
            f"절대 놓치지 마세요. 7-Factor AI 데이터 분석으로 찾아낸 가치 베팅 픽!\n\n"
            f"👉 확인하기: https://scorenix.com/ko/match/{date_param}/{slug}?utm_source=sns&utm_medium=auto_post_fallback\n"
            f"(인스타는 프로필 링크 누르고 '{home}' 검색!)\n\n"
            f"#Scorenix #AI분석 #스포츠분석 #{league.replace(' ', '')}"
        )
        results.append({
            "match_id": match_id,
            "text": text,
            "confidence": conf,
            "league": league,
        })
    return results

SNS_GENERIC_MARKETING_PROMPT = """당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어와 영어 혼용으로 트렌디하게 작성하세요.

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
"""

async def generate_generic_promo() -> Optional[str]:
    """경기 데이터가 없을 때 사용하는 일반 홍보물 생성 (중복 방지 Timestamp 추가)"""
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

# ═══════════════════════════════════════════════════
# Phase 6: Blogger SEO 콘텐츠 자동 생성
# ═══════════════════════════════════════════════════

BLOGGER_SEO_PROMPT = """당신은 Scorenix의 SEO 마케팅 전문 AI입니다. 한국어로 작성하세요.

역할:
- 제공된 AI 매치 분석 JSON 데이터를 사용하여 구글 블로거(Blogger) 연동용 HTML 마케팅 게시글을 작성합니다.
- HTML 태그만 출력하세요. 마크다운 기호(```html) 등은 제외하고 순수 HTML 구조만 텍스트로 응답하세요.

규칙 (매우 중요):
1. **타이틀 최적화:** <h1> 태그에 키워드를 넣어 매혹적인 제목 형식을 구성하세요 (예: [스코어닉스 AI분석] 팀A vs 팀B 데이터 기반 전력 검증).
2. **SEO 구조:** <h2>, <h3> 요소를 적절히 사용하여 글을 나누고, 스키머(Skimmer)들이 읽기 편하게 구성하세요.
3. **핵심 차단:** 결과에 대한 확실성, '도박', '베팅', '추천픽', '수익' 등의 단어는 절대 사용하지 마세요. 오직 '데이터 관점의 가치 분석' 위주로 서술해야 합니다.
4. **마지막 유도:** 본문 맨 하단에는 반드시 공식 웹사이트로 연결하는 Call to Action 링크를 HTML <a> 태그로 크게 넣으세요.
   - 링크 주소: 매치 상세 링크 파라미터를 그대로 사용하세요.
   - 예시: <a href="https://scorenix.com/ko/match/2026-03-21/team-a-vs-team-b?utm_source=blogger&utm_medium=auto_post" style="display:block; font-size:18px; font-weight:bold; color:blue; margin-top:20px;">👉 더 자세한 AI 예측 모델 리포트 보러가기 (스코어닉스 공식 웹사이트)</a>
5. **디자인 요건:** 화려한 CSS보다는 기본 HTML 구조 중심으로 모바일 가독성을 고려해 <ul>, <li>, <strong>, <blockquote> 태그를 적절히 사용하세요.
"""

async def generate_blogger_content(match_data: dict, match_url_path: str) -> Optional[dict]:
    """
    Generate an SEO-optimized HTML article for Google Blogger.
    Returns: {"title": str, "html": str}
    """
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = BLOGGER_SEO_PROMPT + "\n\n오늘의 분석 대상 경기:\n" + json.dumps(match_data, ensure_ascii=False, indent=2)
            prompt += f"\n\n매치 상세 링크 파라미터: https://scorenix.com/ko/match/{match_url_path}?utm_source=blogger&utm_medium=auto_post"
            
            response = _client.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```html"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            # Extract intuitive title (First h1)
            title = f"[Scorenix AI 분석] {match_data.get('team_home_ko', '')} vs {match_data.get('team_away_ko', '')} 데이터 브리핑"
            import re
            match = re.search(r'<h1>(.*?)</h1>', text, re.IGNORECASE)
            if match:
                # Strip HTML tags inside h1 if any
                inner_text = re.sub(r'<[^>]+>', '', match.group(1))
                title = inner_text.strip()
                
            return {"title": title, "html": text}

        except Exception as e:
            logger.error(f"Blogger content generation error: {e}")
            
    # Fallback if Gemini is blocked or fails
    return _generate_blogger_fallback(match_data, match_url_path)

def _generate_blogger_fallback(match_data: dict, match_url_path: str) -> dict:
    """Fallback HTML for Blogger when Gemini API fails."""
    home = match_data.get('team_home_ko', match_data.get('team_home', '홈팀'))
    away = match_data.get('team_away_ko', match_data.get('team_away', '원정팀'))
    
    title = f"[Scorenix 데이터 분석] {home} vs {away} 핵심 승률 및 배당 정보"
    
    url = f"https://scorenix.com/ko/match/{match_url_path}?utm_source=blogger&utm_medium=auto_post_fallback"
    
    html = f"""
    <h1>{title}</h1>
    <p>안녕하세요. 데이터 기반 스포츠 예측 플랫폼 <strong>Scorenix</strong>입니다.</p>
    <p>이번 경기는 <strong>{home}</strong>와(과) <strong>{away}</strong>의 치열한 데이터 접전이 예상됩니다. 
    해외 배당(Pinnacle)과 국내 배당(Betman)의 효율성을 분석한 결과, 흥미로운 배당 가치(Value)가 포착되었습니다.</p>
    
    <h2>📊 매치 데이터 개요</h2>
    <ul>
      <li><strong>홈팀:</strong> {home}</li>
      <li><strong>원정팀:</strong> {away}</li>
      <li><strong>분석 엔진:</strong> 7-Factor AI 알고리즘 적용 (해외/국내 데이터 교차 검증)</li>
    </ul>

    <h2>💡 진짜 가치 있는 선택은?</h2>
    <p>Scorenix의 기계학습 모델이 산출한 구체적인 승/무/패 예측 모델 확률과 배당 가치 기대값(EV) 비교를 확인해보세요! 
    배당 흐름의 미세한 변화를 포착하여 어느 쪽 배당이 더 유리한 위치에 있는지 확인하실 수 있습니다.</p>
    
    <div style="margin-top: 30px; text-align: center;">
      <a href="{url}" style="display:inline-block; padding: 15px 30px; background-color: #0E2954; color: white; font-size:18px; font-weight:bold; text-decoration: none; border-radius: 8px;">
        👉 {home} vs {away} AI 예측 상세 리포트 열람 (공식 홈페이지)
      </a>
    </div>
    """
    return {"title": title, "html": html}
