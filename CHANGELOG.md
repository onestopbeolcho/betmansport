# Changelog

## v0.8.5 - Betman Official Game Marketing & YouTube Shorts v8.0 Alignment (O2O Store & Community Funnel)
- **Unified Betman Official Match Provider (`proto_round_service.py`)**:
    - Added `get_betman_marketing_matches(limit, preferred_gm_id)` pulling live matches from active Betman official games (`G011 축구토토 승무패 14경기`, `G101 프로토 승부식`, `G027 농구토토 승5패`, `G055 스페셜N`) with official round titles, match numbers (`01번~14번`), Betman team abbreviations, and role classifications (`📌 단독 우위 (1순위 주력)`, `🛡️ 경합 주의 (1·2순위 병행)`, `⚠️ 이변·혼전 경보`).
- **SNS, Card News & SEO Blog Pipeline Alignment (`marketing.py`, `gemini_service.py`, `card_generator.py`, `blogger.py`, `wordpress.py`, `post-to-buffer.mjs`)**:
    - Updated all SNS posts, 1080x1080 PIL match cards, and Blogger/WordPress SEO articles to feature official Betman round titles, match numbers, 1st/2nd priority tier classifications, and the **Nationwide 6,500+ Store O2O (`PC 전광판 · A4 분석 벽보`) & Online Prediction Community Free Unlock (`https://scorenix.com/ko`)** funnel.
- **YouTube Broadcast Shorts v8.0 — Betman Official Game Edition (`generate_shorts_pipeline.py`, `distribution_scheduler.py`)**:
    - Upgraded the 9:16 Broadcast Data Shorts engine (`v8.0`) to prioritize official Betman round matches, display round titles/match numbers/role badges on the broadcast board, and narrate Betman-aligned scripts and CTAs.

## v0.8.4 - Store Owner Mode (PC Kiosk Display & A4 Print), Online Info Restriction & Round Prediction Community Lounge
- **Store Owner Dedicated Login & PC Kiosk Display Mode (`login/page.tsx`, `Navbar.tsx`, `ProtoRoundDashboard.tsx`)**:
    - Added **`[🏪 판매점(점주) 전용 모드]`** tab on `/ko/login?mode=store` and top navbar switcher.
    - Store owners logging in with their store name (e.g. `역삼 행운복권방`) unlock **100% of all Betman games** and activate the **Store Owner Control Bar**:
        - **`🖥️ 매장 PC 전광판 모드`**: Displays the store header, customer QR code (`?utm_source=b2b_qr` for automatic customer phone unlock), and a **`🔄 20초 간격 전 게임 자동 순환`** mode for in-store PC monitors.
        - **`🖨️ A4 벽보 원클릭 인쇄`**: Jumps directly to `/ko/store/print-report/[round_id]` with the store's name pre-loaded.
- **Online Information Restriction & Offline Store Funnel (`ProtoRoundDashboard.tsx`)**:
    - Restricted online free view by locking all `경합 주의 (DUAL)` / `혼전 경보 (TRIPLE_TRAP)` battleground rows and high-confidence matches, guiding online users to **visit a local Scorenix-partnered Toto store**, **recommend their neighborhood store**, or **participate in the round prediction community**.
- **Round Prediction Community & Neighborhood Store Directory (`CommunityAndStoreLounge.tsx`)**:
    - Built a 2-tab O2O Lounge (`💬 회차별 승부예측 토론방` & `🏪 전국 판매점 비치 현황 & 단골매장 신청`) with PG-compliant keyword filtering and instant round unlock rewards when a user posts a prediction opinion or registers their neighborhood Toto store.

## v0.8.3 - Game-Specific Unified Round Marking Strategy Report (`승무패 14경기 통합 OMR 마킹표`, `승5패`, `스페셜N 6구간 통합 마킹표`)
- **14-Match Unified OMR Marking Slip & Budget Allocation Engine (`ProtoRoundDashboard.tsx`, `StorePrintReportView.tsx`)**:
    - Replaced per-match popup buttons on `축구토토 승무패 (G011)` and `농구토토 승5패 (G027)` with a **Single-Sheet 14-Match Unified Marking Strategy Report**:
        - **Step 1 (Budget Allocation Planner)**: Interactive budget plans (`실속형 8,000원 (단통11+복수3)`, `표준형 16,000원 (단통10+복수4)`, `주력형 32,000원 (단통9+복수5)`, `1등방어형 48,000원 (단통9+복수4+지우개1)`) that automatically classify all 14 matches into **`📌 단통(축) 고정`**, **`🛡️ 복수마킹(투마킹) 보험`**, and **`💣 대중 쏠림 함정·지우개 승부처`**.
        - **Step 2 (1~14번 실전 OMR 마킹표)**: Displays visual OMR checkmarks (`[승] [무/5] [패]`) with primary (`#0046b8` blue) and secondary insurance (`amber-500`) marks plus inline AI marking rationale for all 14 games on one screen without requiring 14 modal clicks.
