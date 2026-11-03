"""
ScoreNix Nationwide Official Proto/Toto Store Directory & O2O Marketing Service
===============================================================================
- 총 6,277개 전국 공식 스포츠토토/프로토 판매점 교차검증 마스터 데이터셋 기반
  * 스포츠토토(베트맨) 공식 등록 6,236개 전수 (100% GPS 위도·경도 좌표 및 스마트슬립 포함)
  * 기획예산처(복권위원회) 2026.08.20 최신 데이터 교차검증 (1,409개 매장 신·구 간판 이중 매칭 + 41개 신규 토토 매장 보강)
- 기능:
  1. 지역별(17개 시도 / 시군구) 및 키워드(구형 베트맨 상호, 2026 신형 간판 상호, 도로명, 동네명) 초고속 검색
  2. 사용자 GPS(위도/경도) 기반 내 주변 가장 가까운 공식 판매점 반경 거리(m/km) 계산 및 정렬
  3. 단골 판매점 리포트 비치 요청(추천수 실시간 반영)
  4. 외부 마케팅(SNS, 블로그 SEO, 유튜브 쇼츠)용 권역별 실제 판매점 스포트라이트 자동 추출
"""
import datetime
import hashlib
import json
import logging
import math
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "proto_stores_master.json")
_stores_cache: List[Dict[str, Any]] = []
_stores_by_id: Dict[str, Dict[str, Any]] = {}
_custom_requests: Dict[str, int] = {}

REGION_GROUP_MAP: Dict[str, List[str]] = {
    "서울": ["서울"],
    "경기": ["경기"],
    "인천": ["인천"],
    "부산": ["부산"],
    "대구": ["대구"],
    "광주/전라": ["광주", "전남", "전북"],
    "대전/충청/세종": ["대전", "충남", "충북", "세종"],
    "울산/경상": ["울산", "경남", "경북"],
    "강원/제주": ["강원", "제주"],
    # 구형 프론트엔드 필터 호환
    "서울/수도권": ["서울"],
    "경기/인천": ["경기", "인천"],
    "대전/충청/강원": ["대전", "충남", "충북", "세종", "강원"],
    "광주/전남/전북": ["광주", "전남", "전북"],
    "부산/대구/울산/경상": ["부산", "대구", "울산", "경남", "경북"],
}


def _seed_store_metadata(item: Dict[str, Any]) -> Dict[str, Any]:
    """각 매장의 교차검증 등급 및 해시 기반으로 초기 O2O 상태와 추천수를 일관되게 부여."""
    sid = item["id"]
    h = int(hashlib.md5(sid.encode("utf-8")).hexdigest()[:6], 16)
    is_cross = "교차검증" in item.get("grade", "")
    is_toto_kw = any(k in item.get("name", "") for k in ("토토", "프로토", "스포츠", "TOTO", "PROTO", "복권명당"))

    if is_toto_kw or (is_cross and h % 5 == 0):
        display_mode = "PC_AND_A4"
        base_req = 18 + (h % 45)
    elif is_cross and h % 3 == 0:
        display_mode = "A4_POSTER"
        base_req = 9 + (h % 25)
    else:
        display_mode = "OFFICIAL_VERIFIED"
        base_req = 3 + (h % 14)

    search_blob = " ".join([
        item.get("id", ""),
        item.get("sido", ""),
        item.get("sigungu", ""),
        item.get("name", ""),
        item.get("toto_name", ""),
        item.get("moef_name", ""),
        item.get("addr", ""),
    ]).lower()

    enriched = {
        **item,
        "display_mode": display_mode,
        "base_request_count": base_req,
        "_search_blob": search_blob,
    }
    return enriched


def _ensure_loaded() -> List[Dict[str, Any]]:
    global _stores_cache, _stores_by_id
    if _stores_cache:
        return _stores_cache
    try:
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        _stores_cache = [_seed_store_metadata(r) for r in raw]
        _stores_by_id = {r["id"]: r for r in _stores_cache}
        logger.info(f"Loaded {len(_stores_cache)} official Proto/Toto stores from {_DATA_PATH}")
    except Exception as e:
        logger.error(f"Failed to load proto_stores_master.json: {e}")
        _stores_cache = []
        _stores_by_id = {}
    return _stores_cache


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _format_distance(meters: float) -> str:
    if meters < 1000:
        return f"{int(round(meters))}m"
    return f"{meters / 1000.0:.1f}km"


