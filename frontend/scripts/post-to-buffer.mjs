/**
 * Buffer SNS 자동 포스팅 스크립트 (베트맨 공식 게임 & O2O 판매점/커뮤니티 퍼널)
 * 빌드 후 실행: 이번 회차 베트맨 공식 게임(승무패 14경기, 프로토 승부식, 승5패, 스페셜N) 분석을 Buffer에 자동 포스팅
 *
 * 환경변수:
 *   BUFFER_ACCESS_TOKEN  - Buffer API Bearer 토큰
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
    const gap = Math.abs((match.home_prob || 50) - (match.away_prob || 50));
    const roleLabel = gap >= 15 ? '📌 단독 우위 (1순위 주력)' : '🛡️ 경합 주의 (1·2순위 복수병행)';
    const roundTitle = match.round_title || '축구토토 승무패 · 프로토 승부식';
    const gameNo = match.game_no_label || '핵심매치';
    const emoji = LEAGUE_EMOJI[match.league] || '⚽';
    const league = LEAGUE_NAMES[match.league] || match.league;
    const url = `${SITE_URL}/ko`;

    if (platform === 'instagram') {
        return `📊 [${roundTitle} · ${gameNo}] AI 밸런스 리포트 | ${match.date}

${emoji} ${match.home_ko} vs ${match.away_ko} (${league})
🎯 구간 분류: ${roleLabel}
📈 AI 1순위 시뮬레이션: ${favorite} 우세 ${bestProb}%
💰 배당 지수: 홈 ${match.home_odds} / 무 ${match.draw_odds} / 원정 ${match.away_odds}

🏪 전국 6,500개 동네 판매점(PC 전광판·A4 벽보) & 온라인 승부예측 커뮤니티 참여 시 14경기 전체 밸런스 표 100% 무료 해금!

🔗 [스코어닉스 공식 채널]
🌐 베트맨 전 게임 AI리포트: https://scorenix.com/ko (프로필 링크!)
🎬 공식 유튜브: https://www.youtube.com/@스코어닉스
🧵 공식 쓰레드: https://www.threads.com/@scorenix_official
✍️ 공식 블로그: https://official-scorenix.blogspot.com

#축구토토승무패 #프로토승부식 #농구토토승5패 #베트맨 #Scorenix #스코어닉스
#${match.home_ko.replace(/\s/g, '')} #${match.away_ko.replace(/\s/g, '')}
#${league.replace(/\s/g, '')} #스포츠토토분석 #배당분석`;
    }

    // Threads / default
    return `📊 [${roundTitle} · ${gameNo}] AI 밸런스 리포트 | ${match.date}

${emoji} ${match.home_ko} vs ${match.away_ko} (${league})
🎯 구간 분류: ${roleLabel}
📈 AI 1순위: ${favorite} 우세 ${bestProb}%
💰 배당: 홈 ${match.home_odds} / 무 ${match.draw_odds} / 원정 ${match.away_odds}

🏪 승부예측 커뮤니티 투표 또는 동네 판매점 등록 시 14경기 전체 표 무료 해금!
🌐 베트맨 AI리포트: ${url}
🎬 유튜브: https://www.youtube.com/@스코어닉스
📸 인스타: https://www.instagram.com/scorenix_official/
✍️ 블로그: https://official-scorenix.blogspot.com

#축구토토승무패 #프로토승부식 #베트맨 #Scorenix`;
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

    if (!BUFFER_TOKEN) {
        console.log('⚠️  BUFFER_ACCESS_TOKEN 미설정 — Buffer 포스팅 건너뜀');
        console.log('   환경변수를 추가해주세요: BUFFER_ACCESS_TOKEN=your_token\n');
        return;
    }

    const channels = await getChannels();
    if (channels.length === 0) {
        console.log('⚠️  연결된 SNS 채널 없음');
        return;
    }
    console.log(`📡 연결된 채널 ${channels.length}개:`);
    channels.forEach(ch => console.log(`   • ${ch.service} — ${ch.name} (${ch.id})`));
    console.log('');

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

    const today = new Date().toISOString().split('T')[0];
    const todayMatches = matches.filter(m => m.date === today);
    const target = todayMatches.length > 0 ? todayMatches : matches;
    const selected = selectTopMatches(target, 5);

    console.log(`📊 총 ${matches.length}개 중 ${selected.length}개 포스팅 대상:\n`);

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
            await new Promise(r => setTimeout(r, 500));
        }
        console.log('');
    }

    console.log(`🎉 Buffer 포스팅 완료: ${totalSuccess}개 성공 (${selected.length}경기 × ${channels.length}채널)`);
}

main().catch(console.error);