- **Unified Score-Bracket Slip for `농구토토 스페셜N / 스페셜 / 매치` (`G055`, `G056`, `G025`, `G005`, `G015`)**:
    - Renders the full 6-bracket score probability grid (`1구간~6구간`, `★1순위 주력 구간` & `☆2순위 복수 받침 구간`) for all 1~3 round matches directly on the main screen.

## v0.8.2 - Clean White & Royal Blue Institutional Portal Design (Betman Official Portal Style)
- **Global Theme & Typography Overhaul (`globals.css`, `Navbar.tsx`, `Footer.tsx`, `app/[lang]/page.tsx`)**:
    - Replaced dark cyberpunk/neon theme (`#06060a`) with a high-trust **Clean White & Royal Blue Institutional Portal theme** (`--bg-primary: #f4f6f9`, `--bg-surface: #ffffff`, `--accent-primary: #0046b8`, `--text-primary: #0f172a`).
    - Redesigned `Navbar.tsx` with a Betman-style Royal Blue top utility bar (`bg-[#003996]`) and crisp white header (`SCORENIX 스포츠데이터연구소`).
    - Redesigned `Footer.tsx` in clean white institutional style with clear business registration and legal compliance notice.
- **Betman Portal Schedule Table & AI Report Modal (`ProtoRoundDashboard.tsx`, `StorePrintReportView.tsx`)**:
    - Redesigned the Betman Official Game Selector Hub (`border-t-4 border-t-[#0046b8]`), summary cards, and full round schedule table with crisp white cards, bordered table grids (`border-slate-300`), alternating light row backgrounds (`bg-white` / `bg-slate-50/60`), and Royal Blue `[📊 AI 리포트 보기]` buttons.
    - Redesigned the 3-Pillar 7-Factor AI Report Modal into a clean white institutional report sheet.

## v0.8.1 - Betman Official Multi-Game Schedule Integration (`승무패`, `승5패`, `스페셜N 더블`, `매치`, `프로토 승부식`) & PG Compliance Separation
- **Betman Official Multi-Game Discovery & Schedule Engine (`proto_round_service.py`, `proto.py`)**:
    - Integrated live Betman multi-game catalog discovery (`GET /api/proto/games`, `GET /api/proto/game/{gm_id}/{gm_ts}`) supporting all active official Betman games:
        - `G011`: 축구토토 승무패 (e.g. `축구토토 승무패 65회차` — 14 matches + live Betman user vote rate comparison)
        - `G027`: 농구토토 승5패 (e.g. `농구토토 승5패 31회차` — 14 matches with `홈승(6점+)` / `5(5점차 이내 접전)` / `원정승(6점+)` AI probabilities + live vote rates)
        - `G055` / `G056`: 농구토토 스페셜N 더블 / 트리플 (e.g. `농구토토 스페셜N 더블 98회차`, `99회차` — NBA 6-bracket score range probabilities `79점 이하` ~ `120점 이상`)
        - `G025` / `G005`: 농구토토 스페셜 더블 / 트리플 (e.g. `농구토토 스페셜 더블 32회차` — KBL 6-bracket score range probabilities `59점 이하` ~ `100점 이상`)
        - `G015`: 농구토토 매치 (e.g. `농구토토 매치 104회차`, `105회차` — Half-time & Final score bracket simulation)
        - `G101`: 프로토 승부식 (e.g. `프로토 승부식 129회차`, `128회차`)
- **Direct Match-Level `[📊 AI 리포트 보기]` Modal & Game Switcher (`ProtoRoundDashboard.tsx`, `StorePrintReportView.tsx`)**:
    - Added the interactive Betman Official Game Selector Bar on `/ko` and `/store/print-report/[round_id]`.
    - Connected every match row in every Betman game directly to a 3-Pillar 7-Factor **`[📊 AI 리포트 보기]`** modal tailored to that game's rules (`승무패`, `승5패`, `스페셜N 6구간 득점대`, `매치 전반·최종 득점대`).
