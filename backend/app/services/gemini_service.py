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
# Phase 5: SNS 마케팅 콘텐츠 자동 생성 (PG 규정 준수 & 월 3,900원 퍼널)
# ═══════════════════════════════════════════════════

SNS_MARKETING_PROMPT = """당신은 Scorenix(스코어닉스)의 최고 수석 SNS 스포츠 데이터 분석관입니다. 한국어로 정확하고 명확하게 작성하세요.

역할:
- AI 경기 시뮬레이션 데이터(날짜, 리그, 팀명, 시뮬레이션 우세팀, AI 신뢰도/승률, 7-Factor 핵심 산출 근거)를 받아 쓰레드(Threads) 및 인스타그램 유저들이 신뢰할 수 있는 데이터 브리핑 글을 생성합니다.

규칙 (필수 준수 - 6대 핵심 요소 포함):
1. **[금칙어 절대 사용 금지]**: '픽(Pick)', '유료 픽', '베팅', '배팅', '토토', '적중 보장' 단어를 절대 사용하지 마세요. 대신 '시뮬레이션 우세 지표', '데이터 리포트', '기대값(+EV)', '포아송 기대득점(xG)'을 사용하세요.
2. **[정확한 경기 날짜 & 시각]**: `📅 일시: [경기 날짜 및 시간]` 형태 포함.
3. **[정확한 팀명 및 리그]**: `📍 [리그명] [홈팀] vs [원정팀]` 명시.
4. **[명확한 시뮬레이션 우세 지표 & 수치]**: `📊 AI 시뮬레이션 우세: [우세팀] (머신러닝 신뢰도 [신뢰도]%)` 명시.
5. **[AI 산출 근거 2~3가지]**: 주어지는 `factors_summary` 데이터 기반으로 `💡 3-Pillar 퀀트 산출 근거:` 항목을 Bullet Point(•)로 2개 이상 명확히 요약 작성하세요.
6. **[월 3,900원 멤버십 안내 & 공식 채널 상호 링크 (필수 포함)]**:
   ☕ 전 경기 +EV 밸류 리포트 무제한 열람: 월 3,900원 (커피 한 잔 값)
   🔗 공식 채널
   🌐 AI리포트: https://scorenix.com/ko/match/[제공된 url_path]?utm_source=sns&utm_medium=auto_post
   🎬 유튜브: https://www.youtube.com/@스코어닉스
   📸 인스타: https://www.instagram.com/scorenix_official/
   🧵 쓰레드: https://www.threads.com/@scorenix_official
   ✍️ 블로그: https://official-scorenix.blogspot.com

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

    # 고신뢰 순 정렬 → Top 5
    sorted_preds = sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True)
    top_picks = sorted_preds[:5]

    if _init_gemini() and _client is not None:
        try:
            import json
            match_summaries = []
            for p in top_picks:
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
                
                rec = p.get("recommendation", "HOME")
                rec_ko = p.get("team_home_ko", p.get("team_home", "홈팀")) if rec == "HOME" else (p.get("team_away_ko", p.get("team_away", "원정팀")) if rec == "AWAY" else "무승부")

                match_summaries.append({
                    "match_id": match_id,
                    "date": date_param,
                    "url_path": f"{date_param}/{slug}",
                    "league": p.get("league", "축구"),
                    "home_team": p.get("team_home_ko", p.get("team_home", "")),
                    "away_team": p.get("team_away_ko", p.get("team_away", "")),
                    "ai_favored": rec_ko,
                    "confidence": p.get("confidence", 0),
                    "home_prob": p.get("home_win_prob", 0),
                    "draw_prob": p.get("draw_prob", 0),
                    "away_prob": p.get("away_win_prob", 0),
                    "factors_summary": [f.get("name", "") for f in p.get("factors", [])[:3]],
                })

            prompt = SNS_MARKETING_PROMPT + "\n\n오늘의 AI 시뮬레이션 경기 데이터:\n" + json.dumps(match_summaries, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 각 경기별 SNS 게시물을 작성하세요."

            response = _client.generate_content(prompt)
            text = response.text.strip()

            if text:
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

    return _generate_sns_fallback(top_picks)


def _generate_sns_fallback(predictions: list) -> list:
    """Gemini 없을 때 템플릿 기반 SNS 콘텐츠"""
    results = []
    for p in predictions:
        home = p.get("team_home_ko", p.get("team_home", "홈"))
        away = p.get("team_away_ko", p.get("team_away", "원정"))
        conf = p.get("confidence", 0)
        league = p.get("league", "축구")
        match_id = p.get("match_id", "")
        rec = p.get("recommendation", "HOME")
        rec_ko = f"{home} 우세" if rec == "HOME" else (f"{away} 우세" if rec == "AWAY" else "무승부 경향")

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

        factors = p.get("factors", [])
        factor_lines = ""
        if factors:
            for f in factors[:2]:
                fname = f.get("name", "")
                if fname:
                    factor_lines += f"• {fname}\n"
        if not factor_lines:
            factor_lines = "• 7-Factor 머신러닝 시뮬레이션 +EV 기대값 포착\n• 글로벌 표준 시장 확률 대비 배당률 왜곡 검증 완료\n"

        fire = "📈🔥" if conf >= 70 else "📊" if conf >= 55 else "⚡"

        text = (
            f"{fire} [{league}] AI 퀀트 데이터 분석 리포트\n"
            f"📅 일시: {date_param}\n"
            f"📍 매치: {home} vs {away}\n\n"
            f"📊 AI 시뮬레이션 우세: {rec_ko} (신뢰도 {conf:.0f}%)\n\n"
            f"💡 3-Pillar 퀀트 산출 근거:\n"
            f"{factor_lines}\n"
            f"☕ 전 경기 +EV 리포트 무제한 열람: 월 3,900원 (커피 한 잔 값)\n"
            f"🔗 공식 채널\n"
            f"🌐 AI리포트: https://scorenix.com/ko/match/{date_param}/{slug}?utm_source=sns&utm_medium=auto_post\n"
            f"🎬 유튜브: https://www.youtube.com/@스코어닉스\n"
            f"📸 인스타: https://www.instagram.com/scorenix_official/\n"
            f"🧵 쓰레드: https://www.threads.com/@scorenix_official\n"
            f"✍️ 블로그: https://official-scorenix.blogspot.com\n\n"
            f"#Scorenix #스포츠데이터 #AI시뮬레이션 #{league.replace(' ', '')}"
        )
        results.append({
            "match_id": match_id,
            "text": text,
            "confidence": conf,
            "league": league,
        })
    return results

SNS_GENERIC_MARKETING_PROMPT = """당신은 Scorenix(스코어닉스)의 SNS 마케팅 전문 AI입니다. 한국어로 작성하세요.

