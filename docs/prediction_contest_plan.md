# 🏆 Scorenix Prediction Contest System — 종합 기획서
> 사용자 간 경기 결과 예측 경쟁 + 보상 시스템
> 작성일: 2026-02-23

---

## 📌 1. 개요

### 목적
- **유저 리텐션 극대화**: 매일 플랫폼에 돌아올 이유 제공
- **커뮤니티 형성**: 사용자 간 경쟁 → 소속감 → 바이럴
- **구독 전환 유도**: 무료 유저 → Pro 구독 전환율 향상
- **데이터 자산화**: 집단지성 예측 데이터 수집 → AI 학습에 활용 가능

### 핵심 컨셉
> "AI 예측과 겨루는 유저 예측 대회"
> - AI가 예측한 결과 vs 유저가 예측한 결과, 누가 더 정확한가?
> - 유저들 간 랭킹 경쟁으로 게임화

### 법적 안전성
| 항목 | 상태 | 근거 |
|------|------|------|
| 실제 금전 미관여 | ✅ 합법 | 포인트/쿠폰 보상 → 도박에 해당하지 않음 |
| 예측 게임 형태 | ✅ 합법 | Fantasy/Pick'em 유형, 전 세계적으로 합법 |
| 구독권 보상 | ✅ 합법 | 자사 서비스 내 혜택 제공 |
| 지역 제한 | ⚠️ 확인 필요 | 일부 국가 Fantasy Sports 규제 확인 |

---

## 🎮 2. 시스템 설계

### 2.1 예측 유형 (3단계)

#### 🟢 Level 1: 기본 예측 (무료 회원도 참여 가능)
```
┌─────────────────────────────────────┐
│  맨시티 vs 아스널                     │
│  ────────────────────────────       │
│  ⚽ 승패 예측:                       │
│  [ 🏠 홈승 ]  [ 🤝 무승부 ]  [ ✈️ 원정승 ]  │
│                                     │
│  📊 AI 예측: 홈승 62% | 무 21% | 원정 17% │
│  👥 유저 예측: 홈승 71% | 무 15% | 원정 14% │
│                                     │
│  ⏰ 마감: 경기 시작 1시간 전           │
└─────────────────────────────────────┘
```
- **예측 대상**: 홈승 / 무승부 / 원정승 (1X2)
- **보상 포인트**: 정답 시 +3 SP (Scorenix Points)
- **참여 제한**: 1일 최대 5경기 (Free), 무제한 (Pro/VIP)

#### 🟡 Level 2: 정밀 예측 (Pro 이상)
```
┌─────────────────────────────────────┐
│  리버풀 vs 첼시                      │
│  ────────────────────────────       │
│  📊 정확한 스코어 예측:               │
│  홈: [ 2 ]  -  원정: [ 1 ]           │
│                                     │
│  ⚽ 총 골 수 예측:                   │
│  [ O 2.5 Over ]  [ U 2.5 Under ]    │
│                                     │
│  🎯 첫 골 팀:                       │
│  [ 🏠 홈팀 ]  [ ✈️ 원정팀 ]  [ 무골 ]  │
└─────────────────────────────────────┘
```
- **정확 스코어**: 적중 시 +10 SP
- **오버/언더**: 적중 시 +3 SP
- **첫 골 팀**: 적중 시 +5 SP

#### 🔴 Level 3: 스페셜 챌린지 (VIP 또는 특별 이벤트)
- **주간 챌린지**: "이번 주 EPL 6경기 모두 맞혀라" → 올 클리어 시 +100 SP
- **AI 도전**: AI 예측과 직접 대결 → AI를 이기면 +20 SP
- **시즌 챔피언**: 시즌 누적 1위 → 특별 보상

---

### 2.2 포인트 시스템 (Scorenix Points = SP)

