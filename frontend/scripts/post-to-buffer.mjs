/**
 * Buffer SNS 자동 포스팅 스크립트 (GraphQL API)
 * 빌드 후 실행: 오늘 경기 분석 URL을 Buffer에 자동 포스팅
 *
 * 환경변수:
 *   BUFFER_ACCESS_TOKEN  - Buffer API Bearer 토큰
 *
 * 채널 (자동 감지):
 *   - Instagram: scorenix_official
 *   - Facebook: Scorenix
 *
 * Usage: node scripts/post-to-buffer.mjs
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';
const SITE_URL = 'https://scorenix.com';
const BUFFER_GQL = 'https://api.buffer.com/graphql';
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN || '';
const ORG_ID = '69a97caa77b8d8d061bc4c83';

// ── League names ──
const LEAGUE_NAMES = {
    'soccer_epl': '프리미어리그',
    'soccer_spain_la_liga': '라리가',
    'soccer_germany_bundesliga': '분데스리가',
    'soccer_italy_serie_a': '세리에A',
    'soccer_france_ligue_one': '리그앙',
    'soccer_uefa_champs_league': 'UCL',
    'soccer_uefa_europa_league': 'UEL',
    'basketball_nba': 'NBA',
};

const LEAGUE_EMOJI = {
    'soccer_epl': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'soccer_spain_la_liga': '🇪🇸',
    'soccer_germany_bundesliga': '🇩🇪',
    'soccer_italy_serie_a': '🇮🇹',
    'soccer_france_ligue_one': '🇫🇷',
    'soccer_uefa_champs_league': '🏆',
    'soccer_uefa_europa_league': '🏆',
    'basketball_nba': '🏀',
};

// ── Buffer GraphQL helper ──
async function bufferQuery(query, variables = {}) {
    const res = await fetch(BUFFER_GQL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BUFFER_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

// ── Get connected channels ──
async function getChannels() {
    const { data } = await bufferQuery(`{
    channels(input: { organizationId: "${ORG_ID}" }) {
      id name service type
    }
  }`);
    return data?.channels || [];
}

// ── Create post via GraphQL ──
async function createPost(channelId, text) {
    const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id text }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

    const variables = {
        input: {
            channelId,
            text,
            schedulingType: 'automatic',
            mode: 'addToQueue',
        }
    };

    const result = await bufferQuery(mutation, variables);

    if (result.data?.createPost?.post) {
        return { success: true, postId: result.data.createPost.post.id };
    } else {
        const errMsg = result.data?.createPost?.message
            || result.errors?.[0]?.message
            || JSON.stringify(result);
        return { success: false, error: errMsg };
    }
}

// ── Generate post text ──
function generatePostText(match, platform) {
    const bestProb = Math.max(match.home_prob, match.draw_prob, match.away_prob);
    const favorite = match.home_prob >= match.away_prob ? match.home_ko : match.away_ko;
    const emoji = LEAGUE_EMOJI[match.league] || '⚽';
    const league = LEAGUE_NAMES[match.league] || match.league;
    const url = `${SITE_URL}/ko/match/${match.date}/${match.slug}/`;

    if (platform === 'instagram') {
        // Instagram: no clickable links in captions, focus on hashtags
        return `🤖 AI 경기분석 | ${match.date}

${emoji} ${match.home_ko} vs ${match.away_ko}
🏟️ ${league}
📊 AI 예측: ${favorite} 우세 ${bestProb}%
💰 배당: 홈 ${match.home_odds} / 무 ${match.draw_odds} / 원정 ${match.away_odds}

🔗 프로필 링크에서 자세한 분석 확인!

#축구분석 #AI예측 #스포츠분석 #Scorenix #스코어닉스
#${match.home_ko.replace(/\s/g, '')} #${match.away_ko.replace(/\s/g, '')}
#${league.replace(/\s/g, '')} #해외축구 #배당분석`;
    }

    // Facebook / default
    return `🤖 AI 경기분석 | ${match.date}

${emoji} ${match.home_ko} vs ${match.away_ko}
🏟️ ${league}
📊 AI 예측: ${favorite} 우세 ${bestProb}%
💰 배당: 홈 ${match.home_odds} / 무 ${match.draw_odds} / 원정 ${match.away_odds}

🔗 자세한 분석 보기: ${url}

#축구분석 #AI예측 #Scorenix`;
}

// ── Select top matches ──
function selectTopMatches(matches, maxPosts = 5) {
    const sorted = [...matches].sort((a, b) => {
        const aMax = Math.max(a.home_prob, a.draw_prob, a.away_prob);
        const bMax = Math.max(b.home_prob, b.draw_prob, b.away_prob);
        return bMax - aMax;
    });
    return sorted.slice(0, maxPosts);
}

// ── Main ──
async function main() {
    console.log('📱 Buffer SNS 포스팅 시작...\n');

    // Check token
    if (!BUFFER_TOKEN) {
        console.log('⚠️  BUFFER_ACCESS_TOKEN 미설정 — Buffer 포스팅 건너뜀');
        console.log('   환경변수를 추가해주세요: BUFFER_ACCESS_TOKEN=your_token\n');
        return;
    }

    // 1. Get channels
    const channels = await getChannels();
    if (channels.length === 0) {
        console.log('⚠️  연결된 SNS 채널 없음');
        return;
    }
    console.log(`📡 연결된 채널 ${channels.length}개:`);
    channels.forEach(ch => console.log(`   • ${ch.service} — ${ch.name} (${ch.id})`));
    console.log('');

    // 2. Fetch matches
    let matches = [];
    try {
        const res = await fetch(`${API_BASE}/api/ai/match-list`);
        if (res.ok) {
            const data = await res.json();
            matches = data.matches || [];
        }
    } catch (e) {
        console.error(`❌ match-list API 호출 실패: ${e.message}`);
        return;
    }

    if (matches.length === 0) {
        console.log('📭 포스팅할 경기 없음');
        return;
    }

    // 3. Select top matches
    const today = new Date().toISOString().split('T')[0];
    const todayMatches = matches.filter(m => m.date === today);
    const target = todayMatches.length > 0 ? todayMatches : matches;
    const selected = selectTopMatches(target, 5);

    console.log(`📊 총 ${matches.length}개 중 ${selected.length}개 포스팅 대상:\n`);

    // 4. Post to each channel
    let totalSuccess = 0;
    for (const match of selected) {
        const label = `${match.home_ko} vs ${match.away_ko}`;
        console.log(`  🎯 ${label}`);

        for (const ch of channels) {
            const text = generatePostText(match, ch.service);
            try {
                const result = await createPost(ch.id, text);
                if (result.success) {
                    console.log(`     ✅ ${ch.service} → 큐 등록 완료`);
                    totalSuccess++;
                } else {
                    console.log(`     ❌ ${ch.service} → ${result.error}`);
                }
            } catch (e) {
                console.log(`     ❌ ${ch.service} → ${e.message}`);
            }
            // Rate limit: 500ms between posts
            await new Promise(r => setTimeout(r, 500));
        }
        console.log('');
    }

    console.log(`🎉 Buffer 포스팅 완료: ${totalSuccess}개 성공 (${selected.length}경기 × ${channels.length}채널)`);
}

main().catch(console.error);
