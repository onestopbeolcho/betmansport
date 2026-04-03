import { TourStep } from '../components/OnboardingTour';

/**
 * 메인 페이지 (홈) 투어
 * 서비스 전체 소개 + 핵심 기능 안내
 */
export const homeTourSteps: TourStep[] = [
    {
        target: 'tour-welcome',
        title: '환영해요! 👋 Scorenix에 오신 걸 환영합니다',
        description: '안녕하세요! 저는 여러분의 스포츠 분석을 도와줄 Scorenix 가이드예요. 지금부터 서비스의 핵심 기능을 하나씩 안내해 드릴게요.',
        icon: '🎉',
        placement: 'center',
        hint: '약 1분 정도 소요됩니다. 언제든 건너뛰기를 누르면 종료돼요.',
    },
    {
        target: 'tour-nav',
        title: '내비게이션 메뉴',
        description: '여기서 모든 페이지로 이동할 수 있어요. 밸류벳, 승리투표, AI분석 등 원하는 메뉴를 클릭해 보세요.',
        icon: '🧭',
        placement: 'bottom',
        hint: '모바일에서는 ☰ 버튼을 터치하면 메뉴가 열려요.',
    },
    {
        target: 'tour-hero',
        title: 'AI 스포츠 데이터 분석 플랫폼',
        description: 'Scorenix는 AI가 글로벌 스포츠 데이터를 실시간으로 분석해서, 데이터 대비 가치가 높은 경기를 찾아드려요. 모든 분석은 무료로 이용할 수 있어요!',
        icon: '🤖',
        placement: 'bottom',
    },
    {
        target: 'tour-match-voting',
        title: '오늘의 승부 예측',
        description: '여기서 오늘 예정된 경기의 결과를 예측할 수 있어요. 홈 승/무승부/원정 승 중 하나를 선택해서 투표해 보세요!',
        icon: '🗳️',
        placement: 'top',
        hint: '투표 후 경기가 끝나면 자동으로 결과를 알려줘요. 정확도가 높으면 리더보드에 올라갈 수 있어요!',
    },
    {
        target: 'tour-leaderboard',
        title: '예측 리더보드',
        description: '승부 예측 정확도가 가장 높은 분석가들의 순위를 확인할 수 있어요. 꾸준히 투표하면 여러분도 순위에 올라갈 수 있답니다!',
        icon: '🏆',
        placement: 'top',
    },
    {
        target: 'tour-cta-bets',
        title: '밸류벳 — 가치 높은 경기 발굴',
        description: '"AI 분석 시작" 버튼을 누르면 밸류봇 페이지로 이동해요. AI가 데이터 대비 기대값이 높은 경기를 자동으로 찾아줘요.',
        icon: '📊',
        placement: 'bottom',
        hint: 'EV(기대 가치) 수치가 높을수록 데이터 대비 가치가 높은 경기예요.',
    },
];

/**
 * 밸류벳 페이지 투어
 * 가치 분석 기능 상세 안내
 */
export const betsTourSteps: TourStep[] = [
    {
        target: 'tour-bets-intro',
        title: '밸류벳 분석에 오신 걸 환영해요! 📊',
        description: '이 페이지에서는 AI가 글로벌 스포츠 데이터를 분석해서, 실제 확률 대비 데이터 지표가 높게 책정된 "가치 있는" 경기를 찾아줘요.',
        icon: '🎯',
        placement: 'center',
        hint: '밸류 분석이란? 실제 이길 확률보다 데이터 지표가 높게 설정된 경기를 의미해요.',
    },
    {
        target: 'tour-bets-filter',
        title: '종목 필터',
        description: '축구, 농구, 야구, 하키 등 원하는 종목만 필터링해서 볼 수 있어요. 관심 있는 종목을 선택해 보세요!',
        icon: '⚽',
        placement: 'bottom',
    },
    {
        target: 'tour-bets-table',
        title: '분석 결과 목록',
        description: '각 경기의 데이터 지표, EV(기대가치), AI 신뢰도를 한눈에 볼 수 있어요. EV가 높을수록 데이터 대비 기대값이 높은 경기예요.',
        icon: '📈',
        placement: 'top',
        hint: 'EV(Expected Value)는 AI가 계산한 기대값이에요. +5% 이상이면 주목할 만해요!',
    },
    {
        target: 'tour-bets-cart',
        title: '분석 바구니 (장바구니)',
        description: '관심 있는 경기의 데이터 버튼을 클릭하면 분석 바구니에 담겨요. 여러 경기를 조합해서 멀티 분석도 가능해요!',
        icon: '🛒',
        placement: 'left',
    },
];

/**
 * 승리투표(Market) 페이지 투어
 */
export const marketTourSteps: TourStep[] = [
    {
        target: 'tour-market-intro',
        title: '승리 투표 페이지에 오신 걸 환영해요! 🗳️',
        description: '이 페이지에서는 전 세계 실시간 경기를 확인하고, AI 분석을 참고해서 승리 예측 투표를 할 수 있어요.',
        icon: '🎯',
        placement: 'center',
        hint: '무료로 참여할 수 있고, 정확도가 높으면 리더보드에 올라가요!',
    },
    {
        target: 'tour-market-steps',
        title: '참여 방법 (3단계)',
        description: '① 경기 선택 → ② 결과 예측 → ③ 자동 정산! 이 세 단계로 아주 간단하게 참여할 수 있어요.',
        icon: '📋',
        placement: 'bottom',
    },
    {
        target: 'tour-market-sports',
        title: '종목 선택 탭',
        description: '전체, 축구, 농구, 야구 등 종목별로 필터링할 수 있어요. 원하는 종목 탭을 눌러보세요!',
        icon: '🏆',
        placement: 'bottom',
    },
    {
        target: 'tour-market-match',
        title: '경기 카드',
        description: '각 경기 카드를 터치하면 AI 분석, 데이터 상세, 순위, 최근 성적 등 심층 분석을 볼 수 있어요.',
        icon: '⚽',
        placement: 'bottom',
        hint: '데이터 버튼(승/무/패)을 누르면 분석 바구니에 담겨요.',
    },
    {
        target: 'tour-market-odds',
        title: '데이터 지표 버튼',
        description: '홈 승(승), 무승부(무), 원정 승(패) 데이터 지표예요. 수치가 높을수록 가능성이 낮지만 기대값이 커요. 데이터 버튼을 누르면 분석 바구니에 담겨요!',
        icon: '🎰',
        placement: 'top',
    },
];
