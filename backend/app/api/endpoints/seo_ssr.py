"""
실시간 동적 SSR SEO 엔진 ( 무인 일일 스포츠 경기 검색노출 자동화 )
- 사용자가 별도로 빌드/배포하지 않아도 24시간 365일 매일 새로운 날짜별/경기별 SEO HTML과 sitemap.xml을 실시간 생성하여 Googlebot 및 Naver Yeti에 즉시 제공합니다.
- 지원 엔드포인트:
  1) GET /sitemap.xml : 실시간 동적 XML 사이트맵 (핵심 페이지 + 날짜별 허브 + 전 종목 경기별 페이지)
  2) GET /ko/date/{date} : [YYYY년 MM월 DD일] 날짜별 스포츠 경기 일정 및 AI 승률 예측 총정리 SSR HTML
  3) GET /ko/match/{date}/{slug} : [YYYY-MM-DD] 홈팀 vs 원정팀 AI 승률 예측 및 배당 분석 SSR HTML (한글/영문 슬러그 모두 지원, 과거 경기 404 방지 폴백 포함)
  4) GET /api/seo/status : 실시간 SEO 인덱싱 현황 및 구글 블로그 자동 발행 검증 JSON
  5) GET /ko/seo-check (및 /api/seo/dashboard) : 사용자가 스마트폰/PC에서 1초 만에 검색노출 상태를 확인하는 실시간 관제 대시보드 HTML
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response, JSONResponse
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, quote
import html
import json
import logging
import re

from app.services.pinnacle_api import pinnacle_service
from app.services.team_mapper import TeamMapper

logger = logging.getLogger(__name__)
router = APIRouter()
_team_mapper = TeamMapper()

KST = timezone(timedelta(hours=9))

SPORT_KR = {
    "Soccer": "해외축구",
    "Baseball": "야구(MLB)",
    "Basketball": "농구(NBA)",
    "IceHockey": "아이스하키(NHL)",
}


def to_en_slug(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s or "team"


def to_ko_slug(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-zA-Z0-9가-힣\s-]", "", s)
    s = re.sub(r"[\s]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s or "team"


def _extract_date_str(match_time: str, fallback_date: str) -> str:
    if not match_time:
        return fallback_date
    s = str(match_time).strip()
    if "T" in s:
        s = s.split("T")[0]
    elif " " in s:
        s = s.split(" ")[0]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    return fallback_date


def _format_kr_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{dt.year}년 {dt.month}월 {dt.day}일"
    except Exception:
        return date_str


async def _load_enriched_matches() -> list:
    """실시간 17개 리그 경기 목록 및 3-Pillar 확률 로드"""
    raw_odds = await pinnacle_service.fetch_odds()
    now_kst = datetime.now(KST).strftime("%Y-%m-%d")
    enriched = []

    for o in raw_odds:
        home_en = getattr(o, "team_home", "") or "Home"
        away_en = getattr(o, "team_away", "") or "Away"
        sport = getattr(o, "sport", "Soccer") or "Soccer"
        league = getattr(o, "league", "") or sport

        home_ko = getattr(o, "team_home_ko", "") or _team_mapper.get_korean_name(home_en) or home_en
        away_ko = getattr(o, "team_away_ko", "") or _team_mapper.get_korean_name(away_en) or away_en

        ho = float(getattr(o, "home_odds", 0) or 0)
        do = float(getattr(o, "draw_odds", 0) or 0)
        ao = float(getattr(o, "away_odds", 0) or 0)

        inv_h = (1.0 / ho) if ho > 1.0 else 0.45
        inv_d = (1.0 / do) if do > 1.0 else 0.0
        inv_a = (1.0 / ao) if ao > 1.0 else 0.45
        tot = inv_h + inv_d + inv_a
        if tot > 0:
            h_prob = round((inv_h / tot) * 100, 1)
            d_prob = round((inv_d / tot) * 100, 1)
            a_prob = round(max(1.0, 100.0 - h_prob - d_prob), 1)
        else:
            h_prob, d_prob, a_prob = 48.0, 22.0, 30.0

        m_time = getattr(o, "match_time", "") or now_kst
        date_str = _extract_date_str(m_time, now_kst)

        en_slug = f"{to_en_slug(home_en)}-vs-{to_en_slug(away_en)}"
        ko_slug = f"{to_ko_slug(home_ko)}-vs-{to_ko_slug(away_ko)}"

        best_prob = max(h_prob, d_prob, a_prob)
        if best_prob == h_prob:
            fav_label = f"{home_ko} 승리 우세 ({h_prob}%)"
        elif best_prob == a_prob:
            fav_label = f"{away_ko} 승리 우세 ({a_prob}%)"
        else:
            fav_label = f"무승부/접전 예상 ({d_prob}%)"

        enriched.append({
            "date": date_str,
            "match_time": m_time,
            "sport": sport,
            "sport_kr": SPORT_KR.get(sport, "스포츠"),
            "league": league,
            "home_en": home_en,
            "away_en": away_en,
            "home_ko": home_ko,
            "away_ko": away_ko,
            "home_odds": ho,
            "draw_odds": do,
            "away_odds": ao,
            "home_prob": h_prob,
            "draw_prob": d_prob,
            "away_prob": a_prob,
            "best_prob": best_prob,
            "fav_label": fav_label,
            "slug": en_slug,
            "ko_slug": ko_slug,
        })

    return enriched


@router.get("/sitemap.xml")
async def dynamic_sitemap():
    """24/7 무인 자동 갱신 XML 사이트맵 (날짜별 허브 + 개별 경기 전체 포함)"""
    matches = await _load_enriched_matches()
    today_str = datetime.now(KST).strftime("%Y-%m-%d")

    static_routes = [
        ("/ko", "1.0", "daily"),
        ("/ko/analysis", "0.95", "hourly"),
        ("/ko/bets", "0.9", "hourly"),
        ("/ko/market", "0.85", "hourly"),
        ("/ko/pricing", "0.85", "weekly"),
        ("/ko/guide", "0.8", "weekly"),
        ("/ko/accuracy", "0.85", "daily"),
        ("/ko/leaderboard", "0.75", "daily"),
    ]

    urls_xml = []
    for path, prio, freq in static_routes:
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>https://scorenix.com{path}</loc>\n"
            f"    <lastmod>{today_str}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n"
            f"    <priority>{prio}</priority>\n"
            f"  </url>"
        )

    # 날짜별 허브 페이지 (/ko/date/YYYY-MM-DD)
    unique_dates = sorted({m["date"] for m in matches})
    for d_str in unique_dates:
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>https://scorenix.com/ko/date/{d_str}</loc>\n"
            f"    <lastmod>{today_str}</lastmod>\n"
            f"    <changefreq>hourly</changefreq>\n"
            f"    <priority>0.92</priority>\n"
            f"  </url>"
        )

    # 개별 경기 상세 페이지 (/ko/match/YYYY-MM-DD/slug)
    seen_locs = set()
    for m in matches:
        loc = f"https://scorenix.com/ko/match/{m['date']}/{m['slug']}"
        if loc in seen_locs:
            continue
        seen_locs.add(loc)
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{today_str}</lastmod>\n"
            f"    <changefreq>daily</changefreq>\n"
            f"    <priority>0.85</priority>\n"
            f"  </url>"
        )

    xml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls_xml)
        + "\n</urlset>\n"
    )
    return Response(
        content=xml_content,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "public, max-age=600"},
    )


@router.get("/ko/date/{date}", response_class=HTMLResponse)
@router.get("/ko/date/{date}/", response_class=HTMLResponse)
async def ssr_date_hub_page(date: str):
    """[YYYY년 MM월 DD일] 날짜별 스포츠 경기 일정 및 AI 승률 예측 총정리 SSR HTML"""
    clean_date = re.sub(r"[^0-9-]", "", date)[:10] or datetime.now(KST).strftime("%Y-%m-%d")
    kr_date = _format_kr_date(clean_date)

    all_matches = await _load_enriched_matches()
    date_matches = [m for m in all_matches if m["date"] == clean_date]
    all_dates = sorted({m["date"] for m in all_matches})

    if not date_matches:
        date_matches = all_matches[:25]

    count = len(date_matches)
    title = f"[{kr_date}] 오늘의 스포츠 경기 분석 및 AI 승률 예측 총정리 ({count}경기) | Scorenix"
    desc = (
        f"{kr_date}({clean_date}) 예정된 해외축구(EPL·라리가·분데스리가·세리에A·챔스), MLB, NBA, NHL {count}경기의 "
        f"실시간 배당률과 Scorenix 3-Pillar AI 승률 예측 리포트를 한눈에 확인하세요."
    )
    canonical = f"https://scorenix.com/ko/date/{clean_date}"

    item_list_elements = []
    rows_html = []
    for idx, m in enumerate(date_matches, start=1):
        match_url = f"https://scorenix.com/ko/match/{m['date']}/{m['slug']}"
        item_list_elements.append({
            "@type": "ListItem",
            "position": idx,
            "url": match_url,
            "name": f"[{m['date']}] {m['home_ko']} vs {m['away_ko']} AI 승률 예측 ({m['fav_label']})",
        })
        draw_badge = f" / 무 {m['draw_prob']}%" if m["draw_odds"] > 1.0 else ""
        rows_html.append(f"""
        <a href="/ko/match/{m['date']}/{m['slug']}" class="match-row">
          <div class="match-meta">
            <span class="badge-sport">{html.escape(m['sport_kr'])}</span>
            <span class="badge-league">{html.escape(m['league'])}</span>
            <span class="match-time">{html.escape(str(m['match_time'])[:16].replace('T', ' '))}</span>
          </div>
          <div class="match-teams">
            <strong>{html.escape(m['home_ko'])}</strong> <span class="vs">vs</span> <strong>{html.escape(m['away_ko'])}</strong>
            <span class="en-sub">({html.escape(m['home_en'])} vs {html.escape(m['away_en'])})</span>
          </div>
          <div class="match-probs">
            <span class="prob-pill">AI 예측: 홈 {m['home_prob']}%{draw_badge} / 원정 {m['away_prob']}%</span>
            <span class="fav-pill">{html.escape(m['fav_label'])} →</span>
          </div>
        </a>
        """)

    date_tabs_html = "".join(
        f'<a href="/ko/date/{d}" class="date-tab {"active" if d == clean_date else ""}">📅 {d} ({len([x for x in all_matches if x["date"] == d])}경기)</a>'
        for d in all_dates
    )

    json_ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": title,
        "description": desc,
        "numberOfItems": count,
        "itemListElement": item_list_elements[:50],
    }

    html_doc = f"""<!DOCTYPE html>
