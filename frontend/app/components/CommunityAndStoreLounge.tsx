"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";

interface MatchOption {
    game_no: number;
    game_no_label: string;
    betman_home: string;
    betman_away: string;
    home_ko: string;
    away_ko: string;
}

interface CommunityPost {
    id: string;
    round_title: string;
    author: string;
    badge: string;
    store_tag: string;
    match_label: string;
    pick_badge: string;
    content: string;
    likes: number;
    created_at: string;
}

interface StoreDirectoryItem {
    id: string;
    sido?: string;
    sigungu?: string;
    name: string;
    toto_name?: string;
    moef_name?: string;
    region: string;
    address?: string;
    address_hint: string;
    smart_slip?: string;
    verify_grade?: string;
    display_mode: "PC_AND_A4" | "A4_POSTER" | "OFFICIAL_VERIFIED" | "REQUESTED";
    request_count: number;
    distance_m?: number;
    distance_label?: string;
}

const FORBIDDEN_KEYWORDS = [
    "사설",
    "카톡",
    "카카오톡",
    "텔레",
    "텔레그램",
    "꽁머니",
    "환전",
    "충전",
    "코드",
    "놀이터",
    "먹튀",
    "http://",
    "https://",
    ".com",
    ".net",
];

const SIDO_TABS = [
    { key: "ALL", label: "전국 전체 (6,277)" },
    { key: "경기", label: "경기 (1,636)" },
    { key: "서울", label: "서울 (1,197)" },
    { key: "경남", label: "경남 (404)" },
    { key: "부산", label: "부산 (347)" },
    { key: "인천", label: "인천 (339)" },
    { key: "대구", label: "대구 (307)" },
    { key: "충남", label: "충남 (292)" },
    { key: "경북", label: "경북 (286)" },
    { key: "전북", label: "전북 (210)" },
    { key: "강원", label: "강원 (209)" },
    { key: "충북", label: "충북 (194)" },
    { key: "전남", label: "전남 (193)" },
    { key: "광주", label: "광주 (187)" },
    { key: "대전", label: "대전 (173)" },
    { key: "울산", label: "울산 (170)" },
    { key: "제주", label: "제주 (88)" },
    { key: "세종", label: "세종 (26)" },
];

const FALLBACK_STORES: StoreDirectoryItem[] = [
    {
        id: "TOTO-0001",
        sido: "서울",
        sigungu: "강남구",
        name: "씨티마트 (우정)",
        toto_name: "씨티마트",
        moef_name: "우정",
        region: "서울 강남구",
        address: "서울 강남구 도산대로 49길 8",
        address_hint: "서울 강남구 도산대로 49길 8",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "PC_AND_A4",
        request_count: 42,
    },
    {
        id: "TOTO-0014",
        sido: "서울",
        sigungu: "중구",
        name: "신당백석점 (태양비디오)",
        toto_name: "신당백석점",
        moef_name: "태양비디오",
        region: "서울 중구",
        address: "서울 중구 동호로 193-22",
        address_hint: "서울 중구 동호로 193-22",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "PC_AND_A4",
        request_count: 38,
    },
    {
        id: "TOTO-0015",
        sido: "서울",
        sigungu: "광진구",
        name: "CU중곡본점",
        toto_name: "중곡본점",
        moef_name: "CU중곡본점",
        region: "서울 광진구",
        address: "서울 광진구 능동로 337-1",
        address_hint: "서울 광진구 능동로 337-1",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "A4_POSTER",
        request_count: 29,
    },
    {
        id: "TOTO-0025",
        sido: "경기",
        sigungu: "수원시",
        name: "GS25수원장안점 (순이네)",
        toto_name: "수원장안점",
        moef_name: "GS25수원장안점",
        region: "경기 수원시",
        address: "경기 수원시 장안구 경수대로 1079",
        address_hint: "경기 수원시 장안구 경수대로 1079",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "PC_AND_A4",
        request_count: 51,
    },
    {
        id: "TOTO-0048",
        sido: "경기",
        sigungu: "성남시",
        name: "IGA마트 분당차병원점",
        toto_name: "IGA마트 분당차병원점",
        moef_name: "아이지에이마트 분당차병원점",
        region: "경기 성남시",
        address: "경기 성남시 분당구 야탑로69번길 3",
        address_hint: "경기 성남시 분당구 야탑로69번길 3",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "PC_AND_A4",
        request_count: 34,
    },
    {
        id: "TOTO-0039",
        sido: "인천",
        sigungu: "부평구",
        name: "시티라이프",
        toto_name: "시티라이프",
        moef_name: "시티라이프",
        region: "인천 부평구",
        address: "인천 부평구 주부토로 265",
        address_hint: "인천 부평구 주부토로 265",
        smart_slip: "O",
        verify_grade: "교차검증완료(공식토토+복권겸영)",
        display_mode: "A4_POSTER",
        request_count: 27,
    },
];