#### SP 획득 방법
| 행동 | 포인트 | 조건 |
|------|--------|------|
| 1X2 적중 | +3 SP | 모든 유저 |
| 골 차이 적중 | +5 SP | Pro+ |
| 정확 스코어 적중 | +10 SP | Pro+ |
| 첫 골 팀 적중 | +5 SP | Pro+ |
| O/U 적중 | +3 SP | Pro+ |
| 연속 적중 보너스 | +2 SP/연속 | 3연속부터 |
| 주간 챌린지 클리어 | +100 SP | 이벤트 |
| AI 대결 승리 | +20 SP | Pro+ |
| 일일 로그인 | +1 SP | 모든 유저 |
| 첫 예측 참여 | +10 SP | 1회성 |
| 친구 초대 (추천인) | +50 SP | 추천인 등록 시 |

#### 연속 적중 보너스 (Streak System)
```
1~2 연속: 기본 포인트만
3연속: +2 SP 보너스 (🔥)
5연속: +5 SP 보너스 (🔥🔥)
10연속: +15 SP 보너스 (🔥🔥🔥) + 특별 배지
20연속: +50 SP 보너스 (💎) + "Oracle" 칭호
```

#### SP 사용 방법 (보상)
| 보상 | 필요 SP | 설명 |
|------|---------|------|
| 🥉 Pro 3일 이용권 | 100 SP | Free 유저 전용 |
| 🥈 Pro 7일 이용권 | 200 SP | Free 유저 전용 |
| 🥇 Pro 30일 이용권 | 500 SP | Free 유저 전용 |
| ⭐ VIP 7일 이용권 | 500 SP | Pro 유저 전용 |
| 🎨 프리미엄 프로필 배지 | 50 SP | 전 유저 |
| 📊 AI 심층 분석 1회 | 30 SP | 전 유저 |
| 🏆 시즌 랭킹 부스트 | 100 SP | 전 유저 (랭킹 보너스 x1.5, 1주) |

---

### 2.3 랭킹 & 리더보드

#### 랭킹 종류
```
┌───────────────────────────────────────────────┐
│ 🏆 리더보드                                    │
│ ┌────────────────────────────────────────────┐│
│ │ 📅 일간  │  📆 주간  │  📊 월간  │  🏆 시즌  ││
│ └────────────────────────────────────────────┘│
│                                               │
│  # │ 유저        │ 적중률  │ SP   │ 연속  │ 등급 │
│ ───┼────────────┼────────┼──────┼──────┼──── │
│  1 │ 🥇 ProBet  │ 72.3%  │ 1,240│ 🔥 7 │ 💎  │
│  2 │ 🥈 SoccerK │ 68.1%  │ 1,180│ 🔥 4 │ ⭐  │
│  3 │ 🥉 DataKing│ 65.7%  │ 1,050│ 🔥 3 │ ⭐  │
│  4 │    GoalMstr │ 64.2%  │   980│      │ 🎯  │
│  5 │    FutbolAI │ 63.8%  │   920│ 🔥 2 │ 🎯  │
│ ───┼────────────┼────────┼──────┼──────┼──── │
│ 🤖 │ Scorenix AI│ 61.5%  │  -   │      │ 🤖  │
│ ───┼────────────┼────────┼──────┼──────┼──── │
│ 42 │ 🔵 나       │ 58.3%  │   320│      │ 📊  │
└───────────────────────────────────────────────┘
```

#### 등급 시스템 (Tier)
| 등급 | 아이콘 | 조건 | 혜택 |
|------|--------|------|------|
| Bronze | 🥉 | 가입 시 | 기본 참여 |
| Silver | 🥈 | 100 SP 누적 | 프로필 배지 |
| Gold | 🥇 | 500 SP 누적 | 주간 보너스 SP |
| Diamond | 💎 | 2,000 SP 누적 | 월간 Pro 이용권 자동 지급 |
| Master | 👑 | 5,000 SP + 적중률 65%+ | VIP 이용권 + "공식 예측가" 칭호 |

---

### 2.4 AI 대결 모드 (핵심 차별화)

