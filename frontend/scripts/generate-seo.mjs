/**
 * 빌드 후 실행:
 * 1) 각 경기별 SEO 정적 HTML 페이지 (out/ko/match/[date]/[slug]/index.html)
 * 2) 전국 6,277개 공식 프로토·토토 판매점 지역별(17개 시도 + ~230개 시군구) Local SEO 랜딩페이지 (out/ko/stores/.../index.html)
 * 3) sitemap.xml, robots.txt 생성
 *
 * Usage: node scripts/generate-seo.mjs
 */

const SITE_URL = 'https://scorenix.com';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'out');

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── League Helpers ──
const LEAGUE_NAMES = {
    'soccer_epl': '프리미어리그 (EPL)',
    'soccer_spain_la_liga': '라리가 (La Liga)',
    'soccer_germany_bundesliga': '분데스리가 (Bundesliga)',
    'soccer_italy_serie_a': '세리에A (Serie A)',
    'soccer_france_ligue_one': '리그앙 (Ligue 1)',
    'soccer_uefa_champs_league': 'UEFA 챔피언스리그',
    'soccer_uefa_europa_league': 'UEFA 유로파리그',
    'basketball_nba': 'NBA 프로농구',
    'baseball_mlb': 'MLB 메이저리그',
    'icehockey_nhl': 'NHL 북미아이스하키',
};

function getLeagueName(key) { return LEAGUE_NAMES[key] || key || '글로벌 리그'; }

