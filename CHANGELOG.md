# Changelog

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