역할:
- 오늘 당장 분석할 경기가 없더라도, 사용자가 Scorenix(스코어닉스) 웹사이트 및 공식 채널들을 방문하고 싶게 만드는 스포츠 퀀트 SaaS 마케팅 게시물을 생성하세요.

규칙:
1. '픽', '베팅', '토토' 같은 단어는 절대 사용하지 마세요. 대신 '머신러닝 시뮬레이션 확률', '포아송 기대득점(xG)', '기대값(+EV) 리포트'를 사용하세요.
2. '커피 한 잔 값(월 3,900원)으로 전 세계 17개 리그 +EV 데이터 리포트 무제한 열람' 및 '매일 1경기 무료 AI 샘플 리포트 공개'를 강조하세요.
3. 본문은 240자 이내로 눈에 띄게 작성하세요.
4. 본문 끝에는 반드시 공식 채널 상호 링크를 모두 첨부하세요:
   🔗 공식 채널
   🌐 AI리포트: https://scorenix.com/ko/analysis
   🎬 유튜브: https://www.youtube.com/@스코어닉스
   📸 인스타: https://www.instagram.com/scorenix_official/
   🧵 쓰레드: https://www.threads.com/@scorenix_official
   ✍️ 블로그: https://official-scorenix.blogspot.com
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
                return f"{text}\n\n[Ref: {stamp}]"
        except Exception as e:
            logger.error(f"Generic SNS promo generation error: {e}")
            
    return (
        "📊 스포츠 데이터 인텔리전스의 새로운 기준, Scorenix! 🤖\n\n"
        "직관에 의존하는 분석은 그만. 포아송 기대득점(xG)과 3-Pillar 머신러닝 시뮬레이션으로 매일 +EV 기대값 리포트를 제공합니다.\n"
        "☕ 커피 한 잔 값(월 3,900원)으로 17개 리그 전 경기 리포트를 무제한 열람하세요!\n\n"
        "🔗 공식 채널\n"
        "🌐 AI리포트: https://scorenix.com/ko/analysis\n"
        "🎬 유튜브: https://www.youtube.com/@스코어닉스\n"
        "📸 인스타: https://www.instagram.com/scorenix_official/\n"
        "🧵 쓰레드: https://www.threads.com/@scorenix_official\n"
        "✍️ 블로그: https://official-scorenix.blogspot.com\n\n"
        f"#Scorenix #스포츠데이터 #퀀트분석 #AI시뮬레이션 [Ref: {stamp}]"
    )

SNS_WINNING_PROOF_PROMPT = """당신은 Scorenix의 최고 수석 SNS 데이터 검증 분석관입니다. 한국어로 작성하세요.

역할:
- 최근 AI 시뮬레이션 모델이 예측에 성공(백테스트 검증 일치)한 경기 데이터를 유저들에게 투명하게 공개하는 브리핑 게시물을 생성합니다.

규칙 (필수 준수):
1. **[금칙어 금지]**: '추천 픽', '베팅', '토토'라는 표현 대신 'AI 시뮬레이션 우세 지표', '백테스트 검증 완료'를 사용하세요.
2. **[경기 정보 & 날짜]**: `📅 경기 날짜: [날짜]` 및 `📍 [리그명] [홈팀] vs [원정팀]` 명시.
3. **[시뮬레이션 지표 & 최종 스코어]**: `📊 AI 시뮬레이션 우세: [우세팀] (신뢰도 [신뢰도]%)` ➔ `⚽ 최종 스코어: [홈스코어] : [원정스코어] 시뮬레이션 검증 일치! ✅` 명시.
4. **[데이터 검증 근거]**: 2줄 이내로 핵심 요약 및 `☕ 월 3,900원 Basic Pass` 안내 포함.
5. **[공식 채널 상호 링크 (필수 포함)]**:
   🔗 공식 채널
   🌐 AI리포트: https://scorenix.com/ko/analysis
   🎬 유튜브: https://www.youtube.com/@스코어닉스
   📸 인스타: https://www.instagram.com/scorenix_official/
   🧵 쓰레드: https://www.threads.com/@scorenix_official
   ✍️ 블로그: https://official-scorenix.blogspot.com
"""

