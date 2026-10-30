"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";

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
    name: string;
    region: string;
    address_hint: string;
    display_mode: "PC_AND_A4" | "A4_POSTER" | "REQUESTED";
    request_count: number;
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

const INITIAL_STORES: StoreDirectoryItem[] = [
    {
        id: "st-1",
        name: "역삼 스포토토 명당점",
        region: "서울/수도권",
        address_hint: "서울 강남구 역삼역 인근 공식 판매점",
        display_mode: "PC_AND_A4",
        request_count: 42,
    },
    {
        id: "st-2",
        name: "종로 1번가 복권·프로토",
        region: "서울/수도권",
        address_hint: "서울 종로구 종각역 인근 공식 판매점",
        display_mode: "PC_AND_A4",
        request_count: 38,
    },
    {
        id: "st-3",
        name: "분당 서현 스포츠토토 센터",
        region: "경기/인천",
        address_hint: "경기 성남시 분당구 서현역 로데오 인근",
        display_mode: "A4_POSTER",
        request_count: 29,
    },
    {
        id: "st-4",
        name: "부평 중앙 복권방",
        region: "경기/인천",
        address_hint: "인천 부평구 부평역 북부광장 인근",
        display_mode: "PC_AND_A4",
        request_count: 24,
    },
    {
        id: "st-5",
        name: "나주 빛가람 혁신 복권명당",
        region: "광주/전남/전북",
        address_hint: "전남 나주시 빛가람동 한전KDN 인근",
        display_mode: "PC_AND_A4",
        request_count: 51,
    },
    {
        id: "st-6",
        name: "광주 상무지구 토토명당",
        region: "광주/전남/전북",
        address_hint: "광주 서구 치평동 상무역 인근",
        display_mode: "A4_POSTER",
        request_count: 33,
    },
    {
        id: "st-7",
        name: "대전 둔산 타임월드 복권방",
        region: "대전/충청/강원",
        address_hint: "대전 서구 둔산동 갤러리아 인근",
        display_mode: "PC_AND_A4",
        request_count: 27,
    },
    {
        id: "st-8",
        name: "부산 서면 1등 프로토샵",
        region: "부산/대구/울산/경상",
        address_hint: "부산 부산진구 서면교차로 인근",
        display_mode: "PC_AND_A4",
        request_count: 46,
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
    const [selectedPick, setSelectedPick] = useState<string>("홈승 우세");
    const [storeTagInput, setStoreTagInput] = useState("");
    const [commentText, setCommentText] = useState("");
    const [postAlert, setPostAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [customPosts, setCustomPosts] = useState<CommunityPost[]>([]);
    const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

    // 전국 판매점 찾기 & 단골 매장 신청 상태
    const [regionFilter, setRegionFilter] = useState<string>("ALL");
    const [stores, setStores] = useState<StoreDirectoryItem[]>(INITIAL_STORES);
    const [reqStoreName, setReqStoreName] = useState("");
    const [reqStoreRegion, setReqStoreRegion] = useState("서울/수도권");
    const [reqStoreHint, setReqStoreHint] = useState("");
    const [storeAlert, setStoreAlert] = useState<string | null>(null);

    useEffect(() => {
        if (userNickname) setNickname(userNickname);
    }, [userNickname]);

    useEffect(() => {
        try {
            const savedPosts = localStorage.getItem("scorenix_community_posts_v1");
            if (savedPosts) {
                setCustomPosts(JSON.parse(savedPosts));
            }
            const savedStores = localStorage.getItem("scorenix_store_directory_v1");
            if (savedStores) {
                setStores(JSON.parse(savedStores));
            }
        } catch {
            // ignore
        }
    }, []);

    const seedPosts: CommunityPost[] = useMemo(() => {
        const m1 = matches[0];
        const m2 = matches[2] || matches[1] || matches[0];
        const m3 = matches[7] || matches[4] || matches[0];
        const m4 = matches[11] || matches[5] || matches[0];

        return [
            {
                id: "seed-1",
                round_title: roundTitle,
                author: "빛가람전술분석가",
                badge: "🏆 직전회차 12경기 예측성공",
                store_tag: "🏪 나주 빛가람 혁신 복권명당 방문",
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
                author: "역삼데이터헌터",
                badge: "📊 7-Factor 분석회원",
                store_tag: "🏪 역삼 스포토토 명당점 단골",
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
                author: "서면언더독연구소",
                badge: "🔥 5주 연속 참여",
                store_tag: "🏪 부산 서면 1등 프로토샵",
                match_label: m4 ? `${m4.game_no_label} ${m4.betman_home} vs ${m4.betman_away}` : "혼전 주의 구간",
                pick_badge: "이변·복수 검토",
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
                store_tag: "🏪 분당 서현 스포츠토토 센터",
                match_label: m1 ? `${m1.game_no_label} ${m1.betman_home} vs ${m1.betman_away}` : "1번 경기",
                pick_badge: "홈팀 우세",
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

        // PG 준수 금칙어(사설, 카톡, 텔레, 링크 등) 자동 차단
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

    const handleRegisterStoreRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reqStoreName.trim()) return;

        const newItem: StoreDirectoryItem = {
            id: `st-${Date.now()}`,
            name: reqStoreName.trim(),
            region: reqStoreRegion,
            address_hint: reqStoreHint.trim() || `${reqStoreRegion} 공식 프로토 판매점`,
            display_mode: "REQUESTED",
            request_count: 1,
        };

        const updated = [newItem, ...stores];
        setStores(updated);
        setReqStoreName("");
        setReqStoreHint("");
        try {
            localStorage.setItem("scorenix_store_directory_v1", JSON.stringify(updated));
        } catch {
            // ignore
        }

        onUnlockReward("내 단골 프로토 판매점 제보 보상");
        setStoreAlert(
            `🎉 [${newItem.name}] 단골 매장 비치 요청이 접수되었습니다! 제보 보상으로 이번 회차 전체 리포트 잠금이 해제되었습니다.`
        );
    };

    const filteredStores = useMemo(() => {
        if (regionFilter === "ALL") return stores;
        return stores.filter((s) => s.region === regionFilter);
    }, [stores, regionFilter]);

    return (
        <section
            id="community-lounge"
            className="rounded-xl bg-white border-2 border-[#0046b8] overflow-hidden shadow-xs scroll-mt-20"
        >
            {/* 상단 탭 헤더 */}
            <div className="bg-[#003996] text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
                            O2O 커뮤니티 &amp; 전국 6,500개 판매점 네트워크
                        </span>
                        <span className="text-xs text-blue-100 font-semibold">
                            의견 남기기 또는 단골 판매점 제보 시 이번 회차 잠금 즉시 해제!
                        </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black mt-1">
                        💬 [{roundTitle}] 실시간 승부예측 토론방 &amp; 우리 동네 판매점 리포트 비치 현황
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
                        🏪 전국 판매점 비치 현황 &amp; 단골매장 신청 ({stores.length})
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
                                placeholder="방문 판매점명 (선택, 예: 역삼복권방)"
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
                /* ─── TAB 2: 전국 판매점 AI 리포트 비치 현황 & 단골 매장 신청 ─── */
                <div className="p-5 sm:p-6 space-y-6">
                    {/* 단골 판매점 제보 / 점주 입점 신청 폼 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <form
                            onSubmit={handleRegisterStoreRequest}
                            className="lg:col-span-2 rounded-xl bg-blue-50/50 border border-blue-200 p-4 sm:p-5 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="px-2.5 py-0.5 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                    📢 내 단골 프로토 판매점에 스코어닉스 리포트 비치 요청하기
                                </span>
                                <span className="text-xs font-extrabold text-[#0046b8]">
                                    제보 즉시 이번 회차 잠금 100% 해제!
                                </span>
                            </div>
                            <p className="text-xs text-slate-600">
                                자주 방문하시는 동네 복권방·프로토 판매점 상호를 남겨주시면, 해당 매장에 <strong>스코어닉스 A4 리포트 및 매장 PC 전광판 2주 무료 공급</strong>을 안내해 드리며 회원님께는 즉시 무료 열람 혜택이 제공됩니다.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                    value={reqStoreRegion}
                                    onChange={(e) => setReqStoreRegion(e.target.value)}
                                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900"
                                >
                                    <option value="서울/수도권">서울/수도권</option>
                                    <option value="경기/인천">경기/인천</option>
                                    <option value="대전/충청/강원">대전/충청/강원</option>
                                    <option value="광주/전남/전북">광주/전남/전북</option>
                                    <option value="부산/대구/울산/경상">부산/대구/울산/경상</option>
                                </select>
                                <input
                                    type="text"
                                    required
                                    value={reqStoreName}
                                    onChange={(e) => setReqStoreName(e.target.value)}
                                    placeholder="단골 판매점 상호 (예: OO복권방)"
                                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900"
                                />
                                <input
                                    type="text"
                                    value={reqStoreHint}
                                    onChange={(e) => setReqStoreHint(e.target.value)}
                                    placeholder="위치 힌트 (예: OO역 2번출구 앞)"
                                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-black text-xs transition cursor-pointer"
                            >
                                📍 우리 동네 단골 판매점 등록하고 오늘 리포트 열기
                            </button>
                            {storeAlert && (
                                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                    {storeAlert}
                                </div>
                            )}
                        </form>

                        {/* 판매점 사장님 전용 바로가기 박스 */}
                        <div className="rounded-xl bg-slate-900 text-white p-5 flex flex-col justify-between space-y-3">
                            <div>
                                <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
                                    🏪 전국 6,500개 판매점 점주님 전용
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
                                    className="block w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs text-center transition"
                                >
                                    🖥️ 판매점 모드 로그인 (PC 전광판/인쇄)
                                </Link>
                                <Link
                                    href="/ko/store/print-report/current"
                                    className="block w-full py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center transition"
                                >
                                    🖨️ A4 벽보 출력 샘플 바로보기
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* 지역별 판매점 필터 및 리스트 */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-slate-900">
                                📍 스코어닉스 AI 리포트 제공 판매점 &amp; 손님 비치 요청 매장 현황
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {["ALL", "서울/수도권", "경기/인천", "대전/충청/강원", "광주/전남/전북", "부산/대구/울산/경상"].map(
                                    (reg) => (
                                        <button
                                            key={reg}
                                            type="button"
                                            onClick={() => setRegionFilter(reg)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                                                regionFilter === reg
                                                    ? "bg-[#0046b8] text-white border-[#0046b8]"
                                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                            }`}
                                        >
                                            {reg === "ALL" ? "전국 전체" : reg}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {filteredStores.map((st) => (
                                <div
                                    key={st.id}
                                    className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col justify-between space-y-2"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-extrabold text-slate-600">
                                                {st.region}
                                            </span>
                                            {st.display_mode === "PC_AND_A4" ? (
                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                                    🖥️ PC전광판 + 🖨️ A4비치
                                                </span>
                                            ) : st.display_mode === "A4_POSTER" ? (
                                                <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0046b8] text-[10px] font-extrabold">
                                                    🖨️ A4 리포트 비치매장
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                                    📢 손님 비치요청 접수
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-black text-slate-900 text-sm mt-2">{st.name}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{st.address_hint}</div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500 font-medium">동네 손님 관심도</span>
                                        <span className="font-extrabold text-[#0046b8]">🔥 {st.request_count}명 추천</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
