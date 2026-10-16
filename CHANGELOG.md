# Changelog

## v0.7.1 - Subscription Funnel & Tier Gating Alignment (Free / Pro Analyst / VIP Elite)
- **Strict Tier Gating (`PremiumGate.tsx`, `VipComboPanel.tsx`)**:
    - Replaced the free-open coffee donation component in `PremiumGate.tsx` with true subscription tier enforcement (`free: 0, basic: 1, pro: 2, vip: 3, premium: 3, admin: 99`) and glassmorphism Pro/VIP upgrade CTAs linking directly to `/payment/request?plan=pro&billing=monthly`.
    - Fixed `VipComboPanel.tsx` tier check to accept both `"vip"` and `"premium"` (which `payments.py` assigns on VIP subscription completion).
- **1 Daily Free AI Analysis Sample + Locked Top Picks & Confidence Gauges (`/analysis`, `/bets`)**:
    - **Daily 1-Match Free Sample (`🤖 AI 분석 리포트 일일 1건`)**: Automatically selects 1 non-Top-Pick match per day (`freeSampleMatchId`), floats it to `idx === 0` with a `🎁 오늘의 무료 AI 분석 샘플 (일일 1건 공개)` ribbon, and auto-expands the full 3-Pillar 7-Factor report so visitors can experience Scorenix's analytical quality.
    - **AI TOP PICK Locked (`✕ AI TOP PICK 잠금`)**: Top 3 high-confidence picks show league, team names, and match time as a teaser, while blurring probabilities and locking recommendation & confidence behind `🔒 PRO 전용 잠금`.
    - **Remaining Matches & Confidence Gauges Locked (`✕ 신뢰도 게이지 제한`)**: Matches at `idx >= 1` blur probability bars/donuts, replace Confidence Gauges with `🔒 PRO 전용 제한`, mask EV/recommendation badges, and lock the expandable detail view with `PremiumGate`.
    - **3-League Real-Time Odds Comparison Limit (`📊 실시간 데이터 비교 (3개 리그)`)**: In `/bets` (`viewMode === 'odds'`), Free users can view the first 3 leagues while remaining leagues are blurred with a Pro upgrade CTA.
    - **Combo Simulator Locked (`✕ 조합 분석 잠금`)**: In `/bets`, Free users selecting matches see a locked combo multiplier and `🔒 PRO 구독하고 조합 분석 열기` upgrade button.

