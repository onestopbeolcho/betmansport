/**
 * 빌드 후 실행: 각 경기별 SEO 정적 HTML 페이지를 out/ 디렉터리에 직접 생성
 * + sitemap.xml, robots.txt
 *
 * Usage: node scripts/generate-seo.mjs
 */

const SITE_URL = 'https://scorenix.com';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'out');

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ── League Helpers ──
const LEAGUE_NAMES = {
    'soccer_epl': '프리미어리그',
    'soccer_spain_la_liga': '라리가',
    'soccer_germany_bundesliga': '분데스리가',
    'soccer_italy_serie_a': '세리에A',
    'soccer_france_ligue_one': '리그앙',
    'soccer_uefa_champs_league': 'UEFA 챔피언스리그',
    'soccer_uefa_europa_league': 'UEFA 유로파리그',
    'basketball_nba': 'NBA',
};

function getLeagueName(key) { return LEAGUE_NAMES[key] || key; }

// ── Generate individual match HTML page ──
function generateMatchPage(match) {
    const bestProb = Math.max(match.home_prob, match.draw_prob, match.away_prob);
    const favorite = match.home_prob >= match.away_prob ? match.home_ko : match.away_ko;
    const leagueName = getLeagueName(match.league);
    const title = `${match.date} ${match.home_ko} vs ${match.away_ko} AI 경기분석 | Scorenix`;
    const description = `AI 예측: ${favorite} 우세 ${bestProb}% | ${leagueName} | 배당: 홈 ${match.home_odds} / 무 ${match.draw_odds} / 원정 ${match.away_odds}`;
    const url = `${SITE_URL}/ko/match/${match.date}/${match.slug}/`;

    const favColor = match.home_prob >= match.away_prob ? '#34d399' : '#60a5fa';
    const favBg = match.home_prob >= match.away_prob
        ? 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(15,23,42,0.9))'
        : 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(15,23,42,0.9))';

    // Format match time
    let displayTime;
    try {
        displayTime = new Date(match.match_time).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
        });
    } catch { displayTime = match.match_time; }

    const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: `${match.home_ko} vs ${match.away_ko}`,
        startDate: match.match_time,
        location: { '@type': 'Place', name: leagueName },
        homeTeam: { '@type': 'SportsTeam', name: match.home_ko },
        awayTeam: { '@type': 'SportsTeam', name: match.away_ko },
        description: `AI 예측: ${favorite} 우세 ${bestProb}%`,
    });

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${match.home_ko}, ${match.away_ko}, ${match.home}, ${match.away}, ${leagueName}, 축구 분석, AI 예측, 배당률, 스코어닉스">
  <link rel="canonical" href="${url}">
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Scorenix">
  <meta property="og:title" content="${match.date} ${match.home_ko} vs ${match.away_ko} AI분석">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${match.date} ${match.home_ko} vs ${match.away_ko} AI분석">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.png">
  <!-- JSON-LD -->
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #0b1120; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
    .breadcrumb { margin-bottom: 20px; font-size: 0.85rem; color: #94a3b8; }
    .breadcrumb a { color: #60a5fa; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 32px 24px; margin-bottom: 24px; border: 1px solid rgba(99,102,241,0.2); text-align: center; }
    .league-badge { background: rgba(99,102,241,0.15); color: #818cf8; padding: 4px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; display: inline-block; }
    h1 { font-size: 1.75rem; font-weight: 800; color: #f1f5f9; margin: 16px 0; line-height: 1.3; }
    .match-time { color: #94a3b8; font-size: 0.9rem; }
    .section { background: rgba(15,23,42,0.6); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(51,65,85,0.5); }
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
    .verdict { background: ${favBg}; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid ${match.home_prob >= match.away_prob ? 'rgba(52,211,153,0.3)' : 'rgba(96,165,250,0.3)'}; }
    .fav { color: ${favColor}; font-weight: 700; }
    .cta { text-align: center; margin-top: 32px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 1rem; text-decoration: none; box-shadow: 0 4px 14px rgba(99,102,241,0.3); }
    .cta a:hover { opacity: 0.9; }
    .seo-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; color: #64748b; font-size: 0.8rem; line-height: 1.7; }
    @media (max-width: 640px) { h1 { font-size: 1.35rem; } .container { padding: 16px 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/ko/">홈</a> › <a href="/ko/bets">AI 경기분석</a> › ${match.home_ko} vs ${match.away_ko}
    </nav>

    <div class="header">
      <span class="league-badge">⚽ ${leagueName}</span>
      <h1>${match.home_ko} vs ${match.away_ko}</h1>
      <p class="match-time">📅 ${displayTime} (KST)</p>
    </div>

    <section class="section">
      <h2>🤖 AI 승률 예측</h2>
      <div class="prob-row">
        <div class="prob-label">
          <span>${match.home_ko} 승</span>
          <span style="color:${match.home_prob >= match.away_prob ? '#34d399' : '#94a3b8'}; font-weight:700">${match.home_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.home_prob}%; background:${match.home_prob >= match.away_prob ? 'linear-gradient(90deg,#059669,#34d399)' : '#475569'}"></div></div>
      </div>
      <div class="prob-row">
        <div class="prob-label">
          <span>무승부</span>
          <span style="color:#94a3b8; font-weight:700">${match.draw_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.draw_prob}%; background:#475569"></div></div>
      </div>
      <div class="prob-row">
        <div class="prob-label">
          <span>${match.away_ko} 승</span>
          <span style="color:${match.away_prob > match.home_prob ? '#60a5fa' : '#94a3b8'}; font-weight:700">${match.away_prob}%</span>
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${match.away_prob}%; background:${match.away_prob > match.home_prob ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : '#475569'}"></div></div>
      </div>
    </section>

    <section class="section">
      <h2>📊 Pinnacle 배당률</h2>
      <table>
        <thead><tr><th>포지션</th><th>배당</th><th>내재 확률</th></tr></thead>
        <tbody>
          <tr><td>${match.home_ko} 승</td><td class="odds-val">${match.home_odds}</td><td>${match.home_prob}%</td></tr>
          <tr><td>무승부</td><td class="odds-val">${match.draw_odds}</td><td>${match.draw_prob}%</td></tr>
          <tr><td>${match.away_ko} 승</td><td class="odds-val">${match.away_odds}</td><td>${match.away_prob}%</td></tr>
        </tbody>
      </table>
    </section>

    <section class="verdict">
      <h2>🎯 AI 분석 의견</h2>
      <p>Pinnacle 배당률 기준, <span class="fav">${favorite}</span>의 승리 확률이 <strong>${bestProb}%</strong>로 가장 높게 평가됩니다. 배당률 내재 확률(Implied Probability)은 북메이커의 마진을 제거한 객관적 수치입니다.</p>
      <p style="color:#94a3b8; font-size:0.85rem; margin-top:12px; font-style:italic">※ 이 분석은 배당 데이터 기반 통계입니다. 최종 판단은 본인의 책임입니다.</p>
    </section>

    <div class="cta">
      <a href="/ko/bets">🔍 전체 AI 분석 보기</a>
    </div>

    <div class="seo-footer">
      <p>Scorenix는 AI 기술을 활용한 스포츠 데이터 분석 플랫폼입니다. Pinnacle 배당률, LightGBM 머신러닝 모델, 다양한 통계 데이터를 종합하여 객관적인 경기 분석 정보를 제공합니다. ${match.home_ko} vs ${match.away_ko} 경기의 상세 분석, AI 승률 예측, 배당률 비교 정보를 확인하세요.</p>
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
        { loc: `${SITE_URL}/ko/bets`, priority: '0.9', freq: 'hourly' },
        { loc: `${SITE_URL}/ko/analysis`, priority: '0.8', freq: 'daily' },
        { loc: `${SITE_URL}/ko/pricing`, priority: '0.6', freq: 'weekly' },
        { loc: `${SITE_URL}/ko/manual`, priority: '0.4', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/disclaimer`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/privacy`, priority: '0.3', freq: 'monthly' },
        { loc: `${SITE_URL}/ko/terms`, priority: '0.3', freq: 'monthly' },
    ];

    const matchUrls = matches.map(m => ({
        loc: `${SITE_URL}/ko/match/${m.date}/${m.slug}/`,
        priority: '0.7',
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
Disallow: /mypage/
Disallow: /register/
Disallow: /login/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ── Main ──
async function main() {
    console.log('🔧 SEO 페이지 생성 시작...');

    // 1. Fetch match data from API
    let matches = [];
    try {
        const res = await fetch(`${API_BASE}/api/ai/match-list`);
        if (res.ok) {
            const data = await res.json();
            matches = data.matches || [];
        }
    } catch (e) {
        console.warn(`⚠ match-list 호출 실패: ${e.message}`);
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
    console.log(`📋 sitemap.xml 생성 (${8 + matches.length} URLs)`);

    // 4. Robots.txt
    writeFileSync(join(OUT_DIR, 'robots.txt'), generateRobots(), 'utf-8');
    console.log('🤖 robots.txt 생성');

    console.log('\n🎉 SEO 파일 생성 완료!');
}

main().catch(console.error);
