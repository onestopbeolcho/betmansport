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
        _client = genai.GenerativeModel("gemini-2.5-flash")
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
5. 📉 **가치 분석 (Value Check)**: 해외(Pinnacle) 대비 국내 기준 배당 효율성 및 투자 가치 판별.
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
    prompt = f"#### 1. 🤖 AI 다중 팩터 스코어보드 (홈팀 {home} 관점 유리도)\n"
    prompt += f"- **종합 기대 점수(Total Edge): {total_score}점** / 100점 (50점 이상이면 홈팀 유리, 50점 미만이면 원정팀 유리)\n"
    prompt += f"- [세부 팩터]: 전력 지수({details.get('power_rating', 50)}점), 최근 폼({details.get('form_momentum', 50)}점), 상대 전적({details.get('h2h_dominance', 50)}점), 부상/피로도({details.get('injury_fatigue', 50)}점), 감독 지수({details.get('coach_factor', 50)}점), 선수단 경기력({details.get('squad_quality', 50)}점), 배당 내재 확률({details.get('market_implied', 50)}점)\n\n"
    prompt += f"💡 지시사항: 위 스코어보드의 종합 점수와 세부 팩터의 불균형(예: 총점은 높으나 로스터 임팩트는 낮음 등)을 분석의 핵심 논거로 활용하세요.\n\n"

    # 2. Odds Data
    prompt += "#### 2. 배당 데이터 (Pinnacle)\n"
    prompt += f"- 승: {ho} / 무: {do} / 패: {ao}\n"
    
    bh = match_data.get("betman_home_odds") or (round(ho * 0.90, 2) if ho else None)
    bd = match_data.get("betman_draw_odds") or (round(do * 0.90, 2) if do else None)
    ba = match_data.get("betman_away_odds") or (round(ao * 0.90, 2) if ao else None)
    if bh and ba:
        prompt += f"- 국내 기준 배당: 승 {bh} / 무 {bd} / 패 {ba}\n"
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
# Phase 5-2: 다양한 SNS 콘텐츠 타입 확장 (적중 인증, 브랜드 교육, 오늘의 TOP 3)
# ═══════════════════════════════════════════════════

SNS_WINNING_PROOF_PROMPT = """당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어와 영어 혼용으로 트렌디하게 작성하세요.

역할:
- 최근 AI가 성공적으로 예측 적중(HIT)한 경기 데이터들을 유저들에게 보여주고, AI의 신뢰성을 어필하는 마케팅 게시물을 생성합니다.
- 단순 자랑이 아닌, "데이터가 증명한 결과"임을 강조하세요.

규칙 (매우 중요):
1. **적중 결과 정보 포함**: 제공된 경기 이름, AI 예측 추천 방향(recommendation), 최종 스코어를 본문에 자연스럽게 녹여내세요.
   (예: 어제 78% 확률로 예측한 A vs B 경기, 정확히 'A 승리' 적중! 스코어 3:1)
2. 280자 이내로 작성하세요 (X/Twitter 호환).
3. 이모지(🎉, ✅, 🤖, 📈 등)를 적극 활용하세요.
4. 해시태그 3-5개를 포함하세요 (#Scorenix #적중인증 #AI분석 등).
5. 본문 맨 마지막에는 항상 메인 홈페이지 링크를 첨부하세요:
   👉 적중률 검증하러 가기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_winning
   (인스타는 프로필 링크 확인!)
"""