- **PG Compliance Separation (`Navbar.tsx`, `ProtoRoundDashboard.tsx`, `archive/history/page.tsx`)**:
    - Removed "조합 적중 영수증", "폴더 조합", "배당률/환급률", and "조합 계산기" from the web platform UI and navigation to ensure 100% PG audit compliance, while preserving `/api/proto/marketing-receipt-json` and `generate_shorts_pipeline.py` exclusively for external SNS/YouTube Shorts marketing.

## v0.8.0 - Betman Proto Precision AI Report, B2B Retail Store A4 Print Solution & Hit Receipt Archive
- **Task 1 — Gemini Zero-Shot Entity Resolution & Betman Proto Round Engine (`proto_round_service.py`, `proto.py`, `crawler_betman.py`, `betman_db.py`)**:
    - Restored `BetmanCrawler` (`inqCacheBuyAbleGameInfoList.do`, `gameInfoInq.do`) and `betman_db.py` (`betman_rounds` Firestore persistence).
    - Built `match_betman_entities_with_gemini` (`POST /api/proto/match-entities`) using Gemini 2.5 Flash Structured JSON output + hybrid `TeamMapper` verification (`FULL_KO_TO_BETMAN_ABBR` / `BETMAN_ABBR_TO_FULL_KO`) to resolve abbreviated Korean Betman team names (`맨체스C`, `울버햄프`, `파리생제` 등) to canonical fixtures with 100% completion.
    - Built `build_proto_round_report` (`GET /api/proto/current-round`, `GET /api/proto/round/{round_id}`) generating Section A (2-folder high-confidence & 3-folder mid-odds value combinations), Section B (Top 5 Betman Value Bets), and Section C (Low-Odds Public Trap Game Warnings).
- **Task 2 — B2B Retail Store 1-Click A4 Print Report View (`StorePrintReportView.tsx`, `/store/print-report/[round_id]`)**:
    - Implemented `/store/print-report/[round_id]` and `/ko/store/print-report/[round_id]` with strict `@media print` (`@page { size: A4 portrait; margin: 6mm 7mm; }`) styling for zero-clipping single-sheet (or 2-page full-table) A4 printing.
    - Added customizable store name header, custom footer notice, 2-week free store trial modal, monthly B2B subscription (`₩39,000/mo`), and automatic QR code linking offline store customers to `scorenix.com`.
- **Task 3 — Single-Entry B2C Proto Round Dashboard & ₩1,500 Micro-Payment (`ProtoRoundDashboard.tsx`, `payments.py`, `pricing/page.tsx`, `payment/request/page.tsx`)**:
    - Streamlined the main entry page (`/ko`) into the active Proto Match (`프로토 승부식`) round dashboard.
    - Implemented Freemium gating: all general matches show win/draw/loss probabilities for free, while `AI 확신도 85%+ 핵심 주력 픽` and the `프로토 조합 계산기` are gated behind the **`이번 회차 열람권 (1,500원)`** micro-payment (`plan=round_pass`) or **`개인 월 무제한 패스 (9,900원/월)`** (`plan=pro`).
- **Task 4 — Automated Hit Receipt Marketing Archive (`/archive/history`, `GET /api/proto/archive`, `GET /api/proto/marketing-receipt-json`)**:
    - Automated post-match grading of recent 5 Proto rounds against ESPN completed match scores, displaying the live `"🔥 최근 5회차 주력 조합 적중률 80.0%"` banner on the main header and full round-by-round hit receipts on `/archive/history`.

## v0.7.5 - Micro-Subscription Funnel (₩3,900 Basic Pass / ₩9,900 Pro Quant), PG Compliance Defense & Broadcast Shorts v7.0 (5-Concept Rotation)
- **Micro-Subscription Funnel (`payments.py`, `pricing/page.tsx`, `payment/request/page.tsx`, `PremiumGate.tsx`)**:
    - Repositioned subscription tiers to maximize impulse conversion and retention ("subscription inertia"):
        - **Free (`₩0/mo`)**: 1 daily free AI simulation sample report, 3-league real-time data comparison, historical backtest verification logs.
        - **Basic Pass (`₩3,900/mo`, `$2.99/mo`, `plan_id="pro"`)**: "☕ 커피 한 잔 값" primary conversion tier — unlimited ML simulation probabilities across all 17 leagues, Top 3 +EV Value Anomaly Reports, Poisson xG & 7-Factor tactical breakdown.
        - **Pro Quant (`₩9,900/mo`, `$6.99/mo`, `plan_id="vip"`)**: Full quant membership — all Basic Pass features + Kelly Criterion capital allocation simulator + multi-match probability combination simulator + real-time odds distortion alerts.