```
┌─────────────────────────────────────────────┐
│ 🤖 vs 🧠  AI Challenge                      │
│ ─────────────────────────────────────       │
│                                             │
│  이번 라운드: EPL Matchday 28                │
│  대상 경기: 10경기                           │
│                                             │
│  ┌────────────────┬────────────────┐        │
│  │ 🤖 Scorenix AI │ 🧠 나의 예측   │        │
│  ├────────────────┼────────────────┤        │
│  │ MCI 2-1 ARS ✅ │ MCI 1-0 ARS ❌ │        │
│  │ LIV 3-0 CHE ✅ │ LIV 2-1 CHE ✅ │        │
│  │ MUN 1-1 TOT ❌ │ MUN 0-2 TOT ✅ │        │
│  │ ...            │ ...            │        │
│  ├────────────────┼────────────────┤        │
│  │ 적중: 7/10     │ 적중: 6/10     │        │
│  │ 점수: 28 SP    │ 점수: 24 SP    │        │
│  └────────────────┴────────────────┘        │
│                                             │
│  📊 역대 전적: You 12승 / AI 18승 / 무 5회   │
│  🔥 이번 주 AI를 이긴 유저: 23명 (상위 8.2%)  │
└─────────────────────────────────────────────┘
```

**왜 차별화인가?**
- "AI를 이겨라" → 강력한 도전 동기
- AI 적중률이 투명하게 공개 → 플랫폼 신뢰도 증가
- AI를 이긴 유저 = 실력 증명 → 커뮤니티 내 명성
- 마케팅 소재: "우리 AI를 이긴 유저 TOP 10"

---

## 🗄️ 3. 데이터베이스 설계 (Firestore)

### 3.1 컬렉션 구조

```
firestore/
├── predictions/                    # 개별 예측 기록
│   └── {predictionId}
│       ├── userId: string
│       ├── matchId: string
│       ├── matchName: string       # "Man City vs Arsenal"
│       ├── league: string          # "EPL"
│       ├── kickoffTime: timestamp
│       ├── predictionType: string  # "1X2" | "EXACT_SCORE" | "OVER_UNDER" | "FIRST_GOAL"
│       ├── prediction: object
│       │   ├── outcome: string     # "HOME" | "DRAW" | "AWAY"
│       │   ├── homeScore: number   # (정밀 예측 시)
│       │   ├── awayScore: number
│       │   └── overUnder: string   # "OVER" | "UNDER"
│       ├── aiPrediction: object    # 동일 시점 AI 예측 스냅샷
│       ├── result: string          # "PENDING" | "CORRECT" | "INCORRECT"
│       ├── actualScore: object     # { home: 2, away: 1 }
│       ├── pointsEarned: number
│       ├── createdAt: timestamp
│       └── settledAt: timestamp
│
├── userStats/                      # 유저별 통계 (실시간 업데이트)
│   └── {userId}
│       ├── displayName: string
│       ├── profileBadge: string
│       ├── title: string           # "Oracle", "공식 예측가" 등
│       ├── tier: string            # "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "MASTER"
│       ├── totalPoints: number
│       ├── availablePoints: number # (사용 가능 SP)
│       ├── totalPredictions: number
│       ├── correctPredictions: number
│       ├── accuracy: number        # 적중률 (%)
│       ├── currentStreak: number   # 현재 연속
│       ├── bestStreak: number      # 최고 연속
│       ├── vsAiWins: number        # AI 대결 승리 횟수
│       ├── vsAiLosses: number
│       ├── weeklyPoints: number    # 주간 포인트 (매주 월요일 리셋)
│       ├── monthlyPoints: number   # 월간 포인트
│       └── updatedAt: timestamp
│
├── leaderboards/                   # 리더보드 (Cloud Function으로 주기적 계산)
│   ├── daily/
│   │   └── {date}
│   │       └── rankings: array[{userId, points, accuracy, rank}]
│   ├── weekly/
│   │   └── {weekId}
│   ├── monthly/
│   │   └── {monthId}
│   └── season/
│       └── {seasonId}
│
├── challenges/                     # 주간/특별 챌린지
│   └── {challengeId}
│       ├── title: string           # "EPL Matchday 28 올 클리어"
│       ├── type: string            # "WEEKLY" | "AI_BATTLE" | "SPECIAL"
│       ├── matches: array[matchId]
│       ├── rewardPoints: number
│       ├── startDate: timestamp
│       ├── endDate: timestamp
│       ├── participants: number
│       └── completedBy: array[userId]
│
└── rewards/                        # 보상 교환 기록
    └── {rewardId}
        ├── userId: string
        ├── rewardType: string      # "PRO_3DAY" | "PRO_7DAY" | "BADGE" | "AI_ANALYSIS"
        ├── pointsSpent: number
        ├── status: string          # "PENDING" | "APPLIED" | "EXPIRED"
        ├── appliedAt: timestamp
        └── expiresAt: timestamp
```