SNS_EDUCATIONAL_PROMPT = """당신은 Scorenix의 스포츠 퀀트 교육 전문 AI입니다. 한국어로 알기 쉽게 작성하세요.

규칙:
1. '베팅', '토토', '픽' 단어를 사용하지 말고 '스포츠 통계 시뮬레이션', '기대값(+EV)', '포아송 분포(xG)' 용어를 사용하세요.
2. 본문은 240자 이내로 작성하고, 월 3,900원(커피 한 잔 값) 데이터 멤버십 안내와 공식 채널 링크를 하단에 포함하세요.
"""

SNS_TOP_PICKS_PROMPT = """당신은 Scorenix의 SNS 마케팅 전문 AI입니다. 한국어로 트렌디하게 작성하세요.

역할:
- 오늘의 '무료 공개 AI 시뮬레이션 샘플 1경기'의 핵심 수치(승률 및 우세 방향)를 시원하게 공개하여 데이터 분석력을 증명하고,
- 가장 기대값(+EV)이 높은 '📊 오늘의 AI 핵심 밸류 리포트 상위 3경기'는 대진(팀명)과 신뢰도만 공개한 뒤 상세 리포트는 스코어닉스 본진(월 3,900원 커피 한 잔 값 멤버십)에서 확인하도록 유도합니다.

규칙 (매우 중요):
1. **[금칙어 절대 금지]**: '픽(Pick)', 'TOP PICK', '베팅', '토토' 단어를 절대 쓰지 마세요. 대신 '+EV 핵심 밸류 리포트', '시뮬레이션 우세 지표'라고 표기하세요.
2. **[🎁 오늘의 무료 AI 시뮬레이션 샘플 1건 공개]**: 제공된 샘플 경기 1건은 AI 시뮬레이션 우세 팀과 확률(%)을 명확히 공개하세요.
3. **[🔒 오늘의 +EV 핵심 밸류 리포트 3경기 티저]**: 상위 3경기는 대진과 AI 신뢰도(%)만 공개하고 최종 방향은 '[🔒 Basic Pass 전용 (월 3,900원)]'으로 표시해 클릭을 유도하세요.
4. 본문은 260자 이내로 콤팩트하게 작성하세요.
5. 본문 끝에는 반드시 공식 채널 상호 링크를 첨부하세요:
   🔗 공식 채널
   🌐 AI리포트: https://scorenix.com/ko/analysis
   🎬 유튜브: https://www.youtube.com/@스코어닉스
   📸 인스타: https://www.instagram.com/scorenix_official/
   🧵 쓰레드: https://www.threads.com/@scorenix_official
   ✍️ 블로그: https://official-scorenix.blogspot.com
"""

async def generate_winning_proof_sns(hits: list) -> Optional[str]:
    """최근 시뮬레이션 검증 일치(HIT) 경기 데이터를 바탕으로 검증 브리핑 SNS 생성"""
    if not hits:
        return None
        
    if _init_gemini() and _client is not None:
        try:
            import json
            prompt = SNS_WINNING_PROOF_PROMPT + "\n\n최근 시뮬레이션 검증 일치 경기 데이터:\n" + json.dumps(hits, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 신뢰성 높은 백테스트 검증 게시글을 작성하세요."
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
        f"✅ [AI 백테스트 검증 완료] {home} vs {away} 시뮬레이션 결과 일치!\n\n"
        f"3-Pillar 퀀트 엔진이 산출한 우세 지표({rec})가 최종 스코어 {h_score}:{a_score}로 정확히 검증되었습니다! 🤖📈\n"
        f"☕ 커피 한 잔 값(월 3,900원)으로 매일 전 경기 +EV 데이터 리포트를 확인하세요.\n\n"
        f"🔗 공식 채널\n"
        f"🌐 AI리포트: https://scorenix.com/ko/analysis\n"
        f"🎬 유튜브: https://www.youtube.com/@스코어닉스\n"
        f"📸 인스타: https://www.instagram.com/scorenix_official/\n"
        f"🧵 쓰레드: https://www.threads.com/@scorenix_official\n"
        f"✍️ 블로그: https://official-scorenix.blogspot.com\n\n"
        f"#Scorenix #백테스트검증 #스포츠데이터 #AI시뮬레이션"
    )