SNS_EDUCATIONAL_PROMPT = """당신은 Scorenix의 SNS 마케팅 및 스포츠 데이터 교육 AI입니다. 한국어로 작성하세요.

역할:
- 스포츠 데이터 투자 관련 지식 중 하나를 선택해 일반인도 이해하기 쉽고 흥미로운 1줄 지식과 함께, Scorenix의 강점을 홍보하는 SNS 게시물을 생성합니다.

규칙 (매우 중요):
1. **제공된 주제**를 바탕으로 쉽고 통찰력 있는 스포츠 데이터 투자 관련 지식을 작성하세요.
2. 280자 이내로 콤팩트하게 작성하세요 (X/Twitter 호환).
3. 이모지를 활용해 가독성을 높이세요.
4. 해시태그 3-5개를 포함하세요 (#Scorenix #스포츠데이터 #가치투자 #배당분석).
5. 본문 끝에는 항상 메인 홈페이지 링크를 첨부하세요:
   👉 데이터 분석 시작하기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_edu
   (인스타는 프로필 링크 확인!)
"""

SNS_TOP_PICKS_PROMPT = """당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어로 트렌디하게 작성하세요.

역할:
- 오늘 밤/새벽 예정된 경기 중 AI 신뢰도(Confidence)가 가장 높은 상위 경기 리스트(최대 3개)를 받아, 오늘 놓치지 말아야 할 'AI 추천 매치 리스트'를 요약 소개합니다.

규칙 (매우 중요):
1. **호기심 유도 (스포일러 금지)**: 각 경기의 최종 추천 결과(누가 이길 것인가)는 **절대로 적지 마세요**. 대신 신뢰도 수치와 관전 포인트를 어필하세요.
   (나쁜 예: "A vs B 경기 A 승리 추천")
   (좋은 예: "🔥 A vs B: AI 신뢰도 82%! 역대급 전술적 상성 포착, 과연 결과는?")
2. 280자 이내로 콤팩트하게 작성하세요 (X/Twitter 호환).
3. 이모지(🔥, ⚽, 🚀 등)를 적극 활용하세요.
4. 해시태그 3-5개를 포함하세요 (#Scorenix #오늘의경기 #AI예측 #분석리스트).
5. 본문 맨 마지막에는 항상 메인 홈페이지 링크를 첨부하세요:
   👉 오늘 밤 AI 픽 전체보기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_top3
   (인스타는 프로필 링크 확인!)
"""