### 3.2 보안 규칙 (Firestore Rules)
```javascript
// predictions: 본인 것만 생성, 경기 시작 전만 가능
// userStats: 본인 것만 읽기 (쓰기는 Cloud Function만)
// leaderboards: 모든 유저 읽기 가능 (쓰기는 Cloud Function만)
// rewards: 본인 것만 읽기/생성 (상태 변경은 Cloud Function만)
```

---

## 🔧 4. 기술 아키텍처

```
┌──────────────────────────────────────────────────┐
│                    Frontend (Next.js)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ 예측 카드 │  │ 리더보드 │  │ 보상 교환소   │   │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │               │            │
└───────┼──────────────┼───────────────┼────────────┘
        │              │               │
┌───────▼──────────────▼───────────────▼────────────┐
│              Firebase / Backend                    │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Firestore DB  │  │ Cloud Functions           │  │
│  │ - predictions │  │ - settlePredictions()     │  │
│  │ - userStats   │  │   (경기 종료 후 자동 정산) │  │
│  │ - leaderboards│  │ - updateLeaderboard()     │  │
│  │ - challenges  │  │   (매일 00:00 재계산)      │  │
│  │ - rewards     │  │ - processReward()          │  │
│  └──────────────┘  │   (보상 교환 처리)          │  │
│                     │ - createDailyChallenge()    │  │
│                     │   (매일 챌린지 자동 생성)    │  │
│                     └──────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ FastAPI Backend (기존)                         │ │
│  │ - /api/matches → 경기 목록 제공               │ │
│  │ - /api/predictions → 예측 데이터 AI 분석과 연동│ │
│  │ - /api/odds → 실시간 배당률 제공              │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 자동 정산 플로우
```
1. 경기 종료 → API-Football에서 최종 스코어 수신
2. Cloud Function 트리거 (Pub/Sub 또는 Scheduler)
3. 해당 경기의 모든 predictions 조회
4. 각 예측에 대해:
   - 결과 판정 (CORRECT / INCORRECT)
   - 포인트 계산 (기본 + 연속 보너스)
   - userStats 업데이트 (적중률, 포인트, 연속 기록)
5. 리더보드 재계산
6. 챌린지 완료 확인
```

---

## 📱 5. 프론트엔드 페이지 설계

### 5.1 필요한 페이지
| 페이지 | 경로 | 설명 |
|--------|------|------|
| 예측 메인 | `/[lang]/predict` | 오늘의 예측 가능 경기 목록 |
| 예측 상세 | `/[lang]/predict/[matchId]` | 개별 경기 예측 입력 |
| 리더보드 | `/[lang]/leaderboard` | 일간/주간/월간/시즌 랭킹 |
| 내 기록 | `/[lang]/mypage/predictions` | 내 예측 히스토리 + 통계 |
| 보상 교환소 | `/[lang]/rewards` | SP → 구독권/배지 교환 |
| AI 대결 | `/[lang]/predict/challenge` | 주간 AI 챌린지 |

### 5.2 네비바 메뉴 추가
```
기존:  Home | Value Bet | AI Predict | Portfolio | Guide
추가:  Home | Value Bet | AI Predict | 🏆 Predict | Portfolio | Guide
```

---

## 📊 6. 비즈니스 임팩트 예측

### 기대 효과
| 지표 | 현재 (추정) | 목표 (3개월 후) | 근거 |
|------|------------|----------------|------|
| DAU (일일 활성) | ~50 | ~300+ | 예측 참여 = 매일 방문 동기 |
| 평균 체류 시간 | ~3분 | ~10분+ | 예측 + 리더보드 확인 |
| Free → Pro 전환 | ~3% | ~12%+ | Level 2 참여 욕구 + SP 보상 |
| 유저 리텐션 (30일) | ~15% | ~45%+ | 연속 기록 + 랭킹 유지 |
| 바이럴 계수 | 0.1 | 0.5+ | "나 이번 주 10연속!" 공유 |

### 수익 모델 연계
```
Free 유저 → Level 1 참여 → "Level 2도 하고 싶다!"
  → Pro 구독 or SP 500개 모으기 (약 2-3주 소요)
     → Pro 체험 후 유지율 높음 (가치 체감)
        → 정기 구독 전환
