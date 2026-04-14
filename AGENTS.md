# Scorenix 프로젝트 AI 에이전트 규칙

## 🔴 필수 규칙 (반드시 준수)

### 작업 전 필수 참조
- **모든 코드 수정 또는 배포 작업 전에** 반드시 `ARCHITECTURE.md`와 `CHANGELOG.md`(또는 컨퍼런스 기록) 파일을 읽으세요.
- 이 파일들에는 프로덕션 서비스 URL, 환경변수, 핵심 히스토리 및 최신 수정 내역 등 핵심 정보가 있습니다.

### 배포 규칙
- 백엔드 배포는 **반드시 `scorenix-backend` Cloud Run 서비스**에 합니다.
- `api`, `smart-proto-backend` 등 다른 서비스에 배포하지 마세요.
- 배포 명령: `/deploy-backend` 워크플로우를 사용하세요.
- GCP 프로젝트 ID: `smart-proto-inv-2026`
- 리전: `asia-northeast3`

### 소스 코드 버전 관리 및 백업
- 현재 프로젝트는 GitHub 저장소(`https://github.com/onestopbeolcho/betmansport`)에 연결되어 있습니다.
- 모든 주요 변경이나 위험한 작업 이후에는 반드시 `git add, commit, push`를 수행하여 안전하게 백업 및 롤백 포인트를 마련하세요.

### 프론트엔드 API 연결
- `NEXT_PUBLIC_API_URL`은 `https://scorenix-backend-n5dv44kdaa-du.a.run.app`입니다.
- 이 값은 **절대 변경하지 마세요**.

### 데이터 로딩 패턴
- 배당 데이터 접근 시 `await pinnacle_service.fetch_odds()`를 사용하세요.
- `get_cached_odds()`는 **사용 금지** — Cold Start 시 빈 배열을 반환합니다.

### 환경변수
- Cloud Run의 환경변수는 Firestore `system_config/main_config`에서 자동 로드됩니다.
- `.env` 파일은 로컬 개발 전용입니다.