async def generate_educational_sns(topic: Optional[str] = None) -> Optional[str]:
    """스포츠 데이터 퀀트 분석 교육용 콘텐츠 생성"""
    topics = [
        "3-Pillar 하이브리드 퀀트 엔진: ① 글로벌 시장 마진 제거(Power De-vig) 45% + ② 포아송 기대득점(xG)/피타고라스 기대승률 30% + ③ 7대 전술·폼 팩터 25%를 결합해 순수 확률을 도출합니다.",
        "기대값(Expected Value) 분석: 단순히 강팀을 고르는 것은 통계적 착시입니다. 핵심은 '시장 내재 확률 대비 머신러닝 시뮬레이션 확률'이 높은 플러스 기대값(+EV) 구간을 포착하는 것입니다.",
        "켈리 공식(Kelly Criterion) 비중 시뮬레이션: 확률 우위만큼 중요한 것이 리스크 분산입니다. Scorenix는 기대값과 변동성에 맞춰 경기별 최적 데이터 가중치(%)를 수학적으로 계산합니다.",
        "데이터 기반의 객관적 관전: 응원하는 마음과 인간의 확증편향은 배제하세요. 8,960경기로 백테스트 검증된 퀀트 모델이 객관적인 통계 지표만 제시합니다."
    ]
    import random
    selected_topic = topic or random.choice(topics)
    
    if _init_gemini() and _client is not None:
        try:
            prompt = SNS_EDUCATIONAL_PROMPT + f"\n\n선택된 교육 주제:\n{selected_topic}"
            prompt += "\n\n위 주제를 바탕으로 초보자도 이해하기 쉬운 1줄 지식을 포함한 트렌디한 데이터 브리핑 글을 작성하세요."
            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Educational SNS content generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Educational SNS generation error: {e}")
            
    # Fallback
    return (
        f"💡 [스포츠 퀀트 1분 인사이트] 🧠\n\n"
        f"{selected_topic}\n\n"
        f"☕ 월 3,900원(커피 한 잔 값)으로 전 경기 +EV 데이터 리포트 열람하기\n"
        f"🔗 공식 채널\n"
        f"🌐 AI리포트: https://scorenix.com/ko/analysis\n"
        f"🎬 유튜브: https://www.youtube.com/@스코어닉스\n"
        f"📸 인스타: https://www.instagram.com/scorenix_official/\n"
        f"🧵 쓰레드: https://www.threads.com/@scorenix_official\n"
        f"✍️ 블로그: https://official-scorenix.blogspot.com\n\n"
        f"#Scorenix #스포츠데이터 #퀀트분석 #포아송분포"
    )

async def generate_top_picks_sns(predictions: list) -> Optional[str]:
    """오늘 밤의 무료 샘플 1건 오픈 + 상위 3경기 +EV 밸류 리포트 티저 생성"""
    if not predictions:
        return None
        
    sorted_preds = sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True)
    top_3 = sorted_preds[:3]
    free_sample = sorted_preds[3] if len(sorted_preds) > 3 else sorted_preds[0]
    
    if _init_gemini() and _client is not None:
        try:
            import json
            payload = {
                "free_sample_match": free_sample,
                "locked_top_3_matches": top_3,
            }
            prompt = SNS_TOP_PICKS_PROMPT + "\n\n오늘의 경기 데이터:\n" + json.dumps(payload, ensure_ascii=False, indent=2)
            prompt += "\n\n위 데이터를 바탕으로 무료 샘플 1건은 시뮬레이션 지표를 공개하고, 상위 3경기는 호기심을 유발하는 게시글을 작성하세요."
            response = _client.generate_content(prompt)
            text = response.text.strip()
            if text:
                logger.info(f"✅ Top value reports SNS content generated ({len(text)} chars)")
                return text
        except Exception as e:
            logger.error(f"Top value reports SNS generation error: {e}")
            
    # Fallback
    s_home = free_sample.get("team_home_ko") or free_sample.get("team_home", "홈")
    s_away = free_sample.get("team_away_ko") or free_sample.get("team_away", "원정")
    s_rec = free_sample.get("recommendation", "HOME")
    s_rec_ko = f"{s_home} 우세" if s_rec == "HOME" else (f"{s_away} 우세" if s_rec == "AWAY" else "무승부 경향")
    s_conf = free_sample.get("confidence", 62)

    matches_text = ""
    for i, p in enumerate(top_3):
        home = p.get("team_home_ko") or p.get("team_home", "홈")
        away = p.get("team_away_ko") or p.get("team_away", "원정")
        conf = p.get("confidence", 0)
        league = p.get("league", "")
        matches_text += f"📊 #{i+1} +EV. [{league}] {home} vs {away} (신뢰도 {conf:.0f}% · 🔒Basic Pass)\n"
        
    return (
        f"🎁 [오늘의 무료 AI 시뮬레이션 샘플 공개]\n"
        f"⚽ {s_home} vs {s_away} → 시뮬레이션 지표: [{s_rec_ko}] (신뢰도 {s_conf:.0f}%)\n\n"
        f"📈 [오늘 밤 AI 핵심 밸류 리포트 (+EV 상위 3경기)]\n"
        f"{matches_text}\n"
        f"☕ 커피 한 잔 값(월 3,900원)으로 전체 리포트 즉시 열람!\n"
        f"🔗 공식 채널\n"
        f"🌐 AI리포트: https://scorenix.com/ko/analysis\n"
        f"🎬 유튜브: https://www.youtube.com/@스코어닉스\n"
        f"📸 인스타: https://www.instagram.com/scorenix_official/\n"
        f"🧵 쓰레드: https://www.threads.com/@scorenix_official\n"
        f"✍️ 블로그: https://official-scorenix.blogspot.com\n\n"
        f"#Scorenix #스포츠데이터 #AI시뮬레이션 #기대값분석"
    )