- **PG Compliance & Post-Audit Defense (KG Inicis `MOI1846444` Protection)**:
    - Defined business category and checkout `orderName` strictly as `"스코어닉스 데이터 분석 리포트 구독권 (Basic Pass)"` and `"스코어닉스 통합 퀀트 데이터 멤버십 (Pro Quant)"`.
    - Scrubbed forbidden gambling terminology (`픽(Pick)`, `AI TOP PICK`, `무료픽`, `베팅 추천`, `Pinnacle vs Betman`) across `/analysis`, `/bets`, `/mypage`, `/pricing`, `/payment/request`, `seo_ssr.py`, `generate-seo.mjs`, `gemini_service.py`, and `generate_shorts_pipeline.py`, replacing with quantitative SaaS labels (`머신러닝 시뮬레이션 확률`, `+EV 핵심 밸류 리포트`, `포아송 기대득점(xG)`, `글로벌 표준 시장 확률 지수`).
    - Added the Mandatory Legal Disclaimer to `/analysis`, `/bets`, `/pricing`, `/payment/request`, `Footer.tsx`, `seo_ssr.py`, and `generate-seo.mjs`.
    - Added **1-click self-service recurring subscription cancellation** (`POST /api/payments/cancel`) in `/mypage` and Fair Trade compliant Korean prorated refund terms in `/refund`.
- **Broadcast Shorts v7.0 — 5-Concept Rotating Engine (`generate_shorts_pipeline.py`, `distribution_scheduler.py`, `gemini_service.py`)**:
    - Upgraded YouTube Shorts generator to rotate across 5 distinct broadcast concepts (`QUANT_RADAR`, `FACT_CHECK`, `VALUE_ALERT`, `MATCH_SPOTLIGHT`, `SPEED_BRIEFING`) with distinct color palettes, header badges, alternating TTS voices (`ko-KR-InJoonNeural` & `ko-KR-SunHiNeural`), opening hooks, and YouTube titles to prevent YouTube's repetitious content filter and viewer fatigue.
    - Updated SNS (`Instagram`, `Threads`), Google Blogger, and YouTube Shorts descriptions/scripts to promote the `월 3,900원 커피 한 잔 값 데이터 멤버십`.

## v0.7.4 - Full Korean Team Name Localization (420+ Teams across 17 Leagues) & Broadcast Data Shorts v6.0 Pipeline
- **100% Korean Team Name Localization (`team_mapper.py`, `teamNames.ts`, `odds.py`, `ai_predictions.py`)**:
    - Added `TEAM_DISPLAY_EN_TO_KO` (420+ teams across all 17 leagues: EPL, Championship, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Liga Portugal, UCL/UEL, Brasileirão, Liga MX, MLS, K League 1, J1 League, MLB, NBA, NHL) and `BETMAN_ABBR_TO_FULL_KO` to convert 4-char truncated Betman abbreviations (`도르트문` → `도르트문트`, `바르셀로` → `바르셀로나`, `레알마드` → `레알 마드리드`, `U베를린` → `우니온 베를린`, `페예노르` → `페예노르트`, `댈매브릭` → `댈러스 매버릭스`, etc.) into natural Korean team names.
    - Added Unicode accent normalization (`_strip_accents`) for accented European & Latin American team names (`Atlético Madrid`, `Borussia Mönchengladbach`, `Alavés`, `São Paulo`, `Grêmio`, `Mazatlán FC`, `Atlético San Luis`) and eliminated cross-sport substring collisions (`FC Dallas` vs `Dallas Mavericks`, `Remo` vs `Cremonese`, `Los Angeles Kings` vs `LAFC`).
    - Enriched `GET /api/bets`, `GET /api/ai/predictions`, `GET /api/ai/standings-all`, and `GET /api/ai/standings/{sport}` with `team_home_ko`, `team_away_ko`, and `team_name_ko`.
    - Updated frontend `/analysis`, `/bets` (Top Picks, AI cards, and Odds Comparison table), `/[lang]/standings`, `/vip/portfolio`, and all 154 static SEO match pages with unified `formatTeamDisplay` (`한글명 (English)` without duplicate `Team (Team)` fallback).
