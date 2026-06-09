"""
Video Generation API Endpoints
POST /api/video/generate  — 영상 유형 선택하여 제작 요청
GET  /api/video/types     — 사용 가능한 영상 유형 목록
GET  /api/video/status/{job_id} — 제작 상태 확인
GET  /api/video/list      — 생성된 영상 목록
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# 영상 저장 루트 (프로젝트 루트 기준)
_BASE_DIR = Path(__file__).parent.parent.parent.parent.parent  # backend/app/api/endpoints → 프로젝트 루트
VIDEO_OUTPUT_DIR = _BASE_DIR / "video" / "output"
VIDEO_SCENARIOS_DIR = _BASE_DIR / "video" / "scenarios"

# 진행 중인 작업 상태 저장 (메모리)
_jobs: Dict[str, dict] = {}


class VideoGenerateRequest(BaseModel):
    type: str           # 시나리오 유형 키
    headless: bool = True  # False면 브라우저 화면 표시


class VideoGenerateResponse(BaseModel):
    job_id: str
    status: str
    message: str


async def _run_video_job(job_id: str, scenario_name: str, headless: bool):
    """백그라운드에서 영상 제작 실행"""
    _jobs[job_id]["status"] = "processing"
    _jobs[job_id]["started_at"] = datetime.now().isoformat()

    try:
        import sys
        sys.path.insert(0, str(_BASE_DIR))

        from video.scenarios import SCENARIO_MAP
        from video.producer import produce
        from video.overlay import apply_overlay

        if scenario_name not in SCENARIO_MAP:
            raise ValueError(f"알 수 없는 시나리오: {scenario_name}")

        ScenarioClass = SCENARIO_MAP[scenario_name]
        scenario = ScenarioClass()

        VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 1단계: 녹화
        raw_webm = str(VIDEO_OUTPUT_DIR / f"{scenario_name}_{timestamp}_raw.webm")
        ok = await produce(scenario, raw_webm, headless=headless)

        if not ok:
            raise RuntimeError("Playwright 녹화 실패")

        # 2단계: 자막 합성
        final_mp4 = str(VIDEO_OUTPUT_DIR / f"{scenario_name}_{timestamp}.mp4")
        ok2 = apply_overlay(
            input_path=raw_webm,
            output_path=final_mp4,
            overlay_texts=scenario.overlay_texts,
            video_width=scenario.viewport_width,
            video_height=scenario.viewport_height,
        )

        if ok2 and os.path.exists(raw_webm):
            os.remove(raw_webm)
            output_file = final_mp4
        else:
            output_file = raw_webm

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["output_file"] = output_file
        _jobs[job_id]["filename"] = os.path.basename(output_file)
        _jobs[job_id]["finished_at"] = datetime.now().isoformat()
        logger.info(f"✅ 영상 제작 완료 [{job_id}]: {output_file}")

    except Exception as e:
        logger.error(f"❌ 영상 제작 실패 [{job_id}]: {e}", exc_info=True)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)
        _jobs[job_id]["finished_at"] = datetime.now().isoformat()


@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(req: VideoGenerateRequest, background_tasks: BackgroundTasks):
    """
    영상 제작 요청. 백그라운드에서 실행되며 job_id로 상태 확인 가능.

    - **type**: 영상 유형 (accuracy_reveal / odds_drop_alert / ai_analysis / vip_showcase)
    - **headless**: True=백그라운드, False=브라우저 화면 표시 (디버그)
    """
    # 유효한 시나리오 유형인지 확인
    try:
        import sys
        sys.path.insert(0, str(_BASE_DIR))
        from video.scenarios import SCENARIO_MAP
        if req.type not in SCENARIO_MAP:
            raise HTTPException(
                status_code=400,
                detail=f"알 수 없는 영상 유형: '{req.type}'. 가능한 값: {list(SCENARIO_MAP.keys())}"
            )
    except ImportError:
        raise HTTPException(status_code=500, detail="video 모듈을 로드할 수 없습니다.")

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "job_id": job_id,
        "type": req.type,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
    }

    background_tasks.add_task(_run_video_job, job_id, req.type, req.headless)

    return VideoGenerateResponse(
        job_id=job_id,
        status="queued",
        message=f"영상 제작이 시작되었습니다. /api/video/status/{job_id} 에서 상태를 확인하세요.",
    )


@router.get("/status/{job_id}")
async def get_video_status(job_id: str):
    """영상 제작 상태 확인"""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}'을 찾을 수 없습니다.")
    return _jobs[job_id]


@router.get("/download/{job_id}")
async def download_video(job_id: str):
    """완성된 영상 다운로드"""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job을 찾을 수 없습니다.")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"영상이 아직 완성되지 않았습니다. (상태: {job['status']})")

    output_file = job.get("output_file")
    if not output_file or not os.path.exists(output_file):
        raise HTTPException(status_code=404, detail="영상 파일을 찾을 수 없습니다.")

    return FileResponse(
        output_file,
        media_type="video/mp4",
        filename=os.path.basename(output_file),
    )


@router.get("/types")
async def list_video_types():
    """사용 가능한 영상 유형 목록"""
    try:
        import sys
        sys.path.insert(0, str(_BASE_DIR))
        from video.scenarios import SCENARIO_MAP
        return {
            name: {
                "name": cls().name,
                "description": cls().description,
                "duration": cls().duration,
                "requires_login": cls().requires_login,
            }
            for name, cls in SCENARIO_MAP.items()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_generated_videos():
    """생성된 영상 파일 목록"""
    VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in sorted(VIDEO_OUTPUT_DIR.iterdir(), reverse=True):
        if f.suffix in (".mp4", ".webm") and not f.name.endswith("_raw.webm"):
            files.append({
                "filename": f.name,
                "size_mb": round(f.stat().st_size / (1024 * 1024), 1),
                "created": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    return {"videos": files, "count": len(files)}


@router.get("/jobs")
async def list_jobs():
    """현재 세션의 모든 작업 목록"""
    return {"jobs": list(_jobs.values()), "count": len(_jobs)}