# ═══════════════════════════════════════════════════
# Phase 6: Blogger / WordPress SEO 콘텐츠 자동 생성 (PG 규정 준수)
# ═══════════════════════════════════════════════════

BLOGGER_SEO_PROMPT = """당신은 Scorenix(스코어닉스)의 수석 스포츠 퀀트 칼럼니스트이자 SEO 전문 AI입니다. 한국어로 작성하세요.

역할:
- 제공된 3-Pillar AI 매치 시뮬레이션 JSON 데이터를 사용하여 구글 블로거(Blogger) 및 검색 상위 노출용 HTML 데이터 분석 칼럼을 작성합니다.
- HTML 태그만 출력하세요. 마크다운 기호(```html) 등은 제외하고 순수 HTML 구조만 텍스트로 응답하세요.

규칙 (매우 중요):
1. **타이틀 최적화:** <h1> 태그에 검색 포털(구글/네이버) 노출에 유리한 키워드를 넣어 작성하세요 (예: [2026년 10월 20일] 맨체스터 시티 vs 아스널 포아송 기대득점(xG) 및 3-Pillar AI 승률 시뮬레이션 리포트).
2. **SEO 및 분량 최적화:** 검색엔진 상위 노출을 위해 반드시 분량을 1,500자 이상으로 상세하게 작성하세요.
3. **3-Pillar 퀀트 데이터 중심 서술:**
   - **Pillar 1 (글로벌 표준 시장 마진 제거 내재 확률):** 글로벌 시장 확률 흐름과 마진을 제거한(Power De-vig) 순수 내재 확률 비교
   - **Pillar 2 (포아송 기대득점 xG / 피타고라스 기대승률):** 양 팀의 공수 효율 및 기대득실 시뮬레이션 해설
   - **Pillar 3 (7대 핵심 팩터 교차 검증):** 리그 순위, 최근 5경기 흐름(W/D/L), 홈 구장 어드밴티지 등 세부 지표 분석
4. **전환 퍼널(Teaser & Micro-Subscription Hook):**
   - 이 경기의 기초 전력과 팩터 데이터는 상세히 설명하되, **"오늘 가장 기대값(+EV)이 높은 📊 AI 핵심 밸류 리포트 상위 3경기와 켈리 공식(Kelly Criterion) 비중 시뮬레이터는 스코어닉스 공식 플랫폼(커피 한 잔 값 월 3,900원 Basic Pass)에서 확인할 수 있습니다"**라는 안내를 자연스럽게 포함하세요.
   - 또한 **"스코어닉스에서는 매일 1경기의 7대 핵심 팩터 AI 리포트를 100% 무료 샘플로 공개하고 있습니다"**라고 강조하여 방문을 유도하세요.
5. **엄격한 용어 준수 (PG 심사 규정):** '도박', '베팅', '배팅', '픽(Pick)', 'TOP PICK', '토토', '적중 보장'이라는 단어는 절대 사용하지 말고 '머신러닝 시뮬레이션 확률', '데이터 분석 리포트', '기대값(+EV)', '포아송 득점 기대치(xG)', '배당률 왜곡 감지'라는 전문 용어를 사용하세요.
6. **하단 CTA 박스 & 법적 면책 조항 (필수 포함 — SEO 백링크 강화):** 본문 맨 하단에는 아래 HTML 구조로 공식 웹사이트 및 공식 SNS 채널로 연결되는 버튼과 면책 조항을 모두 넣으세요:
     <div style="margin-top: 40px; padding: 28px; background: linear-gradient(135deg, #0b1120, #1e293b); border: 1px solid #334155; border-radius: 16px; text-align: center; color: #f8fafc;">
       <div style="display:inline-block; padding: 4px 12px; background: rgba(16,185,129,0.2); color: #34d399; border-radius: 999px; font-size: 12px; font-weight: bold; margin-bottom: 10px;">☕ 커피 한 잔 값(월 3,900원) · 일일 무료 샘플 1건 공개 중</div>
       <h3 style="margin-top: 0; color: #ffffff; font-size: 20px;">📊 오늘 밤 AI 신뢰도 80%+ '+EV 핵심 밸류 리포트 3경기'가 궁금하다면?</h3>
       <p style="color: #94a3b8; font-size: 14px; margin-bottom: 22px;">8,960경기를 백테스트 검증한 3-Pillar 하이브리드 퀀트 엔진의 실시간 승률 시뮬레이션과 켈리 비중 계산기를 지금 바로 확인하세요.</p>
       <a href="https://scorenix.com/ko/analysis?utm_source=blogger&utm_medium=cta_analysis" style="display:inline-block; margin: 6px; padding: 14px 28px; background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: white; font-weight:bold; text-decoration: none; border-radius: 10px;">👉 무료 AI 샘플 & +EV 밸류 리포트 확인하기</a>
       <a href="https://scorenix.com/ko/pricing?utm_source=blogger&utm_medium=cta_pricing" style="display:inline-block; margin: 6px; padding: 14px 24px; background-color: #10b981; color: white; font-weight:bold; text-decoration: none; border-radius: 10px;">☕ 월 3,900원 Basic Pass 시작하기</a>
       <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #334155;">
         <a href="https://www.youtube.com/@%EC%8A%A4%EC%BD%94%EC%96%B4%EB%8B%89%EC%8A%A4" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #FF0000; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">🎬 공식 유튜브 (@스코어닉스)</a>
         <a href="https://www.instagram.com/scorenix_official/" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #E1306C; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">📸 공식 인스타그램 (@scorenix_official)</a>
         <a href="https://www.threads.com/@scorenix_official" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #18181b; border: 1px solid #3f3f46; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">🧵 공식 쓰레드 (@scorenix_official)</a>
       </div>
       <p style="margin-top: 16px; font-size: 11px; color: #64748b; line-height: 1.5;">⚖️ 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다. 모든 스포츠 관전 및 분석의 최종 판단과 책임은 사용자 본인에게 있습니다.</p>
     </div>
"""

