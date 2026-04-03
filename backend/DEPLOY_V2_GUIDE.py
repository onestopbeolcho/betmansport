"""
V2 데이터 업그레이드 활성화 가이드
===================================

이 파일은 배포 시 참고용입니다. 실행하지 마세요.
다음 주 배포 시 아래 변경사항을 적용하면 됩니다.


1. main.py — xG 엔드포인트 등록
---------------------------------
기존:
  from app.api.endpoints import scheduler
  app.include_router(scheduler.router, prefix="/api/scheduler", tags=["scheduler"])

추가:
  from app.api.endpoints import xg
  app.include_router(xg.router, prefix="/api/xg", tags=["xg"])


2. football_stats_service.py — 리그 확장
------------------------------------------
LEAGUE_MAP을 LEAGUE_MAP_V2로 교체:

  # 변경 전
  LEAGUE_MAP = {
      "soccer_epl": 39,
      ...
  }

  # 변경 후
  LEAGUE_MAP = LEAGUE_MAP_V2


3. pinnacle_api.py — 스포츠 확장
----------------------------------
target_sports를 target_sports_v2로 교체:

  # __init__ 마지막에
  self.target_sports = self.target_sports_v2


4. scheduler.py — xG 수집 스케줄 추가
-----------------------------------------
nightly retrain 함수에 xG 수집 추가:

  from app.services.understat_xg_service import understat_service

  # trigger_nightly_retrain.run_pipeline() 안에:
  await understat_service.collect_all_leagues()


5. ml_predictor.py — V2 피처 스토어 전환  
------------------------------------------
  # 변경 전
  from app.services.feature_store import extract_features_with_odds, get_feature_names

  # 변경 후
  from app.services.feature_store_v2 import extract_features_v2 as extract_features_with_odds
  from app.services.feature_store_v2 import get_feature_names_v2 as get_feature_names

  ⚠️ 주의: V2 피처를 사용하면 기존 학습 모델과 피처 수가 달라져
  모델 재학습(trigger_initial_training)이 필요합니다!


6. API-Football 한도 관리
---------------------------
현재: 100건/일 × 6개 리그 = 여유 있음
V2:   100건/일 × 11개 리그 = 부족할 수 있음

대책 A: API-Football 유료 전환 ($9.99/월 → 1,000건/일)
대책 B: 수집 빈도를 2일 1회로 줄임
대책 C: 신규 리그는 Understat xG만으로 커버
"""
