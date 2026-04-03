# Scorenix (Smart Proto Investor) — 시스템 아키텍처 레퍼런스

> **⚠️ 이 파일은 AI 에이전트가 작업 전 반드시 읽어야 하는 핵심 레퍼런스입니다.**
> AI가 코드를 수정하거나 배포할 때 이 문서를 먼저 참조하여 **잘못된 서비스에 배포하거나, 존재하지 않는 URL을 사용하거나, 동작 중인 기능을 파괴하는 것을 방지**합니다.
>
> **최종 업데이트: 2026-04-03**

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|------|
| **서비스명** | Scorenix (스코어닉스) |
| **도메인** | https://scorenix.com |
| **GCP 프로젝트 ID** | `smart-proto-inv-2026` |
| **Firebase 프로젝트 ID** | `smart-proto-inv-2026` |
| **리전** | `asia-northeast3` (서울) |
| **프론트엔드** | Next.js 16 (Static Export → Firebase Hosting) |
| **백엔드** | FastAPI 0.128 (Cloud Run) |
| **데이터베이스** | Firestore (NoSQL) |
| **인증** | Firebase Auth (Google, Phone) + 자체 JWT |
| **결제** | PortOne v2 (KG이니시스 MID: MOI1846444) |

---

## 2. 인프라 구성도

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 (브라우저)                       │
│                  https://scorenix.com                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Hosting (Static)                   │
│  소스: frontend/out (next build → static export)         │
│  호스트: smart-proto-inv-2026.web.app                    │
│  커스텀 도메인: scorenix.com, www.scorenix.com           │
│                                                          │
│  firebase.json rewrites:                                 │
│    /api/** → Cloud Functions (api) — ⚠️ 현재 미사용      │
│    **     → /index.html (SPA fallback)                   │
└───────────────────────┬─────────────────────────────────┘
                        │
     프론트엔드에서 직접 API 호출 (NEXT_PUBLIC_API_URL)
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│          Cloud Run: scorenix-backend (프로덕션)           │
│  URL: https://scorenix-backend-n5dv44kdaa-du.a.run.app  │
│  소스: backend/ (Dockerfile 기반)                        │
│  런타임: Python 3.10-slim + uvicorn                      │
│  메모리: 512Mi | 포트: 8080                              │
│                                                          │
│  ⚠️ 환경변수는 Firestore system_config에서 자동 로드     │
│  ⚠️ 콜드 스타트 시 fetch_odds()가 Firestore 캐시 활용    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Firestore (NoSQL DB)                    │
│  프로젝트: smart-proto-inv-2026                          │
│  위치: asia-northeast3                                   │
│                                                          │
│  주요 컬렉션:                                            │
│    users/          — 사용자 프로필, 역할(role), 등급(tier)│
│    payments/       — 결제 기록                           │
│    portfolio/      — 포트폴리오                          │
│    votes/          — 경기 투표                           │
│    predictions/    — AI 예측 결과                        │
│    notifications/  — 알림                               │
│    market_cache/   — 배당 데이터 캐시 (odds_snapshot)    │
│    odds_history/   — 배당 변동 이력 (차트용)             │
│    system_config/  — API 키 영구 저장                    │
│    stats_cache/    — AI 통계 스냅샷                      │
│    leaderboard/    — 랭킹                               │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Cloud Run 서비스 목록 ⚡ (중요)

> **⚠️ 절대 규칙: 프론트엔드는 `scorenix-backend` 서비스를 사용합니다.**
> **다른 서비스에 코드를 배포해도 사이트에 반영되지 않습니다.**

| 서비스명 | URL | 용도 | 배포 대상 |
|---------|-----|------|----------|
| **scorenix-backend** | `https://scorenix-backend-n5dv44kdaa-du.a.run.app` | **🔴 프로덕션 백엔드 (프론트엔드 연결)** | ✅ 여기에 배포 |
| api | `https://api-n5dv44kdaa-du.a.run.app` | 테스트/이전 버전 | ❌ 배포 불필요 |
| smart-proto-backend | `https://smart-proto-backend-n5dv44kdaa-du.a.run.app` | 레거시 (사용 안 함) | ❌ 배포 불필요 |
| odds-collect-scheduled | `https://odds-collect-scheduled-n5dv44kdaa-du.a.run.app` | 스케줄러 (독립) | 별도 관리 |
| auto-settle-scheduled | `https://auto-settle-scheduled-n5dv44kdaa-du.a.run.app` | 자동 정산 (독립) | 별도 관리 |

---

## 4. 배포 명령어 레퍼런스

### 백엔드 배포 (Cloud Run)
```powershell
# gcloud 경로 설정
$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"

# ⚠️ 반드시 scorenix-backend에 배포!
gcloud run deploy scorenix-backend `
  --source . `
  --region asia-northeast3 `
  --project smart-proto-inv-2026 `
  --allow-unauthenticated `
  --memory 512Mi `
  --timeout 300 `
  --clear-base-image
```
**작업 디렉토리**: `c:\Smart_Proto_Investor_Plan\backend`

### 프론트엔드 배포 (Firebase Hosting)
```powershell
# 1. 빌드
cd c:\Smart_Proto_Investor_Plan\frontend
npm run build

# 2. Firebase 배포
cd c:\Smart_Proto_Investor_Plan
firebase deploy --only hosting
```

### 전체 배포 (Hosting + Functions)
```powershell
cd c:\Smart_Proto_Investor_Plan
firebase deploy --only hosting,functions
```

---

## 5. 환경변수 관리

### 5.1 프론트엔드 (frontend/.env.local)
| 변수명 | 값 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_API_URL` | `https://scorenix-backend-n5dv44kdaa-du.a.run.app` | ⚠️ **절대 변경 금지** — 백엔드 API URL |
| `NEXT_PUBLIC_FCM_VAPID_KEY` | `BAooQI9Q...` | FCM 웹 푸시 키 |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | `store-fe1d8f6c-...` | PortOne 상점 ID |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | `channel-key-4753ef72-...` | 결제 채널 키 |
| `NEXT_PUBLIC_KG_INICIS_MID` | `MOI1846444` | KG이니시스 MID |

### 5.2 백엔드 (.env — 로컬 개발용)
| 변수명 | 설명 | 비고 |
|--------|------|------|
| `SECRET_KEY` | JWT 서명 키 | 필수. 없으면 폴백 사용 |
| `API_FOOTBALL_KEY` | API-Football 키 (배당 데이터) | 주요 데이터 소스 |
| `FOOTBALL_DATA_API_KEY` | football-data.org 키 (순위) | 보조 데이터 |
| `ODDS_API_KEY` | The Odds API 키 | 교차 검증용 |
| `LIVE_SCORE_API_KEY` | 라이브 스코어 API | 실시간 스코어 |
| `PORTONE_API_SECRET` | 결제 서버 시크릿 | 서버 전용 |

### 5.3 Cloud Run 환경변수 (프로덕션)
**배포 시 환경변수가 소실될 수 있습니다!**
→ 해결: Firestore `system_config/main_config` 문서에 API 키를 영구 저장
→ 앱 시작 시 `config_db.load_config_to_env()`가 자동으로 `os.environ`에 주입

관리 경로: `/api/admin/config` (Admin 인증 필요)

---

## 6. 데이터 흐름: 배당 데이터

```
┌─────────────────┐    30분 간격       ┌──────────────────┐
│  API-Football   │ ──────────────────▶│ pinnacle_service │
│  (외부 API)     │   refresh_odds()   │   .refresh_odds()│
└─────────────────┘                    └────────┬─────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │  1. 인메모리 캐시 저장   │
                                    │  2. Firestore 캐시 저장  │
                                    │     (market_cache/      │
                                    │      odds_snapshot)     │
                                    │  3. 히스토리 스냅샷 저장  │
                                    └───────────┬───────────┘
                                                │
                          사용자 요청 시          │
                          fetch_odds() 호출       ▼
                    ┌─────────────────────────────────────┐
                    │        fetch_odds() 폴백 체인        │
                    │                                      │
                    │  1️⃣ 인메모리 캐시 → 있으면 즉시 반환  │
                    │  2️⃣ Firestore 캐시 → Cold Start 대응  │
                    │  3️⃣ Mock 데이터 → 최종 폴백           │
                    │                                      │
                    │  ⚠️ fetch_odds()는 외부 API 호출 안 함│
                    │  ⚠️ refresh_odds()만 외부 API 호출    │
                    └─────────────────────────────────────┘
```

### 핵심 규칙
- **`fetch_odds()`**: 사용자 요청용. API 토큰 소모 없음. 모든 엔드포인트에서 사용
- **`refresh_odds()`**: 스케줄러 전용. API-Football 호출. `_auto_collect_stats()` 또는 `_periodic_odds_refresh()`에서만 호출
- **❌ `get_cached_odds()`**: 레거시. 인메모리만 확인하므로 Cold Start에서 빈 배열 반환. **사용 금지**

---

## 7. 백엔드 API 라우터 맵

| Prefix | 파일 | 주요 엔드포인트 |
|--------|------|----------------|
| `/api/admin` | admin.py | 관리자 기능, 설정 관리 |
| `/api` | odds.py | `/bets` 배당 목록, `/bets/vote` 투표 |
| `/api/auth` | auth.py | 로그인, 회원가입, Google/Phone 인증 |
| `/api/payments` | payments.py | PortOne 결제, 웹훅 |
| `/api/portfolio` | portfolio.py | 포트폴리오 관리 |
| `/api/market` | market.py | `/pinnacle` 배당 데이터 |
| `/api/scheduler` | scheduler.py | 수동 데이터 수집 트리거 |
| `/api/analysis` | analysis.py | Gemini AI 분석 채팅 |
| `/api/ai` | ai_predictions.py | AI 예측, 매치 상세분석 |
| `/api/prediction` | prediction.py | 예측 슬립 관리 |
| `/api/community` | community.py | 커뮤니티 |
| `/api/tax` | tax.py | 세금 시뮬레이터 |
| `/api/combinator` | combinator.py | 배당 조합 |
| `/api/notifications` | notifications.py | FCM 알림 |
| `/api/vip/combo` | vip_combo.py | VIP 조합 분석 |
| `/api/vip/alerts` | vip_alerts.py | VIP 알림 |
| `/api/vip/portfolio` | vip_portfolio.py | VIP 포트폴리오 |
| `/api/vip/market` | vip_market.py | VIP 배당 급락 감지 |
| `/api/backtest` | backtest.py | 백테스트 |
| `/api/marketing` | marketing.py | Buffer SNS 자동 발행 |

---

## 8. 프론트엔드 페이지 구조

| 경로 | 설명 |
|------|------|
| `/` | 랜딩 페이지 |
| `/market` | 경기 목록 + 투표 (MatchVoting) |
| `/bets` | 배당 분석 |
| `/analysis` | AI 분석 채팅 |
| `/analysis/insights` | AI 인사이트 |
| `/accuracy` | AI 적중률 |
| `/pricing` | 요금제 |
| `/login` | 로그인 |
| `/register` | 회원가입 |
| `/mypage` | 마이페이지 |
| `/admin` | 관리자 대시보드 |
| `/vip/*` | VIP 전용 기능 |
| `/[lang]/*` | 다국어 (21개 언어) |
| `/privacy` | 개인정보처리방침 |
| `/terms` | 이용약관 |
| `/disclaimer` | 면책조항 |

---

## 9. 백그라운드 스케줄러 (main.py startup)

| 스케줄러 | 간격 | 기능 |
|---------|------|------|
| `_auto_collect_stats` | 시작 시 1회 | 전체 데이터 수집 (배당 + AI 통계) |
| `_periodic_odds_refresh` | 매 30분 | API-Football 배당 갱신 |
| `_periodic_settlement` | 매 30분 | 투표 자동 정산 |
| `_periodic_stats_collection` | 12시간 (09:00, 21:00 KST) | 순위/부상/H2H 수집 |
| `_periodic_nightly_retrain` | 매일 03:00 KST | ML 모델 재학습 + 예측 채점 |
| `_periodic_sns_publish` | 매일 10:00, 16:00 KST | Buffer SNS 자동 발행 |

---

## 10. 인증 구조

```
                    프론트엔드 (브라우저)
                         │
         ┌───────────────┼──────────────────┐
         ▼               ▼                  ▼
   Google SignIn    Phone Auth         Email/PW
   (Firebase)      (Firebase)         (자체 API)
         │               │                  │
         ▼               ▼                  ▼
   Firebase ID Token  Firebase ID Token   직접 로그인
         │               │                  │
         └───────┬───────┘                  │
                 ▼                          ▼
         POST /api/auth/google      POST /api/auth/login
         (ID Token → JWT)           (email/pw → JWT)
                 │                          │
                 └──────────┬───────────────┘
                            ▼
                  자체 JWT (localStorage)
                            │
                  모든 API 요청에 Bearer 토큰 포함
                  Authorization: Bearer <jwt>
```

- **JWT 만료**: 24시간
- **SECRET_KEY**: `.env` 또는 Firestore `system_config`에서 로드
- **Firestore 보안 규칙**: `firestore.rules` 참조 (역할 기반 접근 제어)

---

## 11. CORS 허용 도메인

```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",           # 로컬 개발
    "http://127.0.0.1:3000",          # 로컬 개발
    "https://smart-proto-inv-2026.web.app",     # Firebase Hosting
    "https://smart-proto-inv-2026.firebaseapp.com",
    "https://scorenix.com",            # 프로덕션
    "https://www.scorenix.com",        # 프로덕션 (www)
]
```

---

## 12. 주요 서비스 파일 맵

| 서비스 | 파일 | 역할 |
|--------|------|------|
| 배당 수집 | `services/pinnacle_api.py` | API-Football 배당 → Firestore 캐시 |
| 축구 통계 | `services/football_stats_service.py` | API-Football 순위/부상/H2H |
| 리그 순위 | `services/league_standings_service.py` | football-data.org 순위 |
| AI 분석 | `services/gemini_service.py` | Gemini 기반 분석 채팅 |
| 정산 | `services/settlement.py` | 경기 결과 → 투표 정산 |
| 팀 매핑 | `services/team_mapper.py` | 영문 팀명 → 한국어 매핑 |
| ML 학습 | `services/self_learning.py` | LightGBM 모델 재학습 |
| SNS 발행 | `services/buffer_service.py` | Buffer API 연동 |
| 베트맨 크롤링 | `services/crawler_betman.py` | 베트맨 배당 수집 |
| Firestore DB | `models/bets_db.py` | 투표/배당/캐시 CRUD |
| 사용자 DB | `models/user_db.py` | 사용자 CRUD |
| API 키 관리 | `models/config_db.py` | Firestore에서 API 키 로드 |
| Firebase 초기화 | `db/firestore.py` | Admin SDK 싱글톤 |

---

## 13. 로컬 개발 환경

### 백엔드 시작
```powershell
cd c:\Smart_Proto_Investor_Plan\backend
python -m uvicorn app.main:app --reload --port 8000
```

### 프론트엔드 시작
```powershell
cd c:\Smart_Proto_Investor_Plan\frontend
npm run dev
```

### 로컬 → API 연결
- `next.config.ts`의 `rewrites`가 `/api/*` 요청을 `localhost:8000`으로 프록시
- `.env.local`의 `NEXT_PUBLIC_API_URL`을 비워두면 로컬 프록시 사용
- 값이 있으면 직접 해당 URL로 요청 (현재: Cloud Run 직접 연결)

---

## 14. 알려진 위험 & 주의사항

### 🔴 절대 하지 말 것
1. **`NEXT_PUBLIC_API_URL`을 다른 서비스 URL로 변경하지 말 것** — 반드시 `scorenix-backend`
2. **`get_cached_odds()`를 엔드포인트에서 사용하지 말 것** — 항상 `await fetch_odds()` 사용
3. **Cloud Run 배포 시 `api` 또는 `smart-proto-backend`에 배포하지 말 것**
4. **`.env` 파일을 Git에 커밋하지 말 것** — API 키 노출 위험
5. **Firestore `system_config`를 삭제하지 말 것** — 프로덕션 API 키 소실

### 🟡 주의사항
1. Cloud Run은 **콜드 스타트** 가능 — 첫 요청 시 10-30초 지연
2. API-Football은 **일일 100건 제한** (Ultra $29/월 플랜)
3. `npm run build`는 `next build` + SEO 생성 + Buffer 게시 포함
4. Firebase Hosting의 `/api/**` rewrite는 Cloud Functions를 가리키지만, 현재 프론트엔드는 `NEXT_PUBLIC_API_URL`로 Cloud Run에 직접 연결

### 🟢 자동 복구 메커니즘
1. 서버 시작 시 `config_db.load_config_to_env()` → Firestore에서 API 키 자동 로드
2. `fetch_odds()` 3단계 폴백 → 인메모리 → Firestore → Mock
3. `_auto_collect_stats()` → 시작 1초 후 자동 데이터 수집
4. `_periodic_odds_refresh()` → 30분마다 자동 갱신

---

## 15. gcloud CLI 경로 (Windows)

```
C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd
```

PowerShell에서 사용:
```powershell
$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
gcloud --version
```

---

## 16. 버전 관리 및 클라우드 백업 (GitHub)

- **원격 저장소**: `https://github.com/onestopbeolcho/betmansport.git`
- **배경**: AI 에이전트의 치명적 코드 덮어쓰기나 로컬 스토리지 장애로부터 프로젝트 전체 자산을 보호하기 위함입니다.
- **기본 방침**: 대규모 기능 업데이트나 인프라, `AGENTS.md` 등의 규칙 변경 시 **작업 종료 전 반드시 GitHub로 코드를 푸시(push)**하여 복구 지점을 확보해야 합니다.