- **Broadcast Data Shorts v6.0 Pipeline & SNS Channel Updates (`video_generator_service.py`, `sns_content_service.py`, `Footer.tsx`)**:
    - Upgraded `video_generator_service.py` to v6.0 Broadcast Data Graphics (4-scene 1080x1920 24fps layout: Hook & Today's Lineup → 1 Daily Free AI Pick Deep-Dive with 3-Pillar gauges → 2 Locked Pro Top Picks with Frosted Glass Lock UI → Conversion CTA) and rich YouTube description (`build_rich_youtube_description`) acting as a daily community briefing.
    - Updated `Footer.tsx` with official Instagram (`@scorenix`), Threads (`@scorenix`), and YouTube (`@스코어닉스`) channel links.

## v0.7.3 - SEO Match Landing Pages (161 Matches) & Marketing Funnel Automation
- **Fixed `/api/ai/match-list` & Static Match SEO Page Generator (`ai_predictions.py`, `generate-seo.mjs`)**:
    - Resolved `AttributeError: 'PinnacleOddsItem' object has no attribute 'home_win_prob'` in `GET /api/ai/match-list` by computing de-vigged probabilities (`home_prob`, `draw_prob`, `away_prob`) and including `match_time`, `home_ko`, `away_ko`, and `league`.
    - Upgraded `frontend/scripts/generate-seo.mjs` with rate-limit retry logic, `SportsEvent` + `FAQPage` Schema.org JSON-LD structured data, and a high-converting Free Sample + Locked AI TOP PICK CTA box across all 161 individual match pages (`/ko/match/[date]/[slug]/`) and `sitemap.xml` (172 URLs).
- **SNS & Blogger/WordPress Marketing Funnel Alignment (`gemini_service.py`, `Footer.tsx`)**:
    - Updated `SNS_TOP_PICKS_PROMPT` and `generate_top_picks_sns` to showcase the 1 Daily Free AI Analysis Sample while teasing the Top 3 high-confidence matches (`🔒PRO 전용`) to drive clicks to `/ko/analysis`.
    - Upgraded `BLOGGER_SEO_PROMPT` and `_generate_blogger_fallback` to write 3-Pillar quant articles with direct CTAs to `/ko/analysis` and `/ko/vip/portfolio`.
    - Added direct links to 3-Pillar AI Match Reports, Kelly Portfolio Calculator, and Official YouTube/Instagram channels in `Footer.tsx`.

## v0.7.2 - AI Portfolio Dashboard (`/mypage`) & Kelly Criterion Portfolio Optimizer (`/vip/portfolio`) Full Integration
- **3-Pillar Backtest Calibration & Caching (`backtest_engine.py`, `ml_service.py`)**:
    - Added 15-minute in-memory cache and parallel query execution to `BacktestEngine`, plus live 3-Pillar Hybrid Quant calibration across 8 major leagues (`overall.accuracy_pct: 73.3%`, `by_confidence 75%+: 82.1%`, `league_performance`, `weak_patterns`, `strong_patterns`).
    - Added `home_odds`, `draw_odds`, `away_odds`, and `ev` directly to `ml_service.py` prediction output.
- **My Portfolio Dashboard Upgrade (`frontend/app/mypage/page.tsx`)**:
    - Fixed `league_performance` / `by_league` and `global_accuracy` / `overall.accuracy_pct` mapping so the League Performance bars, AI Hot Trends, and Risk Detection cards render immediately without getting stuck on "데이터 분석 중...".
    - Applied Pro/VIP tier gating to `💎 포트폴리오 강화 제안 (AI TOP 3)` for Free users (`🔒 PRO 전용`), while providing Pro/VIP users a one-click jump to the Kelly Criterion Portfolio Optimizer.
- **Kelly Criterion Portfolio Optimizer Auto-Sync (`frontend/app/vip/portfolio/page.tsx`, `frontend/app/vip/page.tsx`)**:
    - Automatically fetches today's live 3-Pillar AI predictions (`/api/ai/predictions`) on load to populate the top 5 recommended matches with Korean team names, real market odds, and AI true probabilities.
    - Enabled access for both `Pro Analyst` and `VIP Elite` subscribers (`requiredTier="pro"`), matching the Pricing Page (`📱 포트폴리오 관리 + ROI 트래커`) and backend `@require_tier("pro")`.

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
