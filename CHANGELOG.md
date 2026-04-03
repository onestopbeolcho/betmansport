# Changelog

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
