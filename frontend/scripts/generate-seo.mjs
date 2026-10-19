/**
 * 빌드 후 실행: 각 경기별 SEO 정적 HTML 페이지를 out/ 디렉터리에 직접 생성
 * + sitemap.xml, robots.txt
 *
 * Usage: node scripts/generate-seo.mjs
 */

const SITE_URL = 'https://scorenix.com';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'out');

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

    // Format match time
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
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${match.home_ko}, ${match.away_ko}, ${match.home}, ${match.away}, ${leagueName}, 해외배당 흐름, 프로토 분석, 스포츠 데이터 분석, AI 승률 예측, 스코어닉스">
  <link rel="canonical" href="${url}">
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Scorenix">
  <meta property="og:title" content="${match.date} ${match.home_ko} vs ${match.away_ko} AI 3-Pillar 승률 분석">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${match.date} ${match.home_ko} vs ${match.away_ko} AI 3-Pillar 승률 분석">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.png">
  <!-- JSON-LD -->
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #0b1120; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 820px; margin: 0 auto; padding: 24px 16px; }
    .breadcrumb { margin-bottom: 20px; font-size: 0.85rem; color: #94a3b8; }
    .breadcrumb a { color: #00d4ff; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 32px 24px; margin-bottom: 24px; border: 1px solid rgba(0,212,255,0.25); text-align: center; }
    .league-badge { background: rgba(0,212,255,0.12); color: #00d4ff; padding: 4px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-block; }
    h1 { font-size: 1.75rem; font-weight: 800; color: #f1f5f9; margin: 16px 0; line-height: 1.3; }
    .match-time { color: #94a3b8; font-size: 0.9rem; }
    .section { background: rgba(15,23,42,0.75); border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(51,65,85,0.6); }
    h2 { font-size: 1.15rem; font-weight: 700; color: #e2e8f0; margin-bottom: 16px; }
    .prob-row { margin-bottom: 14px; }
    .prob-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .prob-label span:first-child { font-weight: 600; }
    .prob-bar { background: #1e293b; border-radius: 8px; height: 10px; overflow: hidden; }
    .prob-fill { height: 100%; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 12px; text-align: center; color: #94a3b8; font-weight: 600; font-size: 0.85rem; border-bottom: 1px solid #334155; }
    th:first-child { text-align: left; }
    td { padding: 12px; text-align: center; color: #e2e8f0; }
    td:first-child { text-align: left; font-weight: 500; }
    .odds-val { color: #f59e0b; font-weight: 700; }
    tr + tr { border-top: 1px solid rgba(51,65,85,0.3); }
    .verdict { background: ${favBg}; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid ${(match.home_prob || 45) >= (match.away_prob || 30) ? 'rgba(52,211,153,0.3)' : 'rgba(96,165,250,0.3)'}; }
    .fav { color: ${favColor}; font-weight: 700; }
    .paywall-box { background: linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.12)); border: 1px solid rgba(0,212,255,0.35); border-radius: 16px; padding: 28px 20px; text-align: center; margin-top: 24px; }
    .sample-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(16,185,129,0.2); color: #34d399; font-size: 0.78rem; font-weight: 800; margin-bottom: 10px; }
    .btn-primary { display: inline-block; margin: 8px 6px; background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: #fff; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 0.95rem; text-decoration: none; box-shadow: 0 4px 16px rgba(0,212,255,0.25); }
    .btn-secondary { display: inline-block; margin: 8px 6px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; text-decoration: none; }
    .seo-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; color: #64748b; font-size: 0.8rem; line-height: 1.7; }
    @media (max-width: 640px) { h1 { font-size: 1.35rem; } .container { padding: 16px 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/ko">Scorenix 홈</a> › <a href="/ko/analysis">AI 매치 데이터 리포트</a> › ${match.home_ko} vs ${match.away_ko}
    </nav>

    <div class="header">
      <span class="league-badge">📊 ${leagueName}</span>
      <h1>${match.home_ko} vs ${match.away_ko} AI 승률 및 배당 분석</h1>
      <p class="match-time">📅 ${displayTime} (KST)</p>
    </div>

    <section class="section">
      <h2>📈 Pillar 1: 글로벌 배당 마진 제거(De-vig) 기초 승률</h2>
      <div class="prob-row">
        <div class="prob-label">
          <span>${match.home_ko} (홈)</span>
          <span style="color:${(match.home_prob || 45) >= (match.away_prob || 30) ? '#34d399' : '#94a3b8'}; font-weight:700">${match.home_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.home_prob}%; background:${(match.home_prob || 45) >= (match.away_prob || 30) ? 'linear-gradient(90deg,#059669,#34d399)' : '#475569'}"></div></div>
      </div>
      ${match.draw_prob > 0 ? `
      <div class="prob-row">
        <div class="prob-label">
          <span>무승부</span>
          <span style="color:#94a3b8; font-weight:700">${match.draw_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.draw_prob}%; background:#475569"></div></div>
      </div>` : ''}
      <div class="prob-row">
        <div class="prob-label">
          <span>${match.away_ko} (원정)</span>
          <span style="color:${(match.away_prob || 30) > (match.home_prob || 45) ? '#60a5fa' : '#94a3b8'}; font-weight:700">${match.away_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.away_prob}%; background:${(match.away_prob || 30) > (match.home_prob || 45) ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : '#475569'}"></div></div>
      </div>
    </section>

    <section class="section">
      <h2>📊 글로벌 기준 배당률 및 내재 확률</h2>
      <table>
        <thead><tr><th>포지션</th><th>기준 배당</th><th>순수 내재 확률</th></tr></thead>
        <tbody>
          <tr><td>${match.home_ko} 승</td><td class="odds-val">${match.home_odds || '-'}</td><td>${match.home_prob}%</td></tr>
          ${match.draw_odds > 1.0 ? `<tr><td>무승부</td><td class="odds-val">${match.draw_odds}</td><td>${match.draw_prob}%</td></tr>` : ''}
          <tr><td>${match.away_ko} 승</td><td class="odds-val">${match.away_odds || '-'}</td><td>${match.away_prob}%</td></tr>
        </tbody>
      </table>
    </section>

    <section class="verdict">
      <h2>🔬 1차 배당 효율 진단</h2>
      <p>글로벌 배당 마진 제거(Power De-vig) 기준, <span class="fav">${favorite}</span> 방향의 기초 확률이 <strong>${bestProb}%</strong>로 우위를 점하고 있습니다. 단, 실제 기대값(+EV)과 이변 가능성은 <strong>포아송 기대득점(xG) 시뮬레이션</strong> 및 <strong>최근 5경기 폼·순위 7대 팩터</strong>와의 교차 검증을 통해 최종 확정됩니다.</p>
    </section>

    <div class="paywall-box">
      <div class="sample-pill">🎁 매일 1경기 7대 팩터 AI 통계 리포트 100% 무료 공개 중</div>
      <h2 style="color:#ffffff; margin-bottom:10px;">🔒 ${match.home_ko} vs ${match.away_ko} 7대 핵심 지표 & 오늘의 +EV 핵심 밸류 리포트 3경기</h2>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:18px;">
        포아송 기대득점(xG) · 최근 5경기 공수 흐름 · 글로벌 시장 확률 편차 · 켈리 공식 최적 비중 시뮬레이션을 커피 한 잔 값(월 3,900원)으로 무제한 확인하세요.
      </p>
      <a class="btn-primary" href="/ko/analysis">🤖 오늘의 무료 AI 샘플 & 핵심 밸류 리포트 열기 →</a>
      <a class="btn-secondary" href="/ko/pricing">☕ 월 3,900원 데이터 멤버십 안내</a>
    </div>

    <div class="seo-footer">
      <div style="margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 12px; font-weight: 600;">
        <a href="https://www.youtube.com/@%EC%8A%A4%EC%BD%94%EC%96%B4%EB%8B%89%EC%8A%A4" target="_blank" rel="noopener" style="color: #f87171; text-decoration: none;">🎬 공식 유튜브 (@스코어닉스)</a>
        <a href="https://www.instagram.com/scorenix_official/" target="_blank" rel="noopener" style="color: #f472b6; text-decoration: none;">📸 공식 인스타그램 (@scorenix_official)</a>
        <a href="https://www.threads.com/@scorenix_official" target="_blank" rel="noopener" style="color: #cbd5e1; text-decoration: none;">🧵 공식 쓰레드 (@scorenix_official)</a>
        <a href="https://official-scorenix.blogspot.com" target="_blank" rel="noopener" style="color: #fbbf24; text-decoration: none;">✍️ 공식 AI 분석 블로그</a>
      </div>
      <p>⚖️ 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다. 모든 스포츠 관전 및 분석의 최종 판단과 책임은 사용자 본인에게 있습니다.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Sitemap.xml ──
function generateSitemap(matches) {
    const today = new Date().toISOString().split('T')[0];
    const staticUrls = [
        { loc: `${SITE_URL}/ko`, priority: '1.0', freq: 'daily' },
        { loc: `${SITE_URL}/ko/analysis`, priority: '0.95', freq: 'hourly' },
        { loc: `${SITE_URL}/ko/bets`, priority: '0.9', freq: 'hourly' },
        { loc: `${SITE_URL}/ko/vip`, priority: '0.85', freq: 'daily' },
        { loc: `${SITE_URL}/ko/vip/portfolio`, priority: '0.85', freq: 'daily' },
        { loc: `${SITE_URL}/ko/mypage`, priority: '0.8', freq: 'daily' },
        { loc: `${SITE_URL}/ko/pricing`, priority: '0.8', freq: 'weekly' },
        { loc: `${SITE_URL}/ko/manual`, priority: '0.5', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/disclaimer`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/privacy`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/terms`, priority: '0.3', freq: 'monthly' },
    ];

    const matchUrls = matches.map(m => ({
        loc: `${SITE_URL}/ko/match/${m.date}/${m.slug}/`,
        priority: '0.75',
        freq: 'daily',
    }));

    const all = [...staticUrls, ...matchUrls];
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
                console.log(`⏳ Rate limit (429) 대기 후 재시도 (${i + 1}/${retries})...`);
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

    // 1. Fetch match data from /api/ai/match-list (with fallback to /api/ai/predictions)
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

    // 3. Sitemap
    const sitemap = generateSitemap(matches);
    writeFileSync(join(OUT_DIR, 'sitemap.xml'), sitemap, 'utf-8');
    console.log(`📋 sitemap.xml 생성 (${11 + generated} URLs)`);

    // 4. Robots.txt
    writeFileSync(join(OUT_DIR, 'robots.txt'), generateRobots(), 'utf-8');
    console.log('🤖 robots.txt 생성');

    console.log('\n🎉 SEO 파일 생성 완료!');
}

main().catch(console.error);