function toSlug(name) {
    if (!name) return 'team';
    return String(name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'team';
}

// ── Generate individual match HTML page ──
function generateMatchPage(match) {
    const bestProb = Math.max(match.home_prob || 45, match.draw_prob || 0, match.away_prob || 30);
    const favorite = (match.home_prob || 45) >= (match.away_prob || 30) ? match.home_ko : match.away_ko;
    const leagueName = getLeagueName(match.league);
    const title = `${match.date} ${match.home_ko} vs ${match.away_ko} 해외배당 흐름 및 AI 승률 분석 | Scorenix`;
    const description = `[3-Pillar 퀀트 분석] ${match.home_ko} vs ${match.away_ko} (${leagueName}) | 글로벌 배당 마진 제거 내재 확률 ${favorite} ${bestProb}% | 포아송 기대득점(xG) 및 7대 핵심 지표 리포트`;
    const url = `${SITE_URL}/ko/match/${match.date}/${match.slug}/`;

    const favColor = (match.home_prob || 45) >= (match.away_prob || 30) ? '#34d399' : '#60a5fa';
    const favBg = (match.home_prob || 45) >= (match.away_prob || 30)
        ? 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(15,23,42,0.9))'
        : 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(15,23,42,0.9))';

    let displayTime;
    try {
        displayTime = match.match_time ? new Date(match.match_time).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
        }) : match.date;
    } catch { displayTime = match.match_time || match.date; }

    const jsonLd = JSON.stringify([
        {
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: `${match.home_ko} vs ${match.away_ko}`,
            startDate: match.match_time || match.date,
            location: { '@type': 'Place', name: leagueName },
            homeTeam: { '@type': 'SportsTeam', name: match.home_ko },
            awayTeam: { '@type': 'SportsTeam', name: match.away_ko },
            description: description,
        },
        {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Scorenix (스코어닉스)',
            url: SITE_URL,
            sameAs: [
                'https://www.youtube.com/@%EC%8A%A4%EC%BD%94%EC%96%B4%EB%8B%89%EC%8A%A4',
                'https://www.instagram.com/scorenix_official/',
                'https://www.threads.com/@scorenix_official',
                'https://official-scorenix.blogspot.com',
            ],
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: `${match.home_ko} vs ${match.away_ko} 경기의 해외배당 내재 승률은 어떻게 되나요?`,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: `글로벌 배당 마진 제거(Power De-vig) 기준 ${match.home_ko} 승 ${match.home_prob}%, 무승부 ${match.draw_prob}%, ${match.away_ko} 승 ${match.away_prob}%로 산출됩니다. 포아송 기대득점(xG)과 7대 전술 팩터를 결합한 최종 3-Pillar AI 추천 포지션은 Scorenix 본진에서 확인하실 수 있습니다.`,
                    },
                },
            ],
        },
    ]);

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(match.home_ko)}, ${escapeHtml(match.away_ko)}, ${escapeHtml(match.home)}, ${escapeHtml(match.away)}, ${escapeHtml(leagueName)}, 해외배당 흐름, 프로토 분석, 스포츠 데이터 분석, AI 승률 예측, 스코어닉스">
  <link rel="canonical" href="${encodeURI(url)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:url" content="${encodeURI(url)}">
  <meta property="og:site_name" content="Scorenix">
  <meta property="og:title" content="${escapeHtml(`${match.date} ${match.home_ko} vs ${match.away_ko} AI 3-Pillar 승률 분석`)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #0b1120; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 820px; margin: 0 auto; padding: 24px 16px; }
    .breadcrumb { margin-bottom: 20px; font-size: 0.85rem; color: #94a3b8; }
    .breadcrumb a { color: #00d4ff; text-decoration: none; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 32px 24px; margin-bottom: 24px; border: 1px solid rgba(0,212,255,0.25); text-align: center; }
    .league-badge { background: rgba(0,212,255,0.12); color: #00d4ff; padding: 4px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-block; }
    h1 { font-size: 1.75rem; font-weight: 800; color: #f1f5f9; margin: 16px 0; line-height: 1.3; }
    .match-time { color: #94a3b8; font-size: 0.9rem; }
    .section { background: rgba(15,23,42,0.75); border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(51,65,85,0.6); }
    h2 { font-size: 1.15rem; font-weight: 700; color: #e2e8f0; margin-bottom: 16px; }
    .prob-row { margin-bottom: 14px; }
    .prob-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .prob-bar { background: #1e293b; border-radius: 8px; height: 10px; overflow: hidden; }
    .prob-fill { height: 100%; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 12px; text-align: center; color: #94a3b8; font-weight: 600; font-size: 0.85rem; border-bottom: 1px solid #334155; }
    th:first-child { text-align: left; }
    td { padding: 12px; text-align: center; color: #e2e8f0; }
    td:first-child { text-align: left; font-weight: 500; }
    .odds-val { color: #f59e0b; font-weight: 700; }
    tr + tr { border-top: 1px solid rgba(51,65,85,0.3); }
    .verdict { background: ${favBg}; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(52,211,153,0.3); }
    .fav { color: ${favColor}; font-weight: 700; }
    .paywall-box { background: linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.12)); border: 1px solid rgba(0,212,255,0.35); border-radius: 16px; padding: 28px 20px; text-align: center; margin-top: 24px; }
    .btn-primary { display: inline-block; margin: 8px 6px; background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: #fff; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 0.95rem; text-decoration: none; }
    .btn-secondary { display: inline-block; margin: 8px 6px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; text-decoration: none; }
    .seo-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; color: #64748b; font-size: 0.8rem; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/ko">Scorenix 홈</a> › <a href="/ko/stores/">전국 프로토 판매점</a> › ${escapeHtml(match.home_ko)} vs ${escapeHtml(match.away_ko)}
    </nav>
    <div class="header">
      <span class="league-badge">📊 ${escapeHtml(leagueName)}</span>
      <h1>${escapeHtml(match.home_ko)} vs ${escapeHtml(match.away_ko)} AI 승률 및 배당 분석</h1>
      <p class="match-time">📅 ${escapeHtml(displayTime)} (KST)</p>
    </div>
    <section class="section">
      <h2>📈 Pillar 1: 글로벌 배당 마진 제거(De-vig) 기초 승률</h2>
      <div class="prob-row">
        <div class="prob-label"><span>${escapeHtml(match.home_ko)} (홈)</span><span>${match.home_prob}%</span></div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.home_prob}%; background:#34d399"></div></div>
      </div>
      ${match.draw_prob > 0 ? `<div class="prob-row">
        <div class="prob-label"><span>무승부</span><span>${match.draw_prob}%</span></div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.draw_prob}%; background:#475569"></div></div>
      </div>` : ''}
      <div class="prob-row">
        <div class="prob-label"><span>${escapeHtml(match.away_ko)} (원정)</span><span>${match.away_prob}%</span></div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.away_prob}%; background:#60a5fa"></div></div>
      </div>
    </section>
    <section class="verdict">
      <h2>🔬 1차 배당 효율 진단</h2>
      <p>글로벌 배당 마진 제거 기준 <span class="fav">${escapeHtml(favorite)}</span> 방향의 기초 확률이 <strong>${bestProb}%</strong>로 우위를 점하고 있습니다.</p>
    </section>
    <div class="paywall-box">
      <h2 style="color:#ffffff; margin-bottom:10px;">📱 매번 판매점 방문 없이 스마트폰으로 전 경기 AI 조합기를 확인하세요!</h2>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:18px;">
        이번 회차 즉시 열람권(3,900원) 또는 개인 올인원 월 무제한 패스(29,900원)로 마감 직전 배당 급변동까지 실시간 확인하세요.
      </p>
      <a class="btn-primary" href="/ko">🤖 이번 회차 베트맨 14경기 통합 분석표 열기 →</a>
      <a class="btn-secondary" href="/ko/pricing">💎 개인 모바일 패스 & 판매점 무료 벽보 안내</a>
    </div>
  </div>
</body>
</html>`;
}

// ── Generate Regional Proto Store Local SEO Pages (17 Sido + ~230 Sigungu) ──
function generateRegionalStorePages(stores) {
    const storeUrls = [];
    if (!Array.isArray(stores) || stores.length === 0) return storeUrls;

    // Group by sido and sido+sigungu
    const bySido = new Map();
    const byDistrict = new Map();

    for (const st of stores) {
        const sido = (st.sido || '기타').trim();
        const sigungu = (st.sigungu || '전체').trim().split(/\s+/)[0] || '전체';
        if (!bySido.has(sido)) bySido.set(sido, []);
        bySido.get(sido).push(st);

        const dKey = `${sido}-${sigungu}`;
        if (!byDistrict.has(dKey)) {
            byDistrict.set(dKey, { sido, sigungu, slug: toSlug(dKey), items: [] });
        }
        byDistrict.get(dKey).items.push(st);
    }

    // Common CSS for bright official K-Sports Portal style store pages
    const commonStyle = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f6f9; color: #0f172a; line-height: 1.6; }
      .topbar { background: #003996; color: #fff; padding: 12px 16px; font-size: 0.82rem; font-weight: 700; }
      .topbar-inner { max-width: 1080px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
      .topbar a { color: #fde047; text-decoration: none; font-weight: 800; }
      .container { max-width: 1080px; margin: 0 auto; padding: 24px 16px 60px; }
      .breadcrumb { font-size: 0.85rem; color: #475569; margin-bottom: 16px; }
      .breadcrumb a { color: #0046b8; text-decoration: none; font-weight: 700; }
      .hero { background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #0046b8; border-radius: 14px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(15,23,42,0.04); }
      .badge { display: inline-block; background: #eff6ff; color: #0046b8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px; }
      h1 { font-size: 1.55rem; font-weight: 900; color: #0f172a; line-height: 1.35; margin-bottom: 8px; }
      .hero p { font-size: 0.9rem; color: #475569; }
      .cta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-bottom: 22px; }
      .cta-card { border-radius: 12px; padding: 20px; }
      .cta-b2c { background: linear-gradient(135deg, #003996, #0046b8); color: #fff; }
      .cta-b2b { background: linear-gradient(135deg, #064e3b, #047857); color: #fff; }
      .cta-card h2 { font-size: 1.05rem; font-weight: 900; margin-bottom: 6px; }
      .cta-card p { font-size: 0.82rem; opacity: 0.92; margin-bottom: 14px; }
      .btn { display: inline-block; padding: 10px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; text-decoration: none; }
      .btn-yellow { background: #facc15; color: #0f172a; }
      .btn-white { background: #ffffff; color: #0f172a; }
      .card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; margin-bottom: 20px; }
      .card h2 { font-size: 1.15rem; font-weight: 900; margin-bottom: 12px; color: #0f172a; }
      .chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { display: inline-block; padding: 7px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b; font-size: 0.8rem; font-weight: 700; text-decoration: none; }
      .chip:hover { background: #eff6ff; border-color: #0046b8; color: #0046b8; }
      table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
      th { background: #1e293b; color: #fff; padding: 10px 8px; text-align: left; font-weight: 800; }
      td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; vertical-align: middle; }
      tr:nth-child(even) { background: #f8fafc; }
      .tag-dual { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; }
      .tag-slip { display: inline-block; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; }
      .footer { margin-top: 32px; font-size: 0.78rem; color: #64748b; text-align: center; }
      @media (max-width: 640px) { h1 { font-size: 1.25rem; } th, td { font-size: 0.75rem; padding: 8px 5px; } }
    `;

    // 1) Generate District Pages (/ko/stores/[slug]/index.html)
    for (const [, group] of byDistrict) {
        const { sido, sigungu, slug, items } = group;
        const pageUrl = `${SITE_URL}/ko/stores/${slug}/`;
        storeUrls.push({ loc: encodeURI(pageUrl), priority: '0.85', freq: 'weekly' });

        const dualCount = items.filter(x => x.toto_name && x.moef_name && x.toto_name !== x.moef_name).length;
        const title = `[2026 최신] ${sido} ${sigungu} 프로토·스포츠토토 공식 판매점 위치 (${items.length}곳) & 승무패 AI 분석 | 스코어닉스`;
        const desc = `${sido} ${sigungu} 스포츠토토·프로토 공식 판매점 ${items.length}곳의 도로명주소, 2026년 최신 편의점 간판명(${dualCount}곳 구 상호 대조), 스마트슬립 지원 여부 및 이번 회차 승무패 14경기 AI 분석 벽보를 확인하세요.`;

        const siblingDistricts = Array.from(byDistrict.values()).filter(d => d.sido === sido);

        const jsonLd = JSON.stringify([
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${sido} ${sigungu} 공식 프로토·스포츠토토 판매점 목록 (${items.length}곳)`,
                numberOfItems: items.length,
                itemListElement: items.slice(0, 30).map((st, idx) => ({
                    '@type': 'ListItem',
                    position: idx + 1,
                    item: {
                        '@type': 'LocalBusiness',
                        name: st.display_name || st.toto_name,
                        address: st.road_address,
                        ...(st.lat && st.lon ? {
                            geo: { '@type': 'GeoCoordinates', latitude: st.lat, longitude: st.lon }
                        } : {}),
                    },
                })),
            },
            {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: `${sido} ${sigungu}에서 프로토 승부식과 축구토토 승무패를 구매할 수 있는 공식 판매점은 몇 곳인가요?`,
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: `2026년 최신 스포츠토토 및 기획예산처 복권위원회 교차검증 기준, ${sido} ${sigungu}에는 총 ${items.length}곳의 공식 프로토·토토 판매점이 운영 중입니다. 매번 판매점에 방문하기 번거로우신 경우 스코어닉스(scorenix.com) 모바일 패스를 통해 마감 직전 실시간 배당 변동과 14경기 AI 조합기를 집에서 확인하실 수 있습니다.`,
                        },
                    },
                ],
            },
        ]);

        const rowsHtml = items.map(st => {
            const nameHtml = escapeHtml(st.display_name || st.toto_name);
            const dualBadge = (st.toto_name && st.moef_name && st.toto_name !== st.moef_name)
                ? `<br><span class="tag-dual">베트맨 등록: ${escapeHtml(st.toto_name)} ↔ 실제 간판: ${escapeHtml(st.moef_name)}</span>`
                : '';
            const mapQuery = encodeURIComponent(`${st.road_address} ${st.moef_name || st.toto_name}`);
            return `<tr>
              <td><strong>${escapeHtml(st.id)}</strong></td>
              <td><strong>${nameHtml}</strong>${dualBadge}</td>
              <td>${escapeHtml(st.road_address)}</td>
              <td><span class="tag-slip">스마트슬립 ${escapeHtml(st.smart_slip || 'O')}</span></td>
              <td>
                <a href="https://map.naver.com/p/search/${mapQuery}" target="_blank" rel="noopener" style="color:#0046b8;font-weight:800;text-decoration:none;margin-right:8px;">🗺️ 지도</a>
                <a href="/ko/store/print-report/current" style="color:#047857;font-weight:800;text-decoration:none;">🖨️ 무료벽보</a>
              </td>
            </tr>`;
        }).join('\n');

        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(sido)} 프로토 판매점, ${escapeHtml(sigungu)} 프로토 판매점, ${escapeHtml(sigungu)} 스포츠토토 판매점, ${escapeHtml(sigungu)} 토토방, 스마트슬립 판매점, 프로토 승부식 분석, 축구토토 승무패 14경기, 스코어닉스">
  <link rel="canonical" href="${encodeURI(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:url" content="${encodeURI(pageUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>${commonStyle}</style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <span>🏛️ 스코어닉스 전국 6,277개 공식 프로토·토토 판매점 교차검증 위치 백과</span>
      <a href="/ko">📊 이번 회차 승무패 14경기 · 프로토 실시간 AI 분석 바로가기 →</a>
    </div>
  </div>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/ko">스코어닉스 홈</a> › <a href="/ko/stores/">전국 프로토 판매점 디렉토리</a> › <strong>${escapeHtml(sido)} ${escapeHtml(sigungu)} (${items.length}곳)</strong>
    </nav>

    <section class="hero">
      <span class="badge">✅ 2026 스포츠토토 × 기획예산처 복권위 교차검증 완료</span>
      <h1>📍 ${escapeHtml(sido)} ${escapeHtml(sigungu)} 프로토·스포츠토토 공식 판매점 (${items.length}곳)</h1>
      <p>
        <strong>${escapeHtml(sido)} ${escapeHtml(sigungu)}</strong> 지역의 공식 체육진흥투표권(프로토 승부식·축구토토 승무패·농구 승5패·스페셜N) 판매점 <strong>${items.length}곳</strong>의 도로명주소와 실제 매장 간판 상호 대조표입니다.
      </p>
    </section>

    <div class="cta-grid">
      <div class="cta-card cta-b2c">
        <h2>📱 매번 ${escapeHtml(sigungu)} 판매점 방문하기 번거로우신가요?</h2>
        <p>판매점 종이 벽보에는 없는 마감 직전 해외배당 급변동·결장자 반영 최종 픽과 14경기 예산별 자동 마킹 조합기를 집에서 스마트폰으로 편하게 확인하세요!</p>
        <a class="btn btn-yellow" href="/ko">⚡ 이번 회차 AI 승무패·프로토 분석표 열기 →</a>
        <a class="btn btn-white" href="/ko/pricing" style="margin-left:6px;">💎 개인 모바일 무제한 패스</a>
      </div>
      <div class="cta-card cta-b2b">
        <h2>🏪 ${escapeHtml(sido)} ${escapeHtml(sigungu)} 판매점 사장님이신가요?</h2>
        <p>스코어닉스는 전국 공식 판매점의 매출 상승을 위해 매장 상호명이 인쇄된 <strong>A4 1장 요약 분석 벽보</strong>와 <strong>PC 모니터 전광판</strong>을 <strong>평생 0원(100% 무료)</strong>으로 지원합니다!</p>
        <a class="btn btn-yellow" href="/ko/store/print-report/current">🖨️ 사장님 무료 A4 분석벽보 원클릭 인쇄 →</a>
      </div>
    </div>

    <section class="card">
      <h2>📋 ${escapeHtml(sido)} ${escapeHtml(sigungu)} 공식 프로토 판매점 전체 목록 (${items.length}개 매장)</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>매장코드</th>
              <th>통합 상호명 (베트맨 등록명 ↔ 실제 간판명)</th>
              <th>도로명주소</th>
              <th>스마트슬립</th>
              <th>위치 / 점주 무료 인쇄</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>🗺️ ${escapeHtml(sido)} 내 다른 시·군·구 프로토 판매점 찾기</h2>
      <div class="chip-list">
        ${siblingDistricts.map(d => `<a class="chip" href="/ko/stores/${d.slug}/">${escapeHtml(d.sido)} ${escapeHtml(d.sigungu)} (${d.items.length})</a>`).join('\n')}
      </div>
    </section>

    <div class="footer">
      <p>⚖️ 스코어닉스(Scorenix)는 불법 사설 도박을 근절하고 국민체육진흥공단(베트맨) 및 복권위원회의 건전 레저문화 정착 캠페인을 지지하는 스포츠 데이터 분석 연구소입니다.</p>
    </div>
  </div>
</body>
</html>`;

        const dir = join(OUT_DIR, 'ko', 'stores', slug);
        ensureDir(dir);
        writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    }

    // 2) Generate Nationwide Hub Page (/ko/stores/index.html)
    const hubUrl = `${SITE_URL}/ko/stores/`;
    storeUrls.unshift({ loc: encodeURI(hubUrl), priority: '0.9', freq: 'weekly' });

    const allDistrictsSorted = Array.from(byDistrict.values()).sort((a, b) => b.items.length - a.items.length);
    const sidoSummaryHtml = Array.from(bySido.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([sido, list]) => {
            const dList = Array.from(byDistrict.values()).filter(d => d.sido === sido);
            return `<section class="card">
              <h2>📍 ${escapeHtml(sido)} 공식 프로토·토토 판매점 (${list.length.toLocaleString()}곳)</h2>
              <div class="chip-list">
                ${dList.map(d => `<a class="chip" href="/ko/stores/${d.slug}/">${escapeHtml(d.sigungu)} (${d.items.length}곳)</a>`).join('\n')}
              </div>
            </section>`;
        }).join('\n');

    const hubHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[2026 최신] 전국 6,277개 프로토·스포츠토토 공식 판매점 시·군·구별 위치 백과 & 무료 A4 분석벽보 | 스코어닉스</title>
  <meta name="description" content="전국 17개 시도, 230여 개 시군구 6,277개 공식 프로토·스포츠토토 판매점의 도로명주소, 2026년 최신 편의점 간판명 대조표, 스마트슬립 여부 및 매장 비치용 무료 A4 AI 분석 벽보를 확인하세요.">
  <link rel="canonical" href="${encodeURI(hubUrl)}">
  <style>${commonStyle}</style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <span>🏛️ 스코어닉스 전국 6,277개 공식 프로토·토토 판매점 시·군·구별 총람</span>
      <a href="/ko">📊 이번 회차 승무패 14경기 · 프로토 실시간 AI 분석 대시보드 →</a>
    </div>
  </div>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/ko">스코어닉스 홈</a> › <strong>전국 프로토 판매점 시·군·구별 위치 백과 (6,277곳)</strong>
    </nav>
    <section class="hero">
      <span class="badge">✅ 전국 17개 시·도 / ${allDistrictsSorted.length}개 시·군·구 공식 매장 수록</span>
      <h1>🗺️ 전국 6,277개 프로토·스포츠토토 공식 판매점 지역별 디렉토리</h1>
      <p>우리 동네 시·군·구를 클릭하면 베트맨 공식 등록 상호와 2026년 최신 간판 상호(편의점 전환 매장 등), 도로명주소, 스마트슬립 여부를 한눈에 확인할 수 있습니다.</p>
    </section>

    <div class="cta-grid">
      <div class="cta-card cta-b2c">
        <h2>📱 매번 판매점 가기 번거로운 개인 고객님이신가요?</h2>
        <p>집에서 스마트폰으로 마감 직전 해외배당 급변동·결장자 반영 최종 픽과 승무패 14경기 예산별 자동 마킹 조합기를 무제한 이용하세요!</p>
        <a class="btn btn-yellow" href="/ko/pricing">💎 개인 모바일 패스 (3,900원 / 월 29,900원) 보기 →</a>
      </div>
      <div class="cta-card cta-b2b">
        <h2>🏪 전국 복권방·토토 판매점 사장님이신가요?</h2>
        <p>사장님 매장 상호명이 찍힌 <strong>A4 1장 요약 분석 벽보</strong>와 <strong>PC 모니터 전광판 모드</strong>는 <strong>평생 0원(100% 무료)</strong>입니다!</p>
        <a class="btn btn-yellow" href="/ko/store/print-report/current">🖨️ 사장님 무료 A4 벽보 지금 인쇄하기 →</a>
      </div>
    </div>

    ${sidoSummaryHtml}
  </div>
</body>
</html>`;

    const hubDir = join(OUT_DIR, 'ko', 'stores');
    ensureDir(hubDir);
    writeFileSync(join(hubDir, 'index.html'), hubHtml, 'utf-8');

    return storeUrls;
}

// ── Sitemap.xml ──
function generateSitemap(matches, storeUrls = []) {
    const today = new Date().toISOString().split('T')[0];
    const staticUrls = [
        { loc: `${SITE_URL}/ko`, priority: '1.0', freq: 'daily' },
        { loc: `${SITE_URL}/ko/analysis`, priority: '0.95', freq: 'hourly' },
        { loc: `${SITE_URL}/ko/bets`, priority: '0.9', freq: 'hourly' },
        { loc: `${SITE_URL}/ko/vip`, priority: '0.85', freq: 'daily' },
        { loc: `${SITE_URL}/ko/vip/portfolio`, priority: '0.85', freq: 'daily' },
        { loc: `${SITE_URL}/ko/mypage`, priority: '0.8', freq: 'daily' },
        { loc: `${SITE_URL}/ko/pricing`, priority: '0.9', freq: 'weekly' },
        { loc: `${SITE_URL}/ko/manual`, priority: '0.5', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/disclaimer`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/privacy`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/terms`, priority: '0.3', freq: 'monthly' },
    ];

    const matchUrls = matches.map(m => ({
        loc: encodeURI(`${SITE_URL}/ko/match/${m.date}/${m.slug}/`),
        priority: '0.75',
        freq: 'daily',
    }));

    const all = [...staticUrls, ...storeUrls, ...matchUrls];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

// ── Robots.txt ──
function generateRobots() {
    return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /register/
Disallow: /login/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ── Main ──
async function fetchWithRetry(url, retries = 3, delayMs = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
            if (res.status === 429 && i < retries - 1) {
                await new Promise(r => setTimeout(r, delayMs * (i + 1)));
                continue;
            }
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return null;
}

async function main() {
    console.log('🔧 SEO 페이지 생성 시작...');

    // 1. Fetch match data from /api/ai/match-list
    let matches = [];
    try {
        const data = await fetchWithRetry(`${API_BASE}/api/ai/match-list`, 2, 2000);
        if (data && data.matches) {
            matches = data.matches;
        }
    } catch (e) {
        console.warn(`⚠ match-list 호출 실패: ${e.message}`);
    }

    if (matches.length < 50) {
        try {
            const predData = await fetchWithRetry(`${API_BASE}/api/ai/predictions`, 3, 4000);
            if (predData && predData.predictions && predData.predictions.length > matches.length) {
                const preds = predData.predictions;
                matches = preds.map((p) => {
                    const rawTime = String(p.match_time || '');
                    const dateStr = rawTime.includes('T') ? rawTime.split('T')[0] : (rawTime.includes(' ') ? rawTime.split(' ')[0] : new Date().toISOString().split('T')[0]);
                    const slug = `${toSlug(p.team_home)}-vs-${toSlug(p.team_away)}`;
                    return {
                        date: dateStr,
                        slug,
                        match_id: p.match_id || `${p.team_home}_${p.team_away}`,
                        match_time: p.match_time,
                        home: p.team_home,
                        away: p.team_away,
                        home_ko: p.team_home_ko || p.team_home,
                        away_ko: p.team_away_ko || p.team_away,
                        home_odds: p.home_odds || Number((100 / Math.max(p.home_win_prob || 45, 10)).toFixed(2)),
                        draw_odds: p.draw_odds || (p.draw_prob > 0 ? Number((100 / Math.max(p.draw_prob, 10)).toFixed(2)) : 0),
                        away_odds: p.away_odds || Number((100 / Math.max(p.away_win_prob || 30, 10)).toFixed(2)),
                        home_prob: p.home_win_prob || 45,
                        draw_prob: p.draw_prob || 0,
                        away_prob: p.away_win_prob || 30,
                        league: p.league || '글로벌 리그',
                    };
                });
            }
        } catch (e2) {
            console.warn(`⚠ predictions 폴백 호출 실패: ${e2.message}`);
        }
    }

    console.log(`📊 ${matches.length}개 경기 데이터 수신`);

    // 2. Generate individual match pages
    let generated = 0;
    for (const match of matches) {
        if (!match.date || !match.slug) continue;
        const dir = join(OUT_DIR, 'ko', 'match', match.date, match.slug);
        ensureDir(dir);
        const html = generateMatchPage(match);
        writeFileSync(join(dir, 'index.html'), html, 'utf-8');
        generated++;
    }
    console.log(`✅ ${generated}개 경기 분석 HTML 페이지 생성`);

    // 3. Generate Nationwide Regional Proto Store Local SEO Pages (6,277 stores -> ~230 district pages)
    let storeUrls = [];
    try {
        const storesJsonPath = join(process.cwd(), '..', 'backend', 'app', 'data', 'proto_stores_master.json');
        if (existsSync(storesJsonPath)) {
            const rawStores = JSON.parse(readFileSync(storesJsonPath, 'utf-8'));
            storeUrls = generateRegionalStorePages(rawStores);
            console.log(`🏪 전국 프로토 판매점 Local SEO 랜딩페이지 ${storeUrls.length}개 생성 완료 (/ko/stores/...)`);
        } else {
            console.warn(`⚠ proto_stores_master.json 파일을 찾을 수 없습니다: ${storesJsonPath}`);
        }
    } catch (err) {
        console.warn(`⚠ 지역별 판매점 SEO 생성 오류: ${err.message}`);
    }

    // 4. Sitemap
    const sitemap = generateSitemap(matches, storeUrls);
    writeFileSync(join(OUT_DIR, 'sitemap.xml'), sitemap, 'utf-8');
    console.log(`📋 sitemap.xml 생성 (${11 + storeUrls.length + generated} URLs)`);

    // 5. Robots.txt
    writeFileSync(join(OUT_DIR, 'robots.txt'), generateRobots(), 'utf-8');
    console.log('🤖 robots.txt 생성');

    console.log('\n🎉 SEO 파일 생성 완료!');
}

main().catch(console.error);