async def generate_winning_proof_sns(hits: list) -> Optional[str]:
    """최근 적중(HIT) 경기 데이터를 바탕으로 적중 인증 마케팅 콘텐츠 생성"""
    if not hits:
        return None
        
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = SNS_WINNING_PROOF_PROMPT + "\n\n최근 적중 경기 데이터:\n" + json.dumps(hits, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 신뢰성 높은 적중 인증 게시글을 작성하세요."
            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Winning proof SNS content generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Winning proof SNS generation error: {e}")
            
    # Fallback if Gemini fails
    hit = hits[0]
    home = hit.get("team_home", "홈팀")
    away = hit.get("team_away", "원정팀")
    rec = hit.get("recommendation", "HOME")
    h_score = hit.get("home_score", 0)
    a_score = hit.get("away_score", 0)
    return (
        f"🎉 [AI 적중 인증] {home} vs {away} 경기 예측 성공! ✅\\n\\n"
        f"AI가 예측한 포지션({rec})이 스코어 {h_score}:{a_score}로 정확히 맞아떨어졌습니다! 🤖📈\\n"
        f"감에 의존하는 투자가 아닌, 철저히 숫자로만 승부하는 AI 데이터 분석의 결과입니다.\\n\\n"
        f"👉 적중률 검증하기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_winning\\n"
        f"(인스타는 프로필 링크 확인!)\\n\\n"
        f"#Scorenix #적중인증 #스포츠데이터 #AI분석"
    )

async def generate_educational_sns(topic: Optional[str] = None) -> Optional[str]:
    """스포츠 데이터 투자 교육용 콘텐츠 생성"""
    topics = [
        "7-Factor AI 모델: 배당률 흐름, 최근 순위 및 폼, 전술 상성, 라인업 임팩트, 동기부여 등 7개 요소를 종합 분석하여 과학적인 승률을 도출합니다.",
        "기대값(Expected Value) 투자: 스포츠 분석에서 이기는 팀을 찍는 것은 초보입니다. 핵심은 '배당 대비 이길 확률'이 높아 기대 가치(EV)가 플러스인 포지션에 진입하는 것입니다.",
        "해외 배당 효율 분석: 세계 최고 수준인 Pinnacle의 배당 데이터와 국내 Betman 배당 효율을 실시간 교차 검증하여 해외보다 유리한 밸류 픽을 선별합니다.",
        "데이터 기반의 이성적 베팅: 응원하는 마음과 인간의 감정은 제외하세요. 감정 없는 기계학습 모델이 철저하게 승률을 역추적합니다."
    ]
    import random
    selected_topic = topic or random.choice(topics)
    
    if _init_gemini() and _client is not None:
        try:
            prompt = SNS_EDUCATIONAL_PROMPT + f"\n\n선택된 교육 주제:\n{selected_topic}"
            prompt += "\n\n위 주제를 바탕으로 초보자도 이해하기 쉬운 1줄 지식을 포함한 트렌디한 마케팅 글을 작성하세요."
            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Educational SNS content generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Educational SNS generation error: {e}")
            
    # Fallback
    return (
        f"💡 [스포츠 데이터 1분 지식] 🧠\\n\\n"
        f"{selected_topic}\\n\\n"
        f"Scorenix AI 분석 플랫폼에서는 매일 철저하게 가공된 기대값 데이터를 유저분들께 제공해 드립니다. 감으로 하는 투자는 이제 그만!\\n\\n"
        f"👉 데이터 확인하기: https://scorenix.com?utm_source=sns&utm_medium=auto_post_edu\\n"
        f"(인스타는 프로필 링크 확인!)\\n\\n"
        f"#Scorenix #스포츠데이터 #가치투자 #배당분석"
    )

async def generate_top_picks_sns(predictions: list) -> Optional[str]:
    """오늘 밤의 TOP 3 고신뢰 예측 리스트를 소개하는 종합 마케팅 콘텐츠 생성"""
    if not predictions:
        return None
        
    top_3 = sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True)[:3]
    
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = SNS_TOP_PICKS_PROMPT + "\n\n오늘의 상위 추천 경기 데이터:\n" + json.dumps(top_3, ensure_ascii=False, indent=2)
            prompt += "\n\n위 경기 목록을 바탕으로 호기심을 유발하는 종합 추천 매치 리스트를 작성하세요."
            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Top picks SNS content generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Top picks SNS generation error: {e}")
            
    # Fallback
    matches_text = ""
    for i, p in enumerate(top_3):
        home = p.get("team_home_ko") or p.get("team_home", "홈")
        away = p.get("team_away_ko") or p.get("team_away", "원정")
        conf = p.get("confidence", 0)
        league = p.get("league", "")
        matches_text += f"{i+1}. [{league}] {home} vs {away} (AI 신뢰도 {conf:.0f}%)\\n"
        
    return (
        f"🔥 [오늘의 AI 추천 경기 TOP 3] 🔥\\n\\n"
        f"오늘 밤 예정된 주요 매치 중 AI가 가장 강력하게 지목한 가치 분석 경기 목록입니다!\\n\\n"
        f"{matches_text}\\n"
        f"과연 이 경기들의 최종 승자는 누가 될까요? Scorenix AI 리포트에서 지금 바로 확인해 보세요!\\n\\n"
        f"👉 AI 픽 전체 확인: https://scorenix.com?utm_source=sns&utm_medium=auto_post_top3\\n"
        f"(인스타는 프로필 링크 확인!)\\n\\n"
        f"#Scorenix #스포츠분석 #AI예측 #오늘의경기"
    )

# ═══════════════════════════════════════════════════
# Phase 6: Blogger SEO 콘텐츠 자동 생성
# ═══════════════════════════════════════════════════