export default function CommunityAndStoreLounge({
    roundTitle,
    matches,
    userNickname,
    onUnlockReward,
}: {
    roundTitle: string;
    matches: MatchOption[];
    userNickname?: string;
    onUnlockReward: (reason: string) => void;
}) {
    const [activeTab, setActiveTab] = useState<"COMMUNITY" | "STORES">("COMMUNITY");

    // 커뮤니티 글쓰기 폼 상태
    const [nickname, setNickname] = useState(userNickname || "");
    const [selectedMatchNo, setSelectedMatchNo] = useState<string>("ALL");
    const [selectedPick, setSelectedPick] = useState<string>("홈승 단독우위");
    const [storeTagInput, setStoreTagInput] = useState("");
    const [commentText, setCommentText] = useState("");
    const [postAlert, setPostAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [customPosts, setCustomPosts] = useState<CommunityPost[]>([]);
    const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

    // 전국 6,277개 공식 판매점 검색 & GPS & 단골 매장 신청 상태
    const [sidoFilter, setSidoFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [debouncedQuery, setDebouncedQuery] = useState<string>("");
    const [stores, setStores] = useState<StoreDirectoryItem[]>(FALLBACK_STORES);
    const [totalStoresDb, setTotalStoresDb] = useState<number>(6277);
    const [matchedCount, setMatchedCount] = useState<number>(6277);
    const [loadingStores, setLoadingStores] = useState<boolean>(false);
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<string | null>(null);

    const [reqStoreName, setReqStoreName] = useState("");
    const [reqStoreRegion, setReqStoreRegion] = useState("서울");
    const [reqStoreHint, setReqStoreHint] = useState("");
    const [storeAlert, setStoreAlert] = useState<string | null>(null);

    useEffect(() => {
        if (userNickname) setNickname(userNickname);
    }, [userNickname]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery.trim());
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        try {
            const savedPosts = localStorage.getItem("scorenix_community_posts_v1");
            if (savedPosts) {
                setCustomPosts(JSON.parse(savedPosts));
            }
        } catch {
            // ignore
        }
    }, []);

    const fetchOfficialStores = useCallback(async () => {
        setLoadingStores(true);
        try {
            const params = new URLSearchParams();
            if (sidoFilter && sidoFilter !== "ALL") params.set("sido", sidoFilter);
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (userCoords) {
                params.set("lat", String(userCoords.lat));
                params.set("lon", String(userCoords.lon));
            }
            params.set("limit", "20");

            const res = await fetch(`${API_BASE}/api/proto/stores?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.stores) && data.stores.length > 0) {
                    setStores(data.stores);
                } else if (debouncedQuery || sidoFilter !== "ALL") {
                    setStores([]);
                }
                if (typeof data.total_stores_in_db === "number") setTotalStoresDb(data.total_stores_in_db);
                if (typeof data.matched_count === "number") setMatchedCount(data.matched_count);
            }
        } catch {
            // keep fallback stores
        } finally {
            setLoadingStores(false);
        }
    }, [sidoFilter, debouncedQuery, userCoords]);

    useEffect(() => {
        fetchOfficialStores();
    }, [fetchOfficialStores]);

    const handleFindNearbyGps = () => {
        if (typeof window === "undefined" || !("geolocation" in navigator)) {
            setGpsStatus("현재 브라우저에서 위치(GPS) 기능을 지원하지 않습니다. 상호명이나 동네 이름으로 검색해주세요.");
            return;
        }
        setGpsStatus("📡 내 주변 가장 가까운 공식 프로토 판매점 좌표를 탐색 중입니다...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setSidoFilter("ALL");
                setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                setGpsStatus("✅ 내 현재 위치에서 가장 가까운 공식 프로토 판매점 순으로 정렬되었습니다!");
            },
            () => {
                setGpsStatus("⚠️ 위치 권한이 거부되었습니다. 검색창에 동네 이름(예: 강남, 수원, 서면)이나 상호명을 입력해주세요.");
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    const seedPosts: CommunityPost[] = useMemo(() => {
        const m1 = matches[0];
        const m2 = matches[2] || matches[1] || matches[0];
        const m3 = matches[7] || matches[4] || matches[0];
        const m4 = matches[11] || matches[5] || matches[0];

        return [
            {
                id: "seed-1",
                round_title: roundTitle,
                author: "수원장안분석가",
                badge: "🏆 직전회차 12경기 예측성공",
                store_tag: "🏪 [경기 수원시] GS25수원장안점 (순이네)",
                match_label: m2 ? `${m2.game_no_label} ${m2.betman_home} vs ${m2.betman_away}` : "주요 경합 경기",
                pick_badge: "무승부·접전 병행",
                content: `방금 동네 판매점 PC 전광판에서 AI 밸런스 표 확인하고 왔습니다. ${
                    m2 ? `${m2.game_no_label} ${m2.betman_home} 경기는 선호도 대비 접전 지수가 높아서 1·2순위 복수 검토가 안전해 보이네요.` : ""
                }`,
                likes: 19,
                created_at: "방금 전",
            },
            {
                id: "seed-2",
                round_title: roundTitle,
                author: "강남데이터헌터",
                badge: "📊 7-Factor 분석회원",
                store_tag: "🏪 [서울 강남구] 씨티마트 (우정) 단골",
                match_label: m3 ? `${m3.game_no_label} ${m3.betman_home} vs ${m3.betman_away}` : "단독 우위 구간",
                pick_badge: "1순위 단독우위",
                content: `${
                    m3 ? `${m3.game_no_label} ${m3.home_ko} 경기는 홈 기대득점(xG) 우위가 확실해서 이번 회차 단독 우위(1순위 고정) 축으로 잡고 갑니다.` : "이번 회차 단독 우위 경기가 꽤 명확하네요."
                } 매장 벽보 A4 출력본 보기가 깔끔해서 좋네요.`,
                likes: 14,
                created_at: "12분 전",
            },
            {
                id: "seed-3",
                round_title: roundTitle,
                author: "구포언더독연구소",
                badge: "🔥 5주 연속 참여",
                store_tag: "🏪 [부산 북구] 와따 로또앤토토",
                match_label: m4 ? `${m4.game_no_label} ${m4.betman_home} vs ${m4.betman_away}` : "혼전 주의 구간",
                pick_badge: "1·2순위 복수검토",
                content: `${
                    m4 ? `${m4.game_no_label} ${m4.home_ko} vs ${m4.away_ko} 빅매치는 대중 선호도가 한쪽으로 쏠릴 때 항상 무승부 변수가 나왔습니다.` : ""
                } 다들 이번 회차 경합 4경기 어떻게 배분하셨나요?`,
                likes: 11,
                created_at: "28분 전",
            },
            {
                id: "seed-4",
                round_title: roundTitle,
                author: "분당승무패장인",
                badge: "✅ 실전 예측러",
                store_tag: "🏪 [경기 성남시] IGA마트 분당차병원점",
                match_label: m1 ? `${m1.game_no_label} ${m1.betman_home} vs ${m1.betman_away}` : "1번 경기",
                pick_badge: "홈승 단독우위",
                content: `사장님이 매장 모니터에 스코어닉스 전광판 켜두셔서 손님들끼리 보면서 토론하기 딱 좋습니다. 첫 경기 홈 흐름 좋아 보입니다!`,
                likes: 9,
                created_at: "45분 전",
            },
        ];
    }, [roundTitle, matches]);

    const allPosts = useMemo(() => {
        return [...customPosts, ...seedPosts];
    }, [customPosts, seedPosts]);

    const handleCreatePost = (e: React.FormEvent) => {
        e.preventDefault();
        setPostAlert(null);

        const cleanComment = commentText.trim();
        if (cleanComment.length < 5) {
            setPostAlert({ type: "error", msg: "의견을 5자 이상 작성해주세요." });
            return;
        }

        const lower = `${cleanComment} ${nickname} ${storeTagInput}`.toLowerCase();
        const foundForbidden = FORBIDDEN_KEYWORDS.find((kw) => lower.includes(kw));
        if (foundForbidden) {
            setPostAlert({
                type: "error",
                msg: `건전한 스포츠 데이터 토론 문화를 위해 금지어('${foundForbidden}') 또는 외부 연락처/링크가 포함된 글은 등록할 수 없습니다.`,
            });
            return;
        }

        const matchedObj = matches.find((m) => String(m.game_no) === selectedMatchNo);
        const matchLabel = matchedObj
            ? `${matchedObj.game_no_label} ${matchedObj.betman_home} vs ${matchedObj.betman_away}`
            : `${roundTitle} 종합 의견`;

        const newPost: CommunityPost = {
            id: `post-${Date.now()}`,
            round_title: roundTitle,
            author: nickname.trim() || "익명데이터분석가",
            badge: "✨ 이번 회차 참여 회원",
            store_tag: storeTagInput.trim() ? `🏪 ${storeTagInput.trim()}` : "📍 온라인 라운지 참여",
            match_label: matchLabel,
            pick_badge: selectedPick,
            content: cleanComment,
            likes: 1,
            created_at: "방금 전",
        };

        const updated = [newPost, ...customPosts];
        setCustomPosts(updated);
        setCommentText("");
        try {
            localStorage.setItem("scorenix_community_posts_v1", JSON.stringify(updated.slice(0, 30)));
        } catch {
            // ignore
        }

        onUnlockReward("커뮤니티 승부예측 의견 등록 보상");
        setPostAlert({
            type: "success",
            msg: "🎉 의견이 등록되었습니다! 커뮤니티 참여 보상으로 이번 회차 잠금 지표가 모두 해제되었습니다.",
        });
    };

    const handleRecommendStoreCard = async (st: StoreDirectoryItem) => {
        setStores((prev) =>
            prev.map((item) => (item.id === st.id ? { ...item, request_count: item.request_count + 1 } : item))
        );
        try {
            await fetch(`${API_BASE}/api/proto/stores/recommend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ store_id: st.id, store_name: st.name, region: st.region }),
            });
        } catch {
            // ignore network error
        }
        onUnlockReward(`[${st.name}] 공식 판매점 단골 추천 보상`);
        setStoreAlert(
            `🎉 [${st.region}] ${st.name} 매장에 AI 리포트 비치 추천(+1)이 완료되었습니다! 보상으로 이번 회차 전 경기 잠금이 즉시 해제되었습니다.`
        );
    };

    const handleRegisterStoreRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reqStoreName.trim()) return;

        const targetName = reqStoreName.trim();
        try {
            const res = await fetch(`${API_BASE}/api/proto/stores/recommend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    store_name: targetName,
                    region: reqStoreRegion,
                    address_hint: reqStoreHint.trim(),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.store) {
                    setStores((prev) => [data.store, ...prev.filter((p) => p.id !== data.store.id)]);
                }
                setStoreAlert(data.message || `🎉 [${targetName}] 단골 매장 비치 요청이 접수되어 이번 회차 잠금이 해제되었습니다!`);
            } else {
                setStoreAlert(`🎉 [${targetName}] 단골 매장 비치 요청이 접수되어 이번 회차 잠금이 해제되었습니다!`);
            }
        } catch {
            setStoreAlert(`🎉 [${targetName}] 단골 매장 비치 요청이 접수되어 이번 회차 잠금이 해제되었습니다!`);
        }

        setReqStoreName("");
        setReqStoreHint("");
        onUnlockReward("내 단골 프로토 판매점 등록 보상");
    };

    return (
        <section
            id="community-lounge"
            className="rounded-xl bg-white border-2 border-[#0046b8] overflow-hidden shadow-xs scroll-mt-20"
        >
            {/* 상단 탭 헤더 */}
            <div className="bg-[#003996] text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
                            O2O 커뮤니티 &amp; 전국 {totalStoresDb.toLocaleString()}개 공식 프로토 판매점 교차검증 DB
                        </span>
                        <span className="text-xs text-blue-100 font-semibold">
                            의견 남기기 또는 우리 동네 공식 판매점 추천 시 이번 회차 잠금 즉시 해제!
                        </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black mt-1">
                        💬 [{roundTitle}] 실시간 승부예측 토론방 &amp; 전국 {totalStoresDb.toLocaleString()}개 공식 판매점 검색 (GPS 지원)
                    </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab("COMMUNITY")}
                        className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                            activeTab === "COMMUNITY"
                                ? "bg-white text-[#003996] shadow-xs"
                                : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                    >
                        💬 회차별 승부예측 토론방 ({allPosts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("STORES")}
                        className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                            activeTab === "STORES"
                                ? "bg-white text-[#003996] shadow-xs"
                                : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                    >
                        🏪 전국 공식 판매점 찾기 ({totalStoresDb.toLocaleString()}개소)
                    </button>
                </div>
            </div>

            {activeTab === "COMMUNITY" ? (
                <div className="p-5 sm:p-6 space-y-6">
                    {/* 1. 10초 승부예측 의견 등록 폼 */}
                    <form
                        onSubmit={handleCreatePost}
                        className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-3.5"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs sm:text-sm font-black text-slate-900">
                                ✍️ 이번 [{roundTitle}] 내 예상 의견 남기기{" "}
                                <span className="text-[#0046b8]">
                                    (등록 즉시 이번 회차 전체 경기 잠금이 무료로 열립니다!)
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-semibold">
                                🛡️ 클린 커뮤니티: 불법 사설·외부 연락처 언급 시 자동 차단
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="닉네임 (예: 역삼승무패고수)"
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0046b8]"
                            />

                            <select
                                value={selectedMatchNo}
                                onChange={(e) => setSelectedMatchNo(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0046b8]"
                            >
                                <option value="ALL">📌 {roundTitle} 전체 종합 의견</option>
                                {matches.map((m) => (
                                    <option key={m.game_no} value={String(m.game_no)}>
                                        {m.game_no_label} {m.betman_home} vs {m.betman_away} ({m.home_ko})
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedPick}
                                onChange={(e) => setSelectedPick(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-[#0046b8] focus:outline-none focus:border-[#0046b8]"
                            >
                                <option value="홈승 단독우위">🔵 홈승 단독우위 예상</option>
                                <option value="무승부·접전 주의">🟠 무승부 / 5점차 접전 주의</option>
                                <option value="원정승 우세">⚫ 원정승 우세 예상</option>
                                <option value="1·2순위 복수검토">🛡️ 1·2순위 복수검토 필수</option>
                            </select>

                            <input
                                type="text"
                                value={storeTagInput}
                                onChange={(e) => setStoreTagInput(e.target.value)}
                                placeholder="방문 판매점명 (선택, 예: CU중곡본점)"
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#0046b8]"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="이번 회차 핵심 승부처에 대한 분석 의견이나 동네 판매점 분위기를 공유해주세요! (5자 이상)"
                                className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#0046b8]"
                            />
                            <button
                                type="submit"
                                className="px-5 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-black text-xs shrink-0 transition cursor-pointer"
                            >
                                💬 의견 등록 &amp; 잠금 해제
                            </button>
                        </div>

                        {postAlert && (
                            <div
                                className={`px-3.5 py-2 rounded-lg text-xs font-bold ${
                                    postAlert.type === "success"
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                        : "bg-rose-50 border border-rose-200 text-rose-700"
                                }`}
                            >
                                {postAlert.msg}
                            </div>
                        )}
                    </form>

                    {/* 2. 실시간 승부예측 피드 */}
                    <div className="space-y-3">
                        {allPosts.map((post) => {
                            const isLiked = !!likedIds[post.id];
                            return (
                                <div
                                    key={post.id}
                                    className="rounded-xl bg-white border border-slate-200 p-4 hover:border-blue-300 transition space-y-2"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-black text-slate-900 text-xs">{post.author}</span>
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-[10px] font-extrabold">
                                                {post.badge}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                                {post.store_tag}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-medium">{post.created_at}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-extrabold">
                                            {post.match_label}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-extrabold">
                                            예측: {post.pick_badge}
                                        </span>
                                    </div>

                                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">{post.content}</p>

                                    <div className="flex items-center justify-between pt-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLikedIds((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                                            }
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                                                isLiked
                                                    ? "bg-blue-50 text-[#0046b8] border-blue-300"
                                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                            }`}
                                        >
                                            👍 공감 {post.likes + (isLiked ? 1 : 0)}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* ─── TAB 2: 전국 6,277개 공식 프로토 판매점 교차검증 검색 & GPS & 단골 매장 추천 ─── */
                <div className="p-5 sm:p-6 space-y-6">
                    {/* 상단 검색창 + 내 주변 GPS 찾기 + 판매점 사장님 안내 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-xl bg-blue-50/60 border border-blue-200 p-4 sm:p-5 space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                    🔍 전국 {totalStoresDb.toLocaleString()}개 공식 프로토·스마트슬립 판매점 통합 검색
                                </span>
                                <span className="text-xs font-extrabold text-[#0046b8]">
                                    베트맨 등록 상호 &amp; 2026년 최신 간판 상호 이중 검색 지원!
                                </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                                스포츠토토 공식 판매점(<strong>6,236개 · 전 매장 GPS 위경도 포함</strong>)과 기획예산처 2026년 최신 등록 상호를 교차 검증했습니다.
                                아래에서 <strong>우리 동네 단골 판매점을 검색해 [추천 &amp; 무료 해금]</strong>을 누르시면 이번 회차 전 경기 잠금이 즉시 해제됩니다!
                            </p>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="동네명, 도로명, 상호명 검색 (예: 강남, 수원, 서면, CU, GS25, 복권명당)"
                                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                />
                                <button
                                    type="button"
                                    onClick={handleFindNearbyGps}
                                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shrink-0 transition cursor-pointer"
                                >
                                    📍 내 주변 가장 가까운 매장 (GPS)
                                </button>
                                {(searchQuery || userCoords || sidoFilter !== "ALL") && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSidoFilter("ALL");
                                            setUserCoords(null);
                                            setGpsStatus(null);
                                        }}
                                        className="px-3 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs shrink-0 transition cursor-pointer"
                                    >
                                        초기화
                                    </button>
                                )}
                            </div>

                            {gpsStatus && (
                                <div className="px-3 py-2 rounded-lg bg-white border border-blue-200 text-xs font-bold text-slate-800">
                                    {gpsStatus}
                                </div>
                            )}
                            {storeAlert && (
                                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                                    {storeAlert}
                                </div>
                            )}
                        </div>

                        {/* 판매점 사장님 전용 바로가기 박스 */}
                        <div className="rounded-xl bg-slate-900 text-white p-5 flex flex-col justify-between space-y-3">
                            <div>
                                <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
                                    🏪 전국 {totalStoresDb.toLocaleString()}개 판매점 점주님 전용
                                </span>
                                <h3 className="text-base font-black mt-2">
                                    사장님 매장에 PC 전광판 &amp; A4 분석벽보를 설치하세요!
                                </h3>
                                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                    점주 모드로 로그인하시면 <strong>매장 모니터용 전광판 화면</strong>과 <strong>고객용 A4 원클릭 인쇄물</strong>을 즉시 이용하실 수 있습니다.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Link
                                    href="/ko/login?mode=store"
                                    className="block w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 !text-slate-950 font-black text-xs text-center transition"
                                >
                                    🖥️ 판매점 모드 로그인 (PC 전광판/인쇄)
                                </Link>
                                <Link
                                    href="/ko/store/print-report/current"
                                    className="block w-full py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 !text-white font-bold text-xs text-center transition"
                                >
                                    🖨️ A4 벽보 출력 샘플 바로보기
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* 17개 시·도별 공식 판매점 필터 탭 */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-slate-900">
                                📍 시·도별 공식 프로토 판매점 조회{" "}
                                <span className="text-[#0046b8]">
                                    (검색 결과 {matchedCount.toLocaleString()}개소 중 상위 {stores.length}개 표시)
                                </span>
                            </h3>
                            {loadingStores && (
                                <span className="text-xs font-bold text-[#0046b8]">🔄 실시간 매장 데이터 조회 중...</span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {SIDO_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setSidoFilter(tab.key)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                        sidoFilter === tab.key
                                            ? "bg-[#0046b8] text-white border-[#0046b8]"
                                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* 공식 판매점 카드 그리드 */}
                        {stores.length === 0 ? (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-8 text-center space-y-2">
                                <div className="text-sm font-black text-slate-800">
                                    조건에 맞는 공식 판매점을 찾지 못했습니다.
                                </div>
                                <div className="text-xs text-slate-500">
                                    다른 동네 이름이나 도로명, 혹은 하단의 신규 단골 판매점 직접 제보 폼을 이용해 주세요!
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {stores.map((st) => (
                                    <div
                                        key={st.id}
                                        className="rounded-xl bg-slate-50 border border-slate-200 hover:border-[#0046b8] p-3.5 flex flex-col justify-between space-y-2.5 transition"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-1 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-extrabold text-slate-700">
                                                    {st.region || st.sido} · {st.id}
                                                </span>
                                                {st.distance_label ? (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                                                        📍 내 위치에서 {st.distance_label}
                                                    </span>
                                                ) : st.display_mode === "PC_AND_A4" ? (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                                        🖥️ 전광판 + 🖨️ A4비치
                                                    </span>
                                                ) : st.display_mode === "A4_POSTER" ? (
                                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0046b8] text-[10px] font-extrabold">
                                                        🖨️ A4 리포트 비치
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-extrabold">
                                                        ✅ 공식 스마트슬립 {st.smart_slip || "O"}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="font-black text-slate-900 text-sm mt-2 leading-snug">
                                                {st.name}
                                            </div>
                                            <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                📍 {st.address || st.address_hint}
                                            </div>
                                            {st.verify_grade && (
                                                <div className="text-[10px] font-bold text-[#0046b8] mt-1">
                                                    🛡️ {st.verify_grade}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-500 font-medium">동네 손님 비치 추천</span>
                                                <span className="font-extrabold text-[#0046b8]">
                                                    🔥 {st.request_count}명 추천
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRecommendStoreCard(st)}
                                                className="w-full py-1.5 px-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-black text-[11px] transition cursor-pointer"
                                            >
                                                👍 내 단골매장 추천 &amp; 무료 해금
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 수동 단골 판매점 제보 폼 */}
                    <form
                        onSubmit={handleRegisterStoreRequest}
                        className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-900">
                                📢 찾는 매장이 없거나 신규 오픈한 동네 프로토 판매점이 있다면 직접 알려주세요!
                            </span>
                            <span className="text-xs font-extrabold text-[#0046b8]">
                                제보 즉시 이번 회차 잠금 100% 해제
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <select
                                value={reqStoreRegion}
                                onChange={(e) => setReqStoreRegion(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900"
                            >
                                {SIDO_TABS.filter((t) => t.key !== "ALL").map((t) => (
                                    <option key={t.key} value={t.key}>
                                        {t.key}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                required
                                value={reqStoreName}
                                onChange={(e) => setReqStoreName(e.target.value)}
                                placeholder="단골 판매점 상호 (예: 행운프로토방)"
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900"
                            />
                            <input
                                type="text"
                                value={reqStoreHint}
                                onChange={(e) => setReqStoreHint(e.target.value)}
                                placeholder="도로명주소 또는 위치 힌트"
                                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900"
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer"
                            >
                                📍 신규 매장 등록 &amp; 해금
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}
