# Changelog

## v0.2.0 - Performance & Portfolio Update (Current)

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