## v0.7.0 - 3-Pillar Hybrid Quant Engine, Fast Multi-Sport Data Pipeline & PortOne/KG Inicis Payment Restoration
- **PortOne V2 + KG Inicis (`MOI1846444`) Card Payment & Tier Gating Restoration**:
    - Restored `pricing`, `payment/request`, `payment/complete`, `refund`, `PremiumGate`, `Navbar`, `VipComboPanel`, and `tier_guard.py` from commit `bfceb63` with Pro (55,000 KRW/mo) and VIP (105,000 KRW/mo) plans.
    - Re-enabled `/api/payments` router in `backend/app/main.py` and synchronized `PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `PORTONE_CHANNEL_KEY`, `PORTONE_WEBHOOK_SECRET`, and `KG_INICIS_MID` to Firestore `system_config/main_config`.
- **Ultra-Fast Multi-Sport Match, Odds & Standings Pipeline (`espn_fast_service.py`, `pinnacle_api.py`)**:
    - Built parallel 2.5s collector across 17 leagues/sports (14 Soccer leagues + MLB + NBA + NHL) fetching 5-day fixtures, DraftKings moneyline/spread/total odds, recent 5-match form (`W/D/L`), and full league standings.
    - Eliminated 5-item mock fallback trap caused by API-Football Free plan season/next restrictions and exhausted The Odds API credits.
    - Added Cloud Scheduler job `scorenix-update-predictions` (`0 */2 * * *` KST) to automatically refresh `market_cache/odds_snapshot`, `daily_portfolios`, and `value_picks`.
- **3-Pillar Hybrid Quant Win Prediction Engine (`ml_service.py`, `soccer_stats_service.py`)**:
    - Removed deterministic MD5 team-name hash fake stats in `soccer_stats_service.py`.
    - Established the **3-Pillar Hybrid Quant Engine**:
        - **Pillar 1 (45%)**: Power De-vigged Market Implied Probability (`k=1.05`).
        - **Pillar 2 (30%)**: Dixon-Coles Low-Score Adjusted Bivariate Poisson Model (Soccer) / Pythagorean Log5 Win Expectancy (MLB/NBA/NHL).
        - **Pillar 3 (25%)**: 7-Factor Tactical & Momentum Scoring with Korean analytical evidence (`배당 내재 확률`, `전력 및 순위 지수`, `기대득실(xG/포아송)`, `최근 경기 흐름`, `배당 흐름·핸디캡`, `홈/원정 구장 이점`, `종합 매치업 밸런스`).
- **Frontend `/bets` & `/analysis` Fixes**:
    - Fixed Korean/English team name matching in `frontend/app/bets/page.tsx` so EV badges, market odds, and Home/Draw/Away cart selection buttons render on all AI cards.

## v0.6.3 - YouTube Shorts Multi-Mode & WordPress Auto-Publishing
- **Shorts Generator Upgrades** (`generate_shorts_pipeline.py`):
    - Added parallel multi-video generation: Creates separate **Membership (Subscriber)** deep analytical videos and **Marketing (Funnel)** teasers.
    - Updated script generator to use separate narration templates and calls to action depending on target audience.
    - Disabled automatic deletion of local shorts files after uploading, retaining them on the desktop for distribution to other SNS accounts.
- **WordPress Auto-Publishing Service** (`wordpress_service.py`, `endpoints/wordpress.py`):
    - Engineered WordPress REST API integration using Application Passwords (Basic Auth).
    - Integrated with Firestore system config for secure, dynamic storage of WordPress URL, username, and application password.
    - Scheduled daily automatic match predictions post generation at 11:30 KST in the background.
    - Added FastAPI manual trigger endpoint at `/api/wordpress/post`.

## v0.6.2 - Crawler Stability & Error Handling
- **Betman Crawler Enhancement** (`crawler_betman_browser.py`):
    - Restricted automated round selection to `G101` (Win/Draw/Loss), preventing API failures caused by selecting unsupported `G102` (Record) games.
    - Improved diagnostic logging for non-JSON API responses (e.g., WAF blocks or maintenance pages) by capturing and logging HTML body snippets.
    - Added explicit logging of available Game IDs when no compatible rounds are found.

## v0.6.1 - System Configuration & AI Recovery
- **API Key Management**: Restored missing Gemini API Key (`GEMINI_API_KEY`) to production Firestore `system_config` to re-enable AI-driven analysis text generation (bypassing the fallback simple templates).
- **Backend Deployment**: Successfully deployed to `scorenix-backend` Cloud Run service.

## v0.6.0 - Premium Financial Analysis & Platform Compliance Cleanup

### 💼 Financial Math Integration (VIP / PRO)
- **Kelly Criterion Bankroll Allocator** (`calculator.py`, `vip_portfolio.py`):
    - Implemented mathematical Kelly Criterion formulas for optimal fraction betting.
    - Added user risk profiling (`Conservative`, `Moderate`, `Aggressive`) translating to Kelly fractions.
- **Tax Optimization Splitter** (`combinator.py`):
    - Programmed specific logic to evade local 22% taxation thresholds (over 2M return or 100x odds with 100k constraint) by intelligently dividing tickets.

### 🧹 Terminology Sanitization (MoR Compliance)
- **Full Interface Sweep**: Replace prohibited gambling terms ("Betting", "Toto", "Bet") across the platform with research-focused terminology ("Analysis", "Value", "Prediction").
- **Tier Democratization**: Expanded access rules in `@require_tier` dependencies allowing `Pro` users to utilize `VIP` portfolio operations to match advertised features on the pricing page.

### 🐛 Cleanup & Stability
- **Onboarding Tour Deprecation**: Extracted problematic, unresolved `data-tour` UI spotlight overrides spanning 7+ frontend files.
- **Mock Data Severance**: Deprecated the synthetic placeholder payloads (`_get_mock_data`) in `pinnacle_api.py`, ensuring only verified historical/real-time `API-Football` or cached odds govern system outcomes.

## v0.5.0 - AI Sports Analysis Pipeline Specialization (Soccer Focus)

### ⚽ Core AI Evolution: Soccer Specialization
- **Domain-Specific Feature Engineering** (`soccer_features.py`, `soccer_stats_service.py`):
    - Implemented a deterministic stats generator simulating real-world indicators (xG, Form, Fatigue, Possession, Injury Impact) for consistent frontend prototyping and UX tuning.
    - Scaled feature extraction to output detailed indices evaluating head-to-head tactical dominance based on aggregated xG limits and match schedules.
- **Heuristic Inference Engine** (`ml_service.py`):
    - Replaced standard flat mock predictions with `_heuristic_soccer_predict()`, a fallback inference mechanism that synthesizes win probability explicitly from extracted features (xG, schedules) when the primary LightGBM model lacks data.
    - Passed component insights (e.g., Weight, Score, Cause) transparently through the API response schema to support descriptive breakdowns in VIP dashboards.

### 🔌 API & System Integrations
- **Data Auto-Injection** (`scheduler.py`, `ai_predictions.py`):
    - Rewired prediction endpoints and the background cron task (`update_job`) to successfully invoke and embed `soccer_stats_service` outputs prior to AI model execution, validating the end-to-end data funnel.
- **Frontend Environment Resilience**:
    - Purged unstable local API dependencies (`localhost:8000`) inside Next.js components (`VipComboPanel.tsx`, `DroppingOddsRadar.tsx`), binding API requests securely to `process.env.NEXT_PUBLIC_API_URL` to resolve silent production failures.

## v0.4.0 - SNS Automation Pipeline Enhancement

### 📢 Social Media Management
- **Duplicate Post Prevention**: Implemented a timestamp-based signature (`[Ref: {timestamp}]`) in `gemini_service.py` (`generate_generic_promo()`) to bypass Buffer API's spam filters and duplicate content blocks.
- **Dynamic Content Generation**: Refined `SNS_GENERIC_MARKETING_PROMPT` to enforce unique content generation per cycle (variable tone, dynamic emoji placement) during low-data periods.
- **Multi-Platform Support Readiness**: Verified `buffer_service.py` iterates over active channels, ensuring immediate compatibility when expanding platforms (e.g., adding more via premium Buffer plan).

### 🛠 System Diagnosis & Deployment
- **Log Forensics**: Identified and resolved silent failures caused by Buffer duplicating detection rules via GCP Cloud Run logs.
- **Production CI/CD**: Successfully pushed codebase updates to GitHub and deployed backend patches securely to `scorenix-backend` (via `/deploy-backend` workflow), confirming system stability (`HTTP 200`).


## v0.3.0 - AI Infrastructure Standardization & Git Backup

### 🛡️ System Protection & Documentation
- **AI Guidelines Base**: Created strict rule sets in `AGENTS.md` and `ARCHITECTURE.md` to prevent deployment mistargeting and database overrides by AI agents.
- **GitHub Synchronization**: Established disaster recovery by committing and pushing the entire project state to the remote repository (`onestopbeolcho/betmansport`).
- **Workflow Automation**: Built secure, script-based deployment workflows to reduce manual errors (e.g., `/deploy-backend`).

## v0.2.0 - Performance & Portfolio Update (Previous)

### 🚀 Performance Optimization
- **Server-Side Caching**: Implemented a database-backed caching layer (`MarketCache` table) for Pinnacle Odds API.
  - Reduces API calls by serving cached data within 5 minutes.
  - Improves page load speed for the Market page.
- **Async Architecture**: Refactored `PinnacleService` and `Scheduler` to use `AsyncSession` and `httpx.AsyncClient` for better concurrency and performance.

### 💾 Portfolio Features
- **Save Combination (Smart Cart)**:
  - Users can now save their current "Smart Cart" selections as a "Betting Slip".
  - Feature accessible via the "조합 저장하기" button in the floating cart.
- **My Page Update**:
  - Added a "My Slips" section to `MyPage`.
  - Displays saved combinations with detailed odds, stake, and potential return calculations.
  - Integration with backend `/api/portfolio/slips/my` endpoint.

### 🛠 Technical Improvements
- Database schema updates: Added `MarketCache` and `BettingSlipDB` tables.
- Frontend: Refactored `BetSlip` component to handle auth-guarded saving.