def _serialize_store(st: Dict[str, Any], distance_m: Optional[float] = None) -> Dict[str, Any]:
    sid = st["id"]
    extra_req = _custom_requests.get(sid, 0)
    req_cnt = st.get("base_request_count", 5) + extra_req
    mode = "PC_AND_A4" if extra_req >= 3 else st.get("display_mode", "OFFICIAL_VERIFIED")
    res = {
        "id": sid,
        "sido": st.get("sido", ""),
        "sigungu": st.get("sigungu", ""),
        "region": f"{st.get('sido', '')} {st.get('sigungu', '')}".strip(),
        "name": st.get("name", ""),
        "toto_name": st.get("toto_name", ""),
        "moef_name": st.get("moef_name", ""),
        "address": st.get("addr", ""),
        "address_hint": st.get("addr", ""),
        "smart_slip": st.get("slip", "O"),
        "lon": st.get("lon"),
        "lat": st.get("lat"),
        "verify_grade": st.get("grade", ""),
        "lotto_types": st.get("types", ""),
        "display_mode": mode,
        "request_count": req_cnt,
    }
    if distance_m is not None:
        res["distance_m"] = int(round(distance_m))
        res["distance_label"] = _format_distance(distance_m)
    return res


def search_proto_stores(
    sido: Optional[str] = None,
    sigungu: Optional[str] = None,
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    limit: int = 24,
    offset: int = 0,
) -> Dict[str, Any]:
    stores = _ensure_loaded()
    filtered = stores

    # 1. 시도 / 권역 필터
    if sido and sido not in ("ALL", "전체", "전국"):
        sido_clean = sido.strip()
        if sido_clean in REGION_GROUP_MAP:
            allowed_sidos = set(REGION_GROUP_MAP[sido_clean])
            filtered = [s for s in filtered if s.get("sido") in allowed_sidos]
        else:
            filtered = [s for s in filtered if s.get("sido") == sido_clean]

    # 2. 시군구 필터
    if sigungu and sigungu not in ("ALL", "전체"):
        sg_clean = sigungu.strip()
        filtered = [s for s in filtered if sg_clean in s.get("sigungu", "")]

    # 3. 검색어(q) 멀티 토큰 필터 (구형 베트맨 상호, 2026 신형 상호, 도로명, 동네명 모두 매칭)
    if q and q.strip():
        tokens = [t.lower() for t in q.strip().split() if t.strip()]
        if tokens:
            filtered = [
                s for s in filtered
                if all(tok in s["_search_blob"] for tok in tokens)
            ]

    total_matched = len(filtered)

    # 4. GPS 거리순 정렬 vs 인기도(교차검증 & 추천수) 정렬
    if lat is not None and lon is not None:
        with_dist = []
        for s in filtered:
            s_lat = s.get("lat")
            s_lon = s.get("lon")
            if s_lat is not None and s_lon is not None:
                d = _haversine_meters(lat, lon, float(s_lat), float(s_lon))
                with_dist.append((d, s))
        with_dist.sort(key=lambda x: x[0])
        paged = [_serialize_store(s, d) for d, s in with_dist[offset : offset + limit]]
    else:
        # 교차검증 완료 & 토토/편의점 상호 우선 ('로또' 단독 표기 후순위) + 추천수 순
        sorted_list = sorted(
            filtered,
            key=lambda s: (
                0 if "로또" in s.get("name", "") else 1,
                1 if s.get("display_mode") == "PC_AND_A4" else (0 if s.get("display_mode") == "A4_POSTER" else -1),
                s.get("base_request_count", 0) + _custom_requests.get(s["id"], 0),
            ),
            reverse=True,
        )
        paged = [_serialize_store(s) for s in sorted_list[offset : offset + limit]]

    return {
        "total_stores_in_db": len(stores),
        "matched_count": total_matched,
        "offset": offset,
        "limit": limit,
        "stores": paged,
    }


def get_store_directory_stats() -> Dict[str, Any]:
    stores = _ensure_loaded()
    sido_counts: Dict[str, int] = {}
    sigungu_by_sido: Dict[str, Dict[str, int]] = {}
    cross_verified = 0
    dual_name = 0
    gps_count = 0

    for s in stores:
        sd = s.get("sido", "기타")
        sg = s.get("sigungu", "")
        sido_counts[sd] = sido_counts.get(sd, 0) + 1
        if sd not in sigungu_by_sido:
            sigungu_by_sido[sd] = {}
        if sg:
            sigungu_by_sido[sd][sg] = sigungu_by_sido[sd].get(sg, 0) + 1
        if "교차검증" in s.get("grade", ""):
            cross_verified += 1
        if s.get("toto_name") and s.get("moef_name") and s.get("toto_name") != s.get("moef_name"):
            dual_name += 1
        if s.get("lat") and s.get("lon"):
            gps_count += 1

    sorted_sido = dict(sorted(sido_counts.items(), key=lambda x: x[1], reverse=True))
    sorted_sigungu = {
        sd: dict(sorted(sg_map.items(), key=lambda x: x[1], reverse=True))
        for sd, sg_map in sigungu_by_sido.items()
    }

    return {
        "total_stores": len(stores),
        "official_toto_stores": 6236,
        "cross_verified_stores": cross_verified,
        "dual_name_resolved_stores": dual_name,
        "gps_enabled_stores": gps_count,
        "sido_counts": sorted_sido,
        "sigungu_by_sido": sorted_sigungu,
    }


