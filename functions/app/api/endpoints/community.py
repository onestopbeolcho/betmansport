"""
Community API — Comments only.
Vote functionality has been merged into the Prediction API
to avoid dual API calls and ensure data consistency.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime
import uuid

router = APIRouter()


# --- Models ---
class CommentRequest(BaseModel):
    match_id: str
    user_id: str
    content: str


class CommentResponse(BaseModel):
    id: str
    match_id: str
    user_id: str
    content: str
    timestamp: str


# --- In-memory storage (to be migrated to Firestore in Phase 3) ---
COMMENTS_DB: Dict[str, List[CommentResponse]] = {}


# --- Endpoints ---

@router.post("/comment", response_model=CommentResponse)
async def post_comment(comment: CommentRequest):
    """Post a new comment on a match."""
    new_comment = CommentResponse(
        id=str(uuid.uuid4()),
        match_id=comment.match_id,
        user_id=comment.user_id,
        content=comment.content,
        timestamp=datetime.now().isoformat()
    )

    if comment.match_id not in COMMENTS_DB:
        COMMENTS_DB[comment.match_id] = []

    COMMENTS_DB[comment.match_id].insert(0, new_comment)
    return new_comment


@router.get("/comments/{match_id}", response_model=List[CommentResponse])
async def get_comments(match_id: str):
    """Get list of comments for a match."""
    return COMMENTS_DB.get(match_id, [])