BLOGGER_SEO_PROMPT = """당신은 Scorenix의 최고급 SEO 마케팅 및 스포츠 칼럼니스트 AI입니다. 한국어로 작성하세요.

역할:
- 제공된 AI 매치 분석 JSON 데이터를 사용하여 구글 블로거(Blogger) 연동용 HTML 마케팅 게시글을 작성합니다.
- HTML 태그만 출력하세요. 마크다운 기호(```html) 등은 제외하고 순수 HTML 구조만 텍스트로 응답하세요.

규칙 (매우 중요):
1. **타이틀 최적화:** <h1> 태그에 검색 포털 노출에 유리한 키워드를 넣어 매혹적인 제목 형식을 구성하세요 (예: [스코어닉스 분석] 팀A vs 팀B 전력 비교 및 AI 승률 데이터 검증).
2. **SEO 및 분량 최적화:** 구글 검색 노출(SEO)을 위해 반드시 글의 분량을 1,500자 이상으로 매우 길고 상세하게 작성하세요. 내용이 빈약하면 안 됩니다.
3. **풍부한 경기 정보 제공:** 제공된 데이터를 바탕으로 아래 내용을 반드시 상세히 서술하여 유저 체류 시간을 늘리세요:
   - 양 팀의 최근 흐름 및 전력 비교 (상세히)
   - 주요 관전 포인트 (예상 라인업, 결장자, 혹은 전술적 특징 등 데이터 기반 서술)
   - 배당률 추이나 AI가 바라보는 데이터 상의 특이점 (수치적 접근)
4. **구조화:** <h2>, <h3> 요소를 적절히 사용하여 단락을 확실히 나누고, 스키머(Skimmer)들이 읽기 편하도록 <ul>, <li>, <strong>, <blockquote> 태그를 적극 활용하세요.
5. **핵심 차단:** 결과에 대한 확실성, '도박', '베팅', '추천픽', '수익' 등의 단어는 절대 사용하지 마세요. 오직 '데이터 관점의 가치 분석' 위주로 서술해야 합니다.
6. **마지막 유도 (3단 연동 링크):** 본문 맨 하단에는 반드시 공식 웹사이트, 인스타그램, 유튜브로 연결하는 Call to Action 링크들을 아래 HTML 태그 구조로 정확히 넣으세요.
   - 스코어닉스 공식 웹사이트: 제공된 매치 상세 링크 파라미터를 사용하세요.
   - 스코어닉스 인스타그램 공식 계정: https://www.instagram.com/scorenix_official/
   - 스코어닉스 유튜브 공식 채널: https://www.youtube.com/@scorenix
   - 템플릿:
     <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
       <h3 style="margin-top: 0; color: #111;">🔍 더 깊은 AI 분석 결과가 궁금하다면?</h3>
       <p style="color: #555; margin-bottom: 20px;">스코어닉스 공식 플랫폼에서 AI의 구체적인 확률 예측과 가치 투자의 방향을 확인하세요!</p>
       <a href="https://scorenix.com/ko/match/2026-03-21/team-a-vs-team-b?utm_source=blogger" style="display:inline-block; margin: 8px; padding: 14px 28px; background-color: #0E2954; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; transition: 0.3s;">👉 AI 예측 상세 리포트 보러가기 (공식 웹사이트)</a>
       <br/>
       <a href="https://www.instagram.com/scorenix_official/" style="display:inline-block; margin: 8px; padding: 12px 24px; background-color: #E1306C; color: white; font-weight:bold; text-decoration: none; border-radius: 8px;">📸 공식 인스타그램</a>
       <a href="https://www.youtube.com/@scorenix" style="display:inline-block; margin: 8px; padding: 12px 24px; background-color: #FF0000; color: white; font-weight:bold; text-decoration: none; border-radius: 8px;">🎬 공식 유튜브</a>
     </div>
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
    
    <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 12px; text-align: center;">
      <h3 style="margin-top: 0; color: #333;">📢 스코어닉스 공식 채널 연동</h3>
      <a href="{url}" style="display:inline-block; margin: 5px; padding: 12px 24px; background-color: #0E2954; color: white; font-weight:bold; text-decoration: none; border-radius: 8px;">👉 AI 예측 상세 리포트 보러가기 (공식 웹사이트)</a>
      <a href="https://www.instagram.com/scorenix_official/" style="display:inline-block; margin: 5px; padding: 12px 24px; background-color: #E1306C; color: white; font-weight:bold; text-decoration: none; border-radius: 8px;">📸 공식 인스타그램 팔로우</a>
      <a href="https://www.youtube.com/@scorenix" style="display:inline-block; margin: 5px; padding: 12px 24px; background-color: #FF0000; color: white; font-weight:bold; text-decoration: none; border-radius: 8px;">🎬 공식 유튜브 채널 구독</a>
    </div>
    """
    return {"title": title, "html": html}