async def generate_blogger_content(match_data: dict, match_url_path: str) -> Optional[dict]:
    """
    Generate an SEO-optimized HTML article for Google Blogger / WordPress.
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
            # Sanitize any legacy social links
            text = text.replace("https://www.youtube.com/@scorenix", "https://www.youtube.com/@%EC%8A%A4%EC%BD%94%EC%96%B4%EB%8B%89%EC%8A%A4")
            text = text.replace("https://www.instagram.com/scorenix/", "https://www.instagram.com/scorenix_official/")
            text = text.replace("https://www.threads.com/@scorenix\"", "https://www.threads.com/@scorenix_official\"")
            
            # Extract intuitive title (First h1)
            title = f"[Scorenix AI 퀀트 리포트] {match_data.get('team_home_ko', '')} vs {match_data.get('team_away_ko', '')} 포아송 기대득점(xG) 및 3-Pillar 승률 시뮬레이션"
            import re
            match = re.search(r'<h1>(.*?)</h1>', text, re.IGNORECASE)
            if match:
                inner_text = re.sub(r'<[^>]+>', '', match.group(1))
                title = inner_text.strip()
                
            return {"title": title, "html": text}

        except Exception as e:
            logger.error(f"Blogger content generation error: {e}")
            
    # Fallback if Gemini is blocked or fails
    return _generate_blogger_fallback(match_data, match_url_path)

def _generate_blogger_fallback(match_data: dict, match_url_path: str) -> dict:
    """Fallback HTML for Blogger when Gemini API fails."""
    home = match_data.get('team_home_ko') or match_data.get('team_home', '홈팀')
    away = match_data.get('team_away_ko') or match_data.get('team_away', '원정팀')
    league = match_data.get('league', '주요 리그')
    h_prob = match_data.get('home_win_prob', 48.0)
    d_prob = match_data.get('draw_prob', 24.0)
    a_prob = match_data.get('away_win_prob', 28.0)
    ho = match_data.get('home_odds', 1.95)
    ao = match_data.get('away_odds', 3.40)
    factors = match_data.get('factors', [])
    
    title = f"[Scorenix 3-Pillar 퀀트 분석] {home} vs {away} ({league}) 포아송 기대득점(xG) 및 AI 승률 시뮬레이션 리포트"
    url = f"https://scorenix.com/ko/match/{match_url_path}?utm_source=blogger&utm_medium=auto_post_fallback"
    
    factors_html = ""
    for f in factors[:5]:
        factors_html += f"<li><strong>{f.get('name', '핵심 팩터')} ({f.get('score', 50)}점):</strong> {f.get('detail', '')}</li>"
    if not factors_html:
        factors_html = f"<li><strong>시장 내재 확률:</strong> 글로벌 표준 지수 홈 {ho} / 원정 {ao} 기반 순수 확률 산출</li>"

    html = f"""
    <h1>{title}</h1>
    <p>안녕하세요. 3-Pillar 하이브리드 스포츠 통계 데이터베이스 및 시뮬레이션 SaaS <strong>Scorenix(스코어닉스)</strong>입니다.</p>
    <p>오늘 분석할 경기는 <strong>{league}</strong>의 <strong>{home}</strong> 대 <strong>{away}</strong> 맞대결입니다. 
    글로벌 시장 마진 제거(Power De-vig) 내재 확률과 포아송 기대득점(xG)/피타고라스 기대승률, 그리고 7대 전술·폼 지표를 결합한 데이터 브리핑을 공개합니다.</p>
    
    <h2>📊 1. 글로벌 표준 지수 및 3-Pillar 기초 확률 분포</h2>
    <ul>
      <li><strong>매치업:</strong> {home} (홈) vs {away} (원정)</li>
      <li><strong>글로벌 표준 지수:</strong> 홈 {ho} / 원정 {ao}</li>
      <li><strong>AI 시뮬레이션 확률 분포:</strong> 홈 {h_prob}% | 무승부 {d_prob}% | 원정 {a_prob}%</li>
    </ul>

    <h2>🔬 2. 7대 핵심 팩터 교차 검증 요약</h2>
    <ul>
      {factors_html}
    </ul>

    <h2>💡 3. 오늘의 무료 샘플 1건 & +EV 핵심 밸류 리포트 3경기 안내</h2>
    <p>단순히 강팀을 선택하는 것이 아니라, <strong>머신러닝 시뮬레이션 확률이 시장 내재 확률을 상회하는 플러스 기대값(+EV) 구간</strong>을 포착하는 것이 핵심입니다. 
    현재 스코어닉스 공식 웹사이트에서는 <strong>매일 1경기의 7대 지표 전체 리포트를 무료 샘플로 공개</strong>하고 있으며, 커피 한 잔 값인 <strong>월 3,900원 Basic Pass</strong>를 통해 <strong>+EV 핵심 밸류 리포트 상위 3경기</strong>와 전 경기 시뮬레이션 데이터를 무제한 제공하고 있습니다.</p>
    
    <div style="margin-top: 36px; padding: 28px; background: linear-gradient(135deg, #0b1120, #1e293b); border: 1px solid #334155; border-radius: 16px; text-align: center; color: #f8fafc;">
      <div style="display:inline-block; padding: 4px 12px; background: rgba(16,185,129,0.2); color: #34d399; border-radius: 999px; font-size: 12px; font-weight: bold; margin-bottom: 10px;">☕ 커피 한 잔 값(월 3,900원) · 일일 1건 AI 심층 리포트 무료 공개 중</div>
      <h3 style="margin-top: 0; color: #ffffff; font-size: 20px;">📊 오늘 밤 AI 신뢰도 80%+ '+EV 핵심 밸류 리포트 3경기'가 궁금하다면?</h3>
      <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px;">스코어닉스 공식 플랫폼에서 실시간 배당률 왜곡 감지 알림과 AI 시뮬레이션 우세 지표를 확인하세요!</p>
      <a href="https://scorenix.com/ko/analysis?utm_source=blogger&utm_medium=cta_analysis" style="display:inline-block; margin: 6px; padding: 14px 28px; background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: white; font-weight:bold; text-decoration: none; border-radius: 10px;">👉 무료 AI 샘플 & +EV 밸류 리포트 보러가기</a>
      <a href="{url}" style="display:inline-block; margin: 6px; padding: 14px 24px; background-color: #10b981; color: white; font-weight:bold; text-decoration: none; border-radius: 10px;">📊 이 경기 전용 리포트 열기</a>
      <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #334155;">
        <a href="https://www.youtube.com/@%EC%8A%A4%EC%BD%94%EC%96%B4%EB%8B%89%EC%8A%A4" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #FF0000; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">🎬 공식 유튜브 (@스코어닉스)</a>
        <a href="https://www.instagram.com/scorenix_official/" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #E1306C; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">📸 공식 인스타그램 (@scorenix_official)</a>
        <a href="https://www.threads.com/@scorenix_official" style="display:inline-block; margin: 4px; padding: 10px 18px; background-color: #18181b; border: 1px solid #3f3f46; color: white; font-weight:bold; text-decoration: none; border-radius: 8px; font-size: 13px;">🧵 공식 쓰레드 (@scorenix_official)</a>
      </div>
      <p style="margin-top: 16px; font-size: 11px; color: #64748b; line-height: 1.5;">⚖️ 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다. 모든 스포츠 관전 및 분석의 최종 판단과 책임은 사용자 본인에게 있습니다.</p>
    </div>
    """
    return {"title": title, "html": html}


def translate_text(text: str, target_lang: str) -> str:
    """Gemini 2.5 Flash를 사용하여 텍스트를 고품질 번역합니다. 실패 시 원본 반환."""
    if not _init_gemini():
        logger.warning("Gemini not initialized for translation. Returning original text.")
        return text

    target_names = {
        "en": "English (Sports quantitative data analyst tone)",
        "ja": "Japanese (Sports data analytics tone)",
        "ko": "Korean (Sports quantitative analyst tone)"
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


def generate_video_script_korean(matches: list, mode: str = "membership", concept_id: str = "QUANT_RADAR") -> list:
    """
    Gemini 2.5 Flash를 활용해 숏츠 영상용 앵커 대본(나레이션) 및 자막 목록을 실시간 작문(Generate)합니다.
    컨셉(concept_id)별로 오프닝 훅과 어조를 다르게 구성하여 유튜브 반복 콘텐츠 필터를 완벽히 회피합니다.
    """
    if not _init_gemini():
        logger.warning("Gemini not initialized. Cannot generate generative script.")
        return []

    matches_summary = ""
    for idx, m in enumerate(matches):
        home = m.get("home") or m.get("team_home", "홈팀")
        away = m.get("away") or m.get("team_away", "원정팀")
        pick = m.get("ai_pick") or m.get("recommendation", "HOME")
        pick_ko = "홈팀 우세" if pick == "HOME" else "원정팀 우세" if pick == "AWAY" else "무승부 경향"
        win_prob = m.get("win_prob") or m.get("confidence", 50)
        h_odds = m.get("home_odds", 1.5)
        a_odds = m.get("away_odds", 3.0)
        d_odds = m.get("draw_odds", 3.5)
        reason = m.get("reason", "")
        matches_summary += f"[{idx+1}번째 경기] {home} vs {away} / 시뮬레이션 우세: {pick_ko} (확률 {win_prob}%) / 지수(홈/무/원정): {h_odds} | {d_odds} | {a_odds} / 분석 데이터: {reason}\n"

    concept_styles = {
        "QUANT_RADAR": "컨셉: [AI 퀀트 레이더]. 냉철한 데이터 과학자 톤으로 포아송 기대득점과 머신러닝 확률 수치를 강조하세요.",
        "FACT_CHECK": "컨셉: [통계 팩트체크]. '아직도 이름값만 보고 경기 보십니까?'처럼 대중의 통념을 뒤집는 날카로운 팩트체크 톤으로 시작하세요.",
        "MATCH_SPOTLIGHT": "컨셉: [빅매치 프리뷰 데스크]. 스포츠 방송 메인 캐스터처럼 박진감 넘치게 양 팀의 전력 지수와 핵심 변수를 브리핑하세요.",
        "VALUE_ALERT": "컨셉: [배당 왜곡 경보]. 시장 내재 확률과 AI 시뮬레이션 확률 사이의 괴리(+EV 기대값)가 발생한 포인트를 긴급 속보 톤으로 전달하세요.",
        "ROUND_SUMMARY": "컨셉: [오늘의 핵심 3경기 스피드 브리핑]. 바쁜 현대인을 위해 핵심 수치만 빠르게 짚어주는 모닝/이브닝 뉴스 브리핑 톤으로 작성하세요."
    }
    concept_guide = concept_styles.get(concept_id, concept_styles["QUANT_RADAR"])

    mode_instructions = {
        "membership": "구독자용 데이터 브리핑입니다. 3개 경기 모두 명확한 산출 근거와 시뮬레이션 우세 확률을 공개하세요.",
        "marketing": "유입용 티저 브리핑입니다. 첫 번째 경기는 시뮬레이션 우세 확률을 시원하게 공개하고, 나머지 경기는 '커피 한 잔 값 월 삼천구백 원으로 스코어닉스 닷컴에서 전체 리포트를 확인하세요'라고 유도하세요.",
        "winning": "백테스트 적중 검증 브리핑입니다. AI 시뮬레이션 모델이 실제 경기 결과와 일치한 데이터를 신뢰감 있게 전달하세요.",
        "educational": "스포츠 퀀트 교육 브리핑입니다. 직관 대신 포아송 기대득점과 플러스 기대값에 기반한 통계 분석의 중요성을 설명하세요.",
        "top_picks": "오늘의 +EV 핵심 밸류 3경기를 요약 브리핑하며 스코어닉스 방문을 유도하세요."
    }
    instruction = mode_instructions.get(mode, mode_instructions["membership"])

    prompt = (
        f"당신은 스포츠 통계 시뮬레이션 플랫폼 '스코어닉스(Scorenix)'의 수석 데이터 아나운서입니다.\n"
        f"제공된 경기 데이터를 활용해 유튜브 쇼츠용 나레이션 대본(tts)과 화면 자막(caption)을 작성해 주세요.\n\n"
        f"--- 방송 컨셉 지침 ---\n"
        f"{concept_guide}\n"
        f"{instruction}\n\n"
        f"--- 경기 데이터 ---\n"
        f"{matches_summary}\n"
        f"--- 작성 규칙 (필수 준수) ---\n"
        f"1. 금칙어: '픽', '무료픽', '베팅', '토토', '도박'이라는 단어는 절대 쓰지 마세요! 대신 '시뮬레이션 우세', '데이터 리포트', '기대값', '승률 지표'를 사용하세요.\n"
        f"2. 대본은 장면(scene) 총 4개(인트로, 경기 1, 경기 2, CTA/아웃트로)로 구성하세요. 각 장면의 'tts'는 성우가 9초 이내에 읽을 수 있도록 **반드시 공백 포함 42자 이내**의 한 문장이어야 합니다.\n"
        f"3. 마지막 CTA 장면에는 '커피 한 잔 값 월 삼천구백 원, 스코어닉스 닷컴에서 전체 리포트를 확인하세요'라는 취지의 문장을 포함하세요.\n"
        f"4. 반환 형식은 마크다운 없이 순수 JSON 배열만 출력하세요:\n"
        f"   [{{\"tts\": \"성우 멘트\", \"caption\": \"화면 자막\", \"scene\": \"intro\"}}]"
    )

    try:
        response = _client.generate_content(prompt)
        if response and response.text:
            text = response.text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            import json
            parsed = json.loads(text)
            if isinstance(parsed, list) and len(parsed) >= 3:
                logger.info(f"✅ Generative script generated via Gemini (mode: {mode}, concept: {concept_id}, scenes: {len(parsed)})")
                return parsed
    except Exception as e:
        logger.error(f"❌ Gemini generate_video_script error (mode={mode}): {e}")
    
    return []

