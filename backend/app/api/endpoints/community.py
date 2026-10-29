"""
Community API — Match Comments & Live Community Talk Feed (Firestore backed).
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

COMMENTS_COLLECTION = "match_comments"


class CommentRequest(BaseModel):
    match_id: str
    user_id: str
    nickname: Optional[str] = None
    pick_tag: Optional[str] = None  # e.g., "홈승 지지", "원정 이변 예상", "무승부"
    content: str


class CommentResponse(BaseModel):
    id: str
    match_id: str
    user_id: str
    nickname: str
    pick_tag: Optional[str] = None
    content: str
    timestamp: str


COMMENTS_DB: Dict[str, List[CommentResponse]] = {}


def _mask_user(uid: str, nick: Optional[str] = None) -> str:
    if nick and nick.strip():
        return nick.strip()[:16]
    if not uid:
        return "익명 분석가"
    if "@" in uid:
        prefix = uid.split("@")[0]
        return f"{prefix[:3]}***" if len(prefix) > 3 else f"{prefix}**"
    return uid[:10]


@router.post("/comment", response_model=CommentResponse)
async def post_comment(comment: CommentRequest):
    """Post a new comment on a match (persisted to Firestore + in-memory cache)."""
    text = (comment.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해주세요.")
    if len(text) > 300:
        text = text[:300]

    now_iso = datetime.now(timezone.utc).isoformat()
    cid = str(uuid.uuid4())[:12]
    nick = _mask_user(comment.user_id, comment.nickname)

    new_comment = CommentResponse(
        id=cid,
        match_id=comment.match_id,
        user_id=comment.user_id,
        nickname=nick,
        pick_tag=comment.pick_tag,
        content=text,
        timestamp=now_iso,
    )

    if comment.match_id not in COMMENTS_DB:
        COMMENTS_DB[comment.match_id] = []
    COMMENTS_DB[comment.match_id].insert(0, new_comment)

    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        db.collection(COMMENTS_COLLECTION).document(cid).set(new_comment.model_dump())
    except Exception as e:
        logger.warning(f"Firestore comment save fallback to memory: {e}")

    return new_comment


@router.get("/comments/{match_id}", response_model=List[CommentResponse])
async def get_comments(match_id: str):
    """Get list of comments for a specific match."""
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        docs = (
            db.collection(COMMENTS_COLLECTION)
            .where("match_id", "==", match_id)
            .limit(30)
            .stream()
        )
        items = []
        for doc in docs:
            d = doc.to_dict()
            items.append(CommentResponse(
                id=d.get("id", doc.id),
                match_id=d.get("match_id", match_id),
                user_id=d.get("user_id", ""),
                nickname=d.get("nickname") or _mask_user(d.get("user_id", "")),
                pick_tag=d.get("pick_tag"),
                content=d.get("content", ""),
                timestamp=str(d.get("timestamp", "")),
            ))
        if items:
            items.sort(key=lambda x: x.timestamp, reverse=True)
            return items
    except Exception as e:
        logger.warning(f"Firestore comments read fallback: {e}")

    return COMMENTS_DB.get(match_id, [])


@router.get("/feed")
async def get_community_feed(limit: int = Query(default=15, ge=1, le=50)):
    """
    전체 매치 실시간 커뮤니티 분석 톡 피드 조회 (신규 방문자 활성화용)
    """
    items: List[dict] = []
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        docs = (
            db.collection(COMMENTS_COLLECTION)
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        for doc in docs:
            d = doc.to_dict()
            items.append({
                "id": d.get("id", doc.id),
                "match_id": d.get("match_id", "전체 라운지"),
                "nickname": d.get("nickname") or _mask_user(d.get("user_id", "")),
                "pick_tag": d.get("pick_tag") or "데이터 분석",
                "content": d.get("content", ""),
                "timestamp": str(d.get("timestamp", "")),
            })
    except Exception as e:
        logger.warning(f"Community feed Firestore read error: {e}")

    for mid, clist in COMMENTS_DB.items():
        for c in clist:
            if not any(x["id"] == c.id for x in items):
                items.append(c.model_dump())

    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"status": "ok", "comments": items[:limit]}