def translate_text(text: str, target_lang: str) -> str:
    """Gemini 1.5 Flash를 사용하여 텍스트를 고품질 번역합니다. 실패 시 원본 반환."""
    if not _init_gemini():
        logger.warning("Gemini not initialized for translation. Returning original text.")
        return text

    target_names = {
        "en": "English (Sports betting prediction analyst tone)",
        "ja": "Japanese (Sports tipping / prediction tone)",
        "ko": "Korean (Sports analyst tone)"
    }
    target_name = target_names.get(target_lang, target_lang)

    prompt = (
        f"Translate the following text to {target_name}. "
        f"Keep the original structure, line breaks, team names, numbers, and professional tone. "
        f"Return ONLY the translated text, without any explanations or headers.\n\n"
        f"Text:\n{text}"
    )

    try:
        response = _client.generate_content(prompt)
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini translation error to {target_lang}: {e}")
    return text


def generate_video_script_korean(matches: list, mode: str = "membership") -> list:
    """
    Gemini 2.5 Flash를 활용해 숏츠 영상용 앵커 대본(나레이션) 및 자막 목록을 실시간 작문(Generate)합니다.
    JSON 형식의 리스트를 반환합니다.
    """
    if not _init_gemini():
        logger.warning("Gemini not initialized. Cannot generate generative script.")
        return []

    # matches를 보기 쉽게 정리
    matches_summary = ""
    for idx, m in enumerate(matches):
        home = m.get("home") or m.get("team_home", "홈팀")
        away = m.get("away") or m.get("team_away", "원정팀")
        pick = m.get("ai_pick") or m.get("recommendation", "HOME")
        pick_ko = "홈팀 승리" if pick == "HOME" else "원정팀 승리" if pick == "AWAY" else "무승부"
        win_prob = m.get("win_prob") or m.get("confidence", 50)
        h_odds = m.get("home_odds", 1.5)
        a_odds = m.get("away_odds", 3.0)
        d_odds = m.get("draw_odds", 3.5)
        reason = m.get("reason", "")
        matches_summary += f"[{idx+1}번째 경기] {home} vs {away} / AI 픽: {pick_ko} (확률 {win_prob}%) / 배당(홈/무/원정): {h_odds} | {d_odds} | {a_odds} / 분석 데이터: {reason}\n"

    # 모드에 따른 프롬프트 차별화
    mode_instructions = {
        "membership": "구독자(멤버십)용 영상 대본입니다. 3개 경기 모두 명확한 분석 근거와 승리 예상 픽을 숨김없이 공개하고, 통계적인 수치를 강조해 전문성을 보장하세요.",
        "marketing": "마케팅(유입)용 영상 대본입니다. 첫 번째 경기는 정밀 분석과 픽을 시원하게 오픈하되, 두 번째와 세 번째 경기는 분석 정보가 있음을 알리며 '더 자세한 픽과 오늘 밤 고신뢰 매치는 프로필 링크의 스코어닉스 닷컴에서 확인하세요'라며 영리하게 홈페이지 가입/방문을 유도하세요.",
        "winning": "적중 인증(자랑)용 영상 대본입니다. 어제 AI 예측이 성공한 결과(matches에 채점된 경기 기록)를 격정적이고 신뢰감 있게 자랑하며, 감정에 속지 않는 통계 투자의 중요성을 강하게 어필하세요.",
        "educational": "가치 투자 교육용 영상 대본입니다. 감으로 베팅하는 토토의 폐해를 꼬집고, 배당 가치(EV) 및 7-Factor AI 수학적 확률에 기반한 기계적 투자의 법칙을 일반인도 이해하기 쉽게 논리적으로 연설하세요.",
        "top_picks": "오늘의 고신뢰 경기 TOP 3를 요약해서 매끄럽게 전달하는 브리핑 영상 대본입니다. 각 매치의 핵심 포인트와 승리 확률을 요약하며, 사이트 방문을 유도하세요."
    }
    instruction = mode_instructions.get(mode, mode_instructions["membership"])

    prompt = (
        f"당신은 스포츠 데이터 투자 플랫폼 '스코어닉스(Scorenix)'의 최고 수석 스포츠 분석 아나운서입니다.\n"
        f"제공된 경기 데이터를 활용해 숏츠 영상용 나레이션 대본(tts)과 화면에 띄울 자막 카드 문구(caption)를 작성해 주세요.\n\n"
        f"--- 경기 데이터 ---\n"
        f"{matches_summary}\n"
        f"--- 영상 유형 지침 ---\n"
        f"{instruction}\n\n"
        f"--- 작성 규칙 (필수) ---\n"
        f"1. 대본은 장면(scene) 총 4개(인트로, 경기 1, 경기 2, CTA/아웃트로)로 컴팩트하게 구성되어야 합니다. (유튜브 쇼츠 규격인 60초 미만을 완벽히 준수해야 하므로, 각 장면의 'tts'는 성우가 9초 이내에 다 읽을 수 있도록 **반드시 공백 포함 40자 이내**의 한 문장이어야 합니다. 절대 40자를 초과하지 마세요!)\n"
        f"2. 반환 형식은 반드시 JSON 배열이어야 합니다. 마크다운 기호 없이 순수한 JSON 텍스트만 출력하세요. 배열 내부 객체 스키마는 아래와 같아야 합니다:\n"
        f"   [\n"
        f"     {{\"tts\": \"성우가 읽을 멘트. 부드럽고 자연스럽게 구어체로 작성.\", \"caption\": \"화면에 표시될 짧은 요약 자막. 2~3줄 권장. 줄바꿈(\\n) 사용 가능.\", \"scene\": \"intro 또는 match 또는 cta\"}},\n"
        f"     ...\n"
        f"   ]\n"
        f"3. 앵커 멘트(tts)는 오디오 파일로 바로 읽기 때문에 특수문자나 복잡한 표기법 대신 자연스러운 말소리로 쓰세요. (예: '7-Factor' -> '세븐 팩터', '78.5%' -> '78.5 퍼센트' 등)\n"
        f"4. 화면 자막(caption)은 시인성을 높이기 위해 한 줄에 최대 10자 이내가 되도록 줄바꿈(\\n)을 적절히 섞어주세요.\n"
        f"5. JSON 형식을 엄격히 지켜 오류 없이 파싱 가능하게 하세요."
    )

    try:
        response = _client.generate_content(prompt)
        if response and response.text:
            text = response.text.strip()
            # JSON만 추출하기 위한 안전 장치
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            import json
            parsed = json.loads(text)
            if isinstance(parsed, list) and len(parsed) >= 3:
                logger.info(f"✅ Generative script generated via Gemini (mode: {mode}, scenes: {len(parsed)})")
                return parsed
    except Exception as e:
        logger.error(f"❌ Gemini generate_video_script error (mode={mode}): {e}")
    
    # 실패 시 빈 배열 반환하여 폴백 호출하도록 함
    return []