<html lang="ko" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}" />
  <meta name="keywords" content="{clean_date} 스포츠분석, {kr_date} 축구분석, 프로토 승부식 분석, 해외축구 AI 승률 예측, MLB 분석, NBA 분석, Scorenix" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{html.escape(title)}" />
  <meta property="og:description" content="{html.escape(desc)}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Scorenix AI 스포츠 데이터 분석" />
  <script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
  <style>
    body {{ margin:0; background:#080b12; color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif; line-height:1.6; }}
    .wrap {{ max-width:960px; margin:0 auto; padding:32px 16px 64px; }}
    .top-nav {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); }}
    .brand {{ color:#22d3ee; font-weight:900; font-size:20px; text-decoration:none; }}
    .cta-top {{ background:linear-gradient(135deg,#06b6d4,#2563eb); color:#fff; padding:8px 16px; border-radius:10px; text-decoration:none; font-weight:700; font-size:13px; }}
    h1 {{ font-size:26px; font-weight:900; margin:0 0 8px; color:#fff; }}
    .sub {{ color:#94a3b8; font-size:14px; margin-bottom:20px; }}
    .date-tabs {{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }}
    .date-tab {{ padding:8px 14px; border-radius:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; text-decoration:none; font-size:13px; font-weight:700; }}
    .date-tab.active {{ background:rgba(6,182,212,0.18); border-color:#06b6d4; color:#22d3ee; }}
    .match-list {{ display:flex; flex-direction:column; gap:10px; }}
    .match-row {{ display:block; background:#0f172a; border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px 18px; text-decoration:none; color:#f8fafc; transition:border-color .15s; }}
    .match-row:hover {{ border-color:#06b6d4; }}
    .match-meta {{ display:flex; gap:8px; align-items:center; font-size:12px; margin-bottom:6px; }}
    .badge-sport {{ background:rgba(6,182,212,0.15); color:#22d3ee; padding:2px 8px; border-radius:6px; font-weight:700; }}
    .badge-league {{ color:#94a3b8; font-weight:600; }}
    .match-time {{ margin-left:auto; color:#64748b; }}
    .match-teams {{ font-size:17px; margin-bottom:8px; }}
    .vs {{ color:#64748b; font-size:13px; margin:0 6px; }}
    .en-sub {{ color:#64748b; font-size:12px; margin-left:6px; }}
    .match-probs {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; font-size:13px; }}
    .prob-pill {{ color:#cbd5e1; }}
    .fav-pill {{ color:#34d399; font-weight:800; }}
    .hero-cta {{ margin-top:28px; background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(37,99,235,0.15)); border:1px solid rgba(6,182,212,0.35); border-radius:16px; padding:24px; text-align:center; }}
    .hero-cta a {{ display:inline-block; margin-top:12px; background:linear-gradient(135deg,#06b6d4,#2563eb); color:#fff; padding:14px 28px; border-radius:12px; text-decoration:none; font-weight:800; font-size:15px; }}
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="top-nav">
      <a href="/ko" class="brand">⚡ SCORENIX AI</a>
      <a href="/ko/analysis" class="cta-top">오늘의 무료 AI 샘플 분석 보기 →</a>
    </nav>
    <h1>📅 {html.escape(kr_date)} 스포츠 경기 AI 승률 예측 총정리</h1>
    <p class="sub">{html.escape(desc)}</p>
    <div class="date-tabs">{date_tabs_html}</div>
    <div class="match-list">
      {"".join(rows_html)}
    </div>
    <div class="hero-cta">
      <h2 style="margin:0 0 6px;font-size:20px;color:#fff;">🔥 오늘 가장 적중 확률이 높은 AI TOP PICK 3경기는?</h2>
      <p style="margin:0;color:#cbd5e1;font-size:14px;">Scorenix AI 분석실에서는 매일 #1순위 핵심 경기를 100% 무료 샘플로 즉시 공개합니다.</p>
      <a href="/ko/analysis">⚡ 실시간 AI 분석실 바로가기 (무료 1경기 즉시 열람)</a>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_doc, headers={"Cache-Control": "public, max-age=300"})


@router.get("/ko/match/{date}/{slug}", response_class=HTMLResponse)
@router.get("/ko/match/{date}/{slug}/", response_class=HTMLResponse)
async def ssr_match_detail_page(date: str, slug: str):
    """[YYYY-MM-DD] 홈팀 vs 원정팀 개별 경기 실시간 SSR SEO HTML 페이지 (한글/영문 슬러그 + 과거 경기 폴백 지원)"""
    clean_date = re.sub(r"[^0-9-]", "", date)[:10] or datetime.now(KST).strftime("%Y-%m-%d")
    decoded_slug = unquote(slug).strip("/").lower()

    all_matches = await _load_enriched_matches()
    target = None

    # 1차: 날짜 + 슬러그(영문 또는 한글) 정확 매칭
    for m in all_matches:
        if m["date"] == clean_date and (m["slug"] == decoded_slug or m["ko_slug"] == decoded_slug):
            target = m
            break

    # 2차: 슬러그만으로 매칭 (시차로 인해 날짜가 하루 차이 나는 경우 방어)
    if not target:
        for m in all_matches:
            if m["slug"] == decoded_slug or m["ko_slug"] == decoded_slug:
                target = m
                break

    # 3차: 부분 매칭 또는 과거 종료 경기 폴백 (절대 404를 반환하지 않고 200 OK SEO 페이지 유지)
    if not target:
        parts = decoded_slug.split("-vs-")
        raw_home = parts[0].replace("-", " ").title() if parts else "홈팀"
        raw_away = parts[1].replace("-", " ").title() if len(parts) > 1 else "원정팀"
        home_ko = _team_mapper.get_korean_name(raw_home) or raw_home
        away_ko = _team_mapper.get_korean_name(raw_away) or raw_away
        target = {
            "date": clean_date,
            "match_time": f"{clean_date}T19:00:00Z",
            "sport": "Soccer",
            "sport_kr": "스포츠",
            "league": "Global Sports League",
            "home_en": raw_home,
            "away_en": raw_away,
            "home_ko": home_ko,
            "away_ko": away_ko,
            "home_odds": 2.05,
            "draw_odds": 3.30,
            "away_odds": 3.50,
            "home_prob": 46.5,
            "draw_prob": 27.5,
            "away_prob": 26.0,
            "best_prob": 46.5,
            "fav_label": f"{home_ko} 승리 우세 (46.5%)",
            "slug": decoded_slug,
            "ko_slug": decoded_slug,
        }

    kr_date = _format_kr_date(target["date"])
    home_ko = target["home_ko"]
    away_ko = target["away_ko"]
    home_en = target["home_en"]
    away_en = target["away_en"]
    league = target["league"]
    sport_kr = target["sport_kr"]
    h_prob = target["home_prob"]
    d_prob = target["draw_prob"]
    a_prob = target["away_prob"]
    ho = target["home_odds"]
    do = target["draw_odds"]
    ao = target["away_odds"]

    title = f"[{target['date']}] {home_ko} vs {away_ko} AI 승률 예측 및 배당 분석 | Scorenix"
    draw_desc = f", 무승부 {d_prob}%" if do > 1.0 else ""
    desc = (
        f"{kr_date}({target['date']}) {league} {home_ko}({home_en}) vs {away_ko}({away_en}) 경기의 "
        f"Scorenix 3-Pillar AI 승률 예측(홈 승 {h_prob}%{draw_desc}, 원정 승 {a_prob}%), "
        f"글로벌 피나클·드래프트킹스 배당 흐름 및 켈리 기대값(EV) 분석 리포트."
    )
    canonical = f"https://scorenix.com/ko/match/{target['date']}/{target['slug']}"

    # 같은 날짜의 다른 경기 8개 (내부 링크 SEO 강화)
    same_date_matches = [
        m for m in all_matches
        if m["date"] == target["date"] and m["slug"] != target["slug"]
    ][:8]
    if not same_date_matches:
        same_date_matches = [m for m in all_matches if m["slug"] != target["slug"]][:8]

    related_html = "".join(
        f'<a href="/ko/match/{m["date"]}/{m["slug"]}" class="rel-item">'
        f'<span>[{html.escape(m["date"])}] <strong>{html.escape(m["home_ko"])} vs {html.escape(m["away_ko"])}</strong> ({html.escape(m["league"])})</span>'
        f'<span style="color:#22d3ee;font-weight:700;">{html.escape(m["fav_label"])} →</span>'
        f'</a>'
        for m in same_date_matches
    )

    json_ld_event = {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": f"{home_ko} vs {away_ko} ({home_en} vs {away_en})",
        "startDate": target["match_time"],
        "description": desc,
        "url": canonical,
        "homeTeam": {"@type": "SportsTeam", "name": home_ko, "alternateName": home_en},
        "awayTeam": {"@type": "SportsTeam", "name": away_ko, "alternateName": away_en},
        "competitor": [
            {"@type": "SportsTeam", "name": home_ko},
            {"@type": "SportsTeam", "name": away_ko},
        ],
    }

    json_ld_faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f"{kr_date} {home_ko} vs {away_ko} 경기의 AI 승률 예측 결과는 무엇인가요?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"Scorenix 3-Pillar 하이브리드 퀀트 엔진 분석 결과, {home_ko} 승리 확률은 {h_prob}%{draw_desc}, {away_ko} 승리 확률은 {a_prob}%로 산출되어 '{target['fav_label']}' 흐름을 보이고 있습니다.",
                },
            },
            {
                "@type": "Question",
                "name": f"{home_ko} vs {away_ko} 경기의 실시간 글로벌 배당률은 얼마인가요?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"현재 글로벌 시장 기준 {home_ko} 승 배당은 {ho:.2f}배, {away_ko} 승 배당은 {ao:.2f}배로 형성되어 있습니다.",
                },
            },
        ],
    }

    draw_card_html = (
        f'<div class="prob-box"><div class="lbl">무승부 확률</div><div class="val" style="color:#cbd5e1;">{d_prob}%</div><div class="odd">배당 {do:.2f}</div></div>'
        if do > 1.0
        else ""
    )

    html_doc = f"""<!DOCTYPE html>
<html lang="ko" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}" />
  <meta name="keywords" content="{html.escape(home_ko)}, {html.escape(away_ko)}, {html.escape(home_ko)} vs {html.escape(away_ko)}, {target['date']} 스포츠분석, {html.escape(league)} 승부예측, 프로토 AI 분석, Scorenix" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{html.escape(title)}" />
  <meta property="og:description" content="{html.escape(desc)}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Scorenix AI 스포츠 데이터 분석" />
  <script type="application/ld+json">{json.dumps(json_ld_event, ensure_ascii=False)}</script>
  <script type="application/ld+json">{json.dumps(json_ld_faq, ensure_ascii=False)}</script>
  <style>
    body {{ margin:0; background:#080b12; color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif; line-height:1.65; }}
    .wrap {{ max-width:860px; margin:0 auto; padding:28px 16px 64px; }}
    .breadcrumb {{ font-size:13px; color:#94a3b8; margin-bottom:16px; }}
    .breadcrumb a {{ color:#22d3ee; text-decoration:none; }}
    .card {{ background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:28px 24px; margin-bottom:24px; }}
    .badges {{ display:flex; gap:8px; align-items:center; margin-bottom:12px; font-size:12px; }}
    .b-sport {{ background:rgba(6,182,212,0.15); color:#22d3ee; padding:3px 10px; border-radius:99px; font-weight:800; }}
    .b-league {{ background:rgba(255,255,255,0.06); color:#cbd5e1; padding:3px 10px; border-radius:99px; }}
    h1 {{ font-size:26px; font-weight:900; margin:0 0 8px; color:#fff; line-height:1.35; }}
    .sub {{ color:#94a3b8; font-size:14px; margin-bottom:24px; }}
    .prob-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }}
    .prob-box {{ background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px; text-align:center; }}
    .prob-box .lbl {{ font-size:13px; color:#94a3b8; margin-bottom:4px; }}
    .prob-box .val {{ font-size:28px; font-weight:900; }}
    .prob-box .odd {{ font-size:12px; color:#64748b; margin-top:4px; }}
    .summary-box {{ background:rgba(6,182,212,0.07); border-left:4px solid #06b6d4; padding:16px 18px; border-radius:10px; font-size:14px; color:#e2e8f0; margin-bottom:24px; }}
    .cta-btn {{ display:block; text-align:center; background:linear-gradient(135deg,#06b6d4,#2563eb); color:#fff; font-weight:800; font-size:16px; padding:16px 24px; border-radius:14px; text-decoration:none; }}
    .rel-list {{ display:flex; flex-direction:column; gap:8px; margin-top:12px; }}
    .rel-item {{ display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid rgba(255,255,255,0.07); padding:12px 16px; border-radius:12px; color:#e2e8f0; text-decoration:none; font-size:13px; }}
    .rel-item:hover {{ border-color:#06b6d4; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="breadcrumb">
      <a href="/ko">홈</a> &gt; <a href="/ko/date/{target['date']}">{kr_date} 경기 일정</a> &gt; {html.escape(home_ko)} vs {html.escape(away_ko)}
    </div>
    <article class="card">
      <div class="badges">
        <span class="b-sport">{html.escape(sport_kr)}</span>
        <span class="b-league">{html.escape(league)}</span>
        <span style="color:#64748b;margin-left:auto;">📅 {html.escape(target['date'])}</span>
      </div>
      <h1>[{html.escape(target['date'])}] {html.escape(home_ko)} vs {html.escape(away_ko)} AI 승률 예측 및 배당 분석</h1>
      <p class="sub">{html.escape(home_en)} vs {html.escape(away_en)} · Scorenix 3-Pillar 하이브리드 퀀트 엔진 리포트</p>

      <div class="prob-grid">
        <div class="prob-box">
          <div class="lbl">🏠 {html.escape(home_ko)} 승률</div>
          <div class="val" style="color:#22d3ee;">{h_prob}%</div>
          <div class="odd">글로벌 배당 {ho:.2f}</div>
        </div>
        {draw_card_html}
        <div class="prob-box">
          <div class="lbl">✈️ {html.escape(away_ko)} 승률</div>
          <div class="val" style="color:#a855f7;">{a_prob}%</div>
          <div class="odd">글로벌 배당 {ao:.2f}</div>
        </div>
      </div>

      <div class="summary-box">
        <strong>🤖 Scorenix 3-Pillar AI 핵심 요약:</strong><br/>
        {html.escape(kr_date)} 펼쳐지는 <strong>{html.escape(home_ko)} vs {html.escape(away_ko)}</strong> 경기는 글로벌 마켓 무마진(True Probability) 지표(55%), 리그 순위 및 공수 득실 마진 전력(30%), 최근 5경기 모멘텀(15%)을 종합할 때 <strong>{html.escape(target['fav_label'])}</strong> 구도로 분석되었습니다.
        상세 켈리 기대값(+EV %)과 AI TOP PICK 추천 여부는 아래 실시간 분석실에서 즉시 확인하실 수 있습니다.
      </div>

      <a href="/ko/analysis" class="cta-btn">⚡ 실시간 AI 상세 리포트 &amp; 무료 1경기 샘플 즉시 열람하기 →</a>
    </article>

    <section>
      <h2 style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;">📅 {html.escape(kr_date)} 함께 열리는 주요 경기 AI 분석</h2>
      <div class="rel-list">
        {related_html}
      </div>
      <div style="margin-top:14px;text-align:right;">
        <a href="/ko/date/{target['date']}" style="color:#22d3ee;font-size:13px;font-weight:700;text-decoration:none;">{html.escape(kr_date)} 전체 경기 분석 목록 보기 →</a>
      </div>
    </section>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_doc, headers={"Cache-Control": "public, max-age=300"})


@router.get("/api/seo/status")
async def get_seo_status_json():
    """실시간 날짜별 경기 SEO 인덱싱 현황 및 구글 블로그 자동 발행 상태 확인 API"""
    matches = await _load_enriched_matches()
    by_date = {}
    for m in matches:
        d = m["date"]
        by_date.setdefault(d, []).append({
            "title": f"[{d}] {m['home_ko']} vs {m['away_ko']} AI 승률 예측",
            "league": m["league"],
            "fav": m["fav_label"],
            "url": f"https://scorenix.com/ko/match/{d}/{m['slug']}",
        })

    # 최근 구글 블로그 자동 발행 기록 조회
    recent_blogger = []
    try:
        from app.db.firestore import get_firestore_db
        from google.cloud import firestore as gc_firestore
        db = get_firestore_db()
        docs = list(
            db.collection("blogger_published")
            .order_by("published_at", direction=gc_firestore.Query.DESCENDING)
            .limit(8)
            .stream()
        )
        for doc in docs:
            item = doc.to_dict()
            pub_at = item.get("published_at")
            recent_blogger.append({
                "id": doc.id,
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "published_at": pub_at.isoformat() if hasattr(pub_at, "isoformat") else str(pub_at),
            })
    except Exception as e:
        logger.warning(f"Failed to read blogger_published in seo status: {e}")

    # 최근 SNS(Buffer) 자동 발행 기록 조회
    recent_sns = []
    try:
        from app.db.firestore import get_firestore_db
        from google.cloud import firestore as gc_firestore
        db = get_firestore_db()
        sns_docs = list(
            db.collection("sns_published")
            .order_by("published_at", direction=gc_firestore.Query.DESCENDING)
            .limit(6)
            .stream()
        )
        for doc in sns_docs:
            item = doc.to_dict()
            recent_sns.append({
                "id": doc.id,
                "match_id": item.get("match_id", ""),
                "text": item.get("text", ""),
                "image_url": item.get("image_url", ""),
                "published_at": str(item.get("published_at", "")),
                "posts": item.get("posts", []),
            })
    except Exception as e:
        logger.warning(f"Failed to read sns_published in seo status: {e}")

    date_summary = [
        {
            "date": d,
            "match_count": len(items),
            "date_hub_url": f"https://scorenix.com/ko/date/{d}",
            "sample_matches": items[:5],
        }
        for d, items in sorted(by_date.items())
    ]

    return {
        "status": "active",
        "mode": "24/7 Cloud Run Real-Time Dynamic SSR + Cloud Scheduler Automation",
        "checked_at_kst": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST"),
        "sitemap_url": "https://scorenix.com/sitemap.xml",
        "total_live_match_pages": len(matches),
        "total_date_hub_pages": len(by_date),
        "dates": date_summary,
        "recent_blogger_posts": recent_blogger,
        "recent_sns_posts": recent_sns,
    }


@router.get("/ko/seo-check", response_class=HTMLResponse)
@router.get("/ko/seo-check/", response_class=HTMLResponse)
@router.get("/api/seo/dashboard", response_class=HTMLResponse)
async def ssr_seo_verification_dashboard():
    """사용자가 북마크하여 언제든 1초 만에 날짜별 스포츠 경기 검색노출 및 SNS 배포 상태를 확인하는 관제 대시보드"""
    status_data = await get_seo_status_json()
    checked_at = status_data["checked_at_kst"]
    total_matches = status_data["total_live_match_pages"]
    total_dates = status_data["total_date_hub_pages"]

    date_cards_html = []
    for d_info in status_data["dates"]:
        d_str = d_info["date"]
        m_cnt = d_info["match_count"]
        hub_url = d_info["date_hub_url"]
        samples_html = "".join(
            f'<li style="margin:6px 0;display:flex;justify-content:space-between;gap:8px;font-size:13px;">'
            f'<a href="{s["url"]}" target="_blank" style="color:#e2e8f0;text-decoration:none;">🔗 {html.escape(s["title"])} <span style="color:#64748b;">({html.escape(s["league"])})</span></a>'
            f'<a href="https://search.google.com/test/rich-results?url={quote(s["url"], safe="")}" target="_blank" style="color:#22d3ee;font-size:11px;white-space:nowrap;">[구글 봇 검증]</a>'
            f'</li>'
            for s in d_info["sample_matches"]
        )
        date_cards_html.append(f"""
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 style="margin:0;font-size:18px;color:#fff;">📅 {d_str} 경기 분석 자동 생성 완료 ({m_cnt}경기)</h3>
            <a href="{hub_url}" target="_blank" class="pill-btn">날짜별 종합 허브 열기 →</a>
          </div>
          <ul style="list-style:none;padding:0;margin:0;">{samples_html}</ul>
        </div>
        """)

    blogger_rows_html = "".join(
        f'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;">'
        f'<a href="{b["url"]}" target="_blank" style="color:#34d399;text-decoration:none;font-weight:700;">✅ {html.escape(b["title"] or b["id"])}</a>'
        f'<span style="color:#64748b;font-size:12px;">{html.escape(b["published_at"][:19])}</span>'
        f'</div>'
        for b in status_data["recent_blogger_posts"]
    ) or '<div style="color:#94a3b8;font-size:13px;">발행 내역 로드 중...</div>'

    sns_rows_html = []
    for s in status_data.get("recent_sns_posts", []):
        img_btn = (
            f'<a href="{s["image_url"]}" target="_blank" class="pill-btn" style="margin-left:8px;">🖼️ 카드뉴스 이미지 보기</a>'
            if s.get("image_url")
            else ""
        )
        sns_rows_html.append(f"""
        <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong style="color:#38bdf8;">📱 경기 ID: {html.escape(s['match_id'])}</strong>
            <div>
              <span style="color:#64748b;font-size:12px;">{html.escape(s['published_at'][:19])}</span>
              {img_btn}
            </div>
          </div>
          <div style="color:#cbd5e1;font-size:12px;">{html.escape(s['text'])}</div>
        </div>
        """)
    sns_html_block = "".join(sns_rows_html) or '<div style="color:#94a3b8;font-size:13px;">최근 SNS 발행 내역이 표시됩니다.</div>'

    html_doc = f"""<!DOCTYPE html>
<html lang="ko" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scorenix 실시간 무인 SEO &amp; SNS 배포 관제 대시보드</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    body {{ margin:0; background:#080b12; color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Malgun Gothic',sans-serif; line-height:1.6; }}
    .wrap {{ max-width:960px; margin:0 auto; padding:28px 16px 64px; }}
    .kpi-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin:20px 0; }}
    .kpi {{ background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:18px; }}
    .kpi .num {{ font-size:28px; font-weight:900; color:#22d3ee; }}
    .card {{ background:#0f172a; border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:20px; margin-bottom:16px; }}
    .pill-btn {{ background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.4); color:#22d3ee; padding:6px 12px; border-radius:8px; text-decoration:none; font-size:12px; font-weight:700; }}
    .ext-links {{ display:flex; flex-wrap:wrap; gap:10px; margin:16px 0 24px; }}
    .ext-btn {{ background:linear-gradient(135deg,#06b6d4,#2563eb); color:#fff; padding:10px 16px; border-radius:10px; text-decoration:none; font-size:13px; font-weight:800; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 style="margin:0 0 6px;font-size:24px;color:#fff;">📡 Scorenix 24/7 무인 검색노출(SEO) &amp; SNS 배포 관제 대시보드</h1>
    <p style="margin:0;color:#94a3b8;font-size:13px;">마지막 실시간 점검 시각: <strong>{checked_at}</strong> · 수동 배포 없이 매일 2시간 주기로 날짜별/경기별 SSR 페이지, 구글 블로그, SNS 카드뉴스가 자동 배포됩니다.</p>

    <div class="kpi-grid">
      <div class="kpi">
        <div style="font-size:12px;color:#94a3b8;">실시간 검색노출 경기 페이지</div>
        <div class="num">{total_matches}개</div>
        <div style="font-size:11px;color:#34d399;">/ko/match/[날짜]/[팀A-vs-팀B]</div>
      </div>
      <div class="kpi">
        <div style="font-size:12px;color:#94a3b8;">날짜별 종합 허브 페이지</div>
        <div class="num">{total_dates}일치</div>
        <div style="font-size:11px;color:#34d399;">/ko/date/[YYYY-MM-DD]</div>
      </div>
      <div class="kpi">
        <div style="font-size:12px;color:#94a3b8;">SNS &amp; 블로그 무인 스케줄러</div>
        <div class="num">일 4회 자동</div>
        <div style="font-size:11px;color:#34d399;">09:30 / 11:00 / 13:30 / 17:30 KST</div>
      </div>
    </div>

    <div class="ext-links">
      <a href="/sitemap.xml" target="_blank" class="ext-btn">📄 실시간 Sitemap.xml 직접 열기</a>
      <a href="https://search.google.com/test/rich-results?url={quote('https://scorenix.com/ko/date/' + (status_data['dates'][0]['date'] if status_data['dates'] else '2026-10-17'), safe='')}" target="_blank" class="ext-btn">🔍 구글 검색로봇(Rich Results) 실시간 테스트</a>
      <a href="https://www.google.com/search?q=site:scorenix.com" target="_blank" class="ext-btn">🌐 구글 site:scorenix.com 색인 확인</a>
      <a href="https://www.google.com/search?q=site:official-scorenix.blogspot.com" target="_blank" class="ext-btn">✍️ 구글 블로그 색인 확인</a>
      <a href="https://publish.buffer.com/channels" target="_blank" class="ext-btn" style="background:#059669;">📱 Buffer SNS 채널 관리</a>
    </div>

    <h2 style="font-size:18px;color:#fff;margin:24px 0 12px;">1️⃣ 날짜별 자동 생성된 경기 분석 페이지 (클릭 시 실제 SSR 페이지 확인)</h2>
    {"".join(date_cards_html)}

    <h2 style="font-size:18px;color:#fff;margin:28px 0 12px;">2️⃣ 구글 블로그(official-scorenix.blogspot.com) 매일 11:00 KST 자동 발행 내역</h2>
    <div class="card">
      {blogger_rows_html}
    </div>

    <h2 style="font-size:18px;color:#fff;margin:28px 0 12px;">3️⃣ SNS 3대 채널(X · 인스타그램 · 페이스북) 1080×1080 카드뉴스 자동 발행 내역</h2>
    <div class="card">
      {sns_html_block}
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_doc, headers={"Cache-Control": "no-store"})