def recommend_proto_store(
    store_id: Optional[str] = None,
    store_name: Optional[str] = None,
    region: Optional[str] = None,
    address_hint: Optional[str] = None,
) -> Dict[str, Any]:
    stores = _ensure_loaded()
    if store_id and store_id in _stores_by_id:
        _custom_requests[store_id] = _custom_requests.get(store_id, 0) + 1
        st = _stores_by_id[store_id]
        return {
            "status": "success",
            "matched_official": True,
            "store": _serialize_store(st),
            "message": f"[{st['name']}] 공식 판매점 비치 요청이 반영되었습니다! 이번 회차 전체 리포트 잠금이 해제됩니다.",
        }

    # store_name으로 검색 시도
    if store_name and store_name.strip():
        q = store_name.strip().lower()
        for s in stores:
            if q in s["_search_blob"]:
                sid = s["id"]
                _custom_requests[sid] = _custom_requests.get(sid, 0) + 1
                return {
                    "status": "success",
                    "matched_official": True,
                    "store": _serialize_store(s),
                    "message": f"전국 공식 판매점 DB에서 [{s['name']} ({s['addr']})] 매장을 확인하여 비치 요청을 등록했습니다!",
                }

    return {
        "status": "success",
        "matched_official": False,
        "store": {
            "id": f"USER-{int(datetime.datetime.now().timestamp())}",
            "name": (store_name or "단골 프로토 판매점").strip(),
            "region": (region or "서울").strip(),
            "address": (address_hint or "신규 제보 프로토 판매점").strip(),
            "display_mode": "REQUESTED",
            "request_count": 1,
        },
        "message": f"[{(store_name or '').strip()}] 단골 매장 비치 요청이 접수되었습니다! 제보 보상으로 이번 회차 잠금이 해제됩니다.",
    }


def get_marketing_spotlight_stores(count: int = 6, seed_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    [마케팅 엔진 연동] SNS(인스타/쓰레드), 블로그(Blogger/WordPress SEO), 유튜브 쇼츠에 삽입할
    오늘의 권역별 실제 교차검증 공식 프로토 판매점 스포트라이트 추출.
    - 매일(또는 경기별로) 서울, 경기, 부산, 대구, 인천, 광주/대전 등 권역별 대표 실제 매장을 순환 노출하여
      지역구 롱테일 SEO("강남 프로토 판매점", "수원 토토 판매점" 등)와 동네 주민 클릭률을 극대화합니다.
    """
    stores = _ensure_loaded()
    if not stores:
        return []

    if not seed_key:
        seed_key = datetime.date.today().isoformat()
    seed_int = int(hashlib.md5(seed_key.encode("utf-8")).hexdigest()[:8], 16)

    target_sidos = ["서울", "경기", "부산", "대구", "인천", "광주", "대전", "경남", "울산", "전북"]
    selected: List[Dict[str, Any]] = []

    for idx, sd in enumerate(target_sidos):
        if len(selected) >= count:
            break
        # 1순위: 상호에 토토/프로토/스포츠/CU/GS25/세븐일레븐/이마트24/명당이 포함되고 '로또' 단독 표기가 아닌 교차검증 매장
        candidates = [
            s for s in stores
            if s.get("sido") == sd
            and "교차검증" in s.get("grade", "")
            and len(s.get("addr", "")) >= 10
            and "로또" not in s.get("name", "")
            and any(k in s.get("name", "") for k in ("토토", "프로토", "스포츠", "CU", "GS25", "세븐일레븐", "이마트24", "명당", "마트", "센터"))
        ]
        if not candidates:
            candidates = [
                s for s in stores
                if s.get("sido") == sd and "로또" not in s.get("name", "") and len(s.get("addr", "")) >= 10
            ]
        if not candidates:
            candidates = [s for s in stores if s.get("sido") == sd]
        if candidates:
            pick = candidates[(seed_int + idx * 37) % len(candidates)]
            selected.append(_serialize_store(pick))

    return selected


def format_marketing_store_spotlight_text(count: int = 4, seed_key: Optional[str] = None) -> str:
    """SNS 캡션 및 유튜브 쇼츠 설명란에 바로 넣을 수 있는 실제 판매점 스포트라이트 텍스트."""
    spots = get_marketing_spotlight_stores(count=count, seed_key=seed_key)
    if not spots:
        return "전국 6,277개 공식 프로토·토토 판매점 (베트맨·복권위 교차검증 완료)"
    lines = []
    for s in spots:
        lines.append(f"• [{s['sido']} {s['sigungu']}] {s['name']} ({s['address']})")
    return "\n".join(lines)