```

---

## 🗓️ 7. 구현 로드맵

### Phase 1 — MVP (1주)
- [ ] Firestore 컬렉션 설계 & 보안 규칙
- [ ] 예측 입력 UI (1X2 기본 예측)
- [ ] 예측 저장 API (Firestore 직접 or FastAPI)
- [ ] 기본 리더보드 (일간/주간)
- [ ] SP 포인트 표시 (Navbar 또는 MyPage)

### Phase 2 — 핵심 기능 (1주)
- [ ] 자동 정산 시스템 (Cloud Function / Scheduler)
- [ ] 연속 적중 보너스 로직
- [ ] AI 대결 모드 UI + 결과 비교
- [ ] Level 2 정밀 예측 (Pro 전용)
- [ ] 보상 교환소 페이지

### Phase 3 — 게임화 강화 (1주)
- [ ] 등급 시스템 (Bronze → Master)
- [ ] 주간 챌린지 자동 생성
- [ ] 프로필 배지 시스템
- [ ] 예측 공유 (SNS 공유 카드 이미지 생성)
- [ ] 푸시 알림 (경기 시작 1시간 전 리마인더)

### Phase 4 — 고도화 (2주)
- [ ] 리그별 리더보드 세분화
- [ ] 친구 기능 (팔로우 / 예측 비교)
- [ ] 시즌 챔피언십 (시즌 종료 시 최종 랭킹)
- [ ] 토너먼트 모드 (16강/8강/4강 대결)
- [ ] SP → 외부 보상 연동 (기프트카드 등 — 법적 검토 후)

---

## ⚠️ 8. 리스크 & 고려사항

| 리스크 | 대응 방안 |
|--------|----------|
| 복수 계정 어뷰징 | Firebase Auth 전화번호 인증 필수, IP 모니터링 |
| 봇 자동 예측 | CAPTCHA 도입, 예측 제출 속도 제한 |
| SP 인플레이션 | 보상 가격 동적 조정, 주기적 리밸런싱 |
| 경기 취소/연기 시 | 자동 환불 (예측 무효화 + SP 반환) |
| 법적 도박 해당 여부 | 현금 교환 절대 불가, 자사 서비스 내 혜택만 |
| 서버 부하 (경기 직전 몰림) | Firestore 배치 쓰기, 예측 마감 시간 분산 |

---

## 🔑 9. 핵심 성공 요소

1. **즉시 참여 가능한 간결함**: 홈승/무/원정승 한 번의 탭으로 예측 완료
2. **실시간 피드백**: 경기 중 내 예측 상태 표시 (맞아가고 있는지)
3. **사회적 증명**: 리더보드 + "이번 주 예측왕" 배너
4. **AI와의 경쟁**: 자사 AI 대비 성과 = 자랑거리
5. **보상의 체감 가치**: Pro 구독권 = 실질적 혜택 (SP가 진짜 가치 있음)

---

## 📝 10. 다국어 지원

기존 21개 언어 i18n 시스템에 예측 관련 키 추가:
```json
{
  "predict": {
    "title": "Match Predictions",
    "subtitle": "Predict match results and earn Scorenix Points",
    "homeWin": "Home Win",
    "draw": "Draw",
    "awayWin": "Away Win",
    "submitPrediction": "Submit Prediction",
    "deadline": "Closes before kickoff",
    "aiPrediction": "AI Prediction",
    "userPrediction": "Community Prediction",
    "leaderboard": "Leaderboard",
    "myPredictions": "My Predictions",
    "streak": "Streak",
    "accuracy": "Accuracy",
    "pointsEarned": "Points Earned",
    "rewardShop": "Reward Shop",
    "challengeAI": "Challenge AI"
  }
}
```
