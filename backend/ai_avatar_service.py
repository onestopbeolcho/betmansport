"""
AI Avatar Service — ElevenLabs TTS + D-ID Talking Head
======================================================
스코어닉스 쇼츠 파이프라인을 위한 AI 아바타 서비스.
- ElevenLabs: 사람과 구분 불가능한 자연스러운 TTS
- D-ID: 사진 + 오디오 → 말하는 사람 영상 생성

API 키가 없으면 기존 Edge TTS + 정적 배경으로 자동 폴백.
"""

import os
import time
import json
import requests
from pathlib import Path

# .env 파일 자동 로드
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass  # python-dotenv 없으면 환경변수에서 직접 읽음

# ─── 설정 ─────────────────────────────────────────────
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DID_API_KEY = os.getenv("DID_API_KEY", "")

# ElevenLabs 설정
ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
ELEVENLABS_MODEL = "eleven_multilingual_v2"
# 한국어 여성 음성 (기본값, 변경 가능)
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel (default)

# D-ID 설정
DID_BASE = "https://api.d-id.com"
PRESENTER_IMAGE = os.path.join(os.path.dirname(__file__), "presenter.png")


def is_elevenlabs_available():
    return bool(ELEVENLABS_API_KEY)


def is_did_available():
    return bool(DID_API_KEY) and os.path.exists(PRESENTER_IMAGE)


# ═══════════════════════════════════════════════════════
# ElevenLabs TTS
# ═══════════════════════════════════════════════════════

def elevenlabs_tts(text: str, output_path: str, voice_id: str = None) -> bool:
    """
    ElevenLabs API로 자연스러운 음성 생성.
    성공 시 True, 실패 시 False (폴백용).
    """
    if not ELEVENLABS_API_KEY:
        return False

    vid = voice_id or ELEVENLABS_VOICE_ID

    try:
        url = f"{ELEVENLABS_BASE}/text-to-speech/{vid}?output_format=mp3_44100_128"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": ELEVENLABS_MODEL,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3,
            },
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=30)

        if resp.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(resp.content)
            print(f"    ✅ ElevenLabs TTS → {os.path.basename(output_path)}")
            return True
        else:
            print(f"    ⚠ ElevenLabs error {resp.status_code}: {resp.text[:100]}")
            return False

    except Exception as e:
        print(f"    ⚠ ElevenLabs exception: {e}")
        return False


def list_elevenlabs_voices():
    """사용 가능한 ElevenLabs 음성 목록 조회"""
    if not ELEVENLABS_API_KEY:
        print("❌ ELEVENLABS_API_KEY not set")
        return []

    try:
        resp = requests.get(
            f"{ELEVENLABS_BASE}/voices",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            timeout=15,
        )
        if resp.status_code == 200:
            voices = resp.json().get("voices", [])
            for v in voices:
                labels = v.get("labels", {})
                lang = labels.get("language", "?")
                print(f"  🎙️ {v['name']} (ID: {v['voice_id']}) — {lang}")
            return voices
        else:
            print(f"❌ Error: {resp.status_code}")
            return []
    except Exception as e:
        print(f"❌ {e}")
        return []


# ═══════════════════════════════════════════════════════
# D-ID Talking Head
# ═══════════════════════════════════════════════════════

def _upload_image_to_did(image_path: str) -> str:
    """D-ID에 프레젠터 이미지 업로드 → URL 반환"""
    url = f"{DID_BASE}/images"
    headers = {
        "Authorization": f"Basic {DID_API_KEY}",
        "accept": "application/json",
    }

    with open(image_path, "rb") as f:
        files = {"image": (os.path.basename(image_path), f, "image/png")}
        resp = requests.post(url, headers=headers, files=files, timeout=30)

    if resp.status_code in (200, 201):
        data = resp.json()
        img_url = data.get("url", "")
        print(f"    ✅ D-ID image uploaded: ...{img_url[-30:]}")
        return img_url
    else:
        raise Exception(f"D-ID image upload failed: {resp.status_code} {resp.text[:100]}")


def _upload_audio_to_did(audio_path: str) -> str:
    """D-ID에 오디오 업로드 → URL 반환"""
    url = f"{DID_BASE}/audios"
    headers = {
        "Authorization": f"Basic {DID_API_KEY}",
        "accept": "application/json",
    }

    with open(audio_path, "rb") as f:
        files = {"audio": (os.path.basename(audio_path), f, "audio/mpeg")}
        resp = requests.post(url, headers=headers, files=files, timeout=30)

    if resp.status_code in (200, 201):
        data = resp.json()
        audio_url = data.get("url", "")
        print(f"    ✅ D-ID audio uploaded: ...{audio_url[-30:]}")
        return audio_url
    else:
        raise Exception(f"D-ID audio upload failed: {resp.status_code} {resp.text[:100]}")


def create_talking_head(audio_path: str, output_path: str,
                        image_path: str = None) -> bool:
    """
    D-ID API로 말하는 아바타 영상 생성.

    1. 프레젠터 이미지 업로드
    2. 오디오 업로드
    3. Talk 생성 요청
    4. 완료 대기 (폴링)
    5. 결과 영상 다운로드

    성공 시 True, 실패 시 False.
    """
    if not DID_API_KEY:
        return False

    img = image_path or PRESENTER_IMAGE
    if not os.path.exists(img):
        print(f"    ⚠ Presenter image not found: {img}")
        return False

    try:
        # 1. 이미지 & 오디오 업로드
        print("    📤 Uploading to D-ID...")
        img_url = _upload_image_to_did(img)
        audio_url = _upload_audio_to_did(audio_path)

        # 2. Talk 생성 요청
        headers = {
            "Authorization": f"Basic {DID_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "source_url": img_url,
            "script": {
                "type": "audio",
                "audio_url": audio_url,
            },
            "config": {
                "result_format": "mp4",
                "stitch": True,     # 전신 포함 (자연스러운 배경)
            },
        }

        resp = requests.post(f"{DID_BASE}/talks", headers=headers,
                             json=payload, timeout=30)

        if resp.status_code not in (200, 201):
            print(f"    ⚠ D-ID talk create failed: {resp.status_code}")
            return False

        talk_id = resp.json().get("id")
        print(f"    🎬 D-ID Talk created: {talk_id}")

        # 3. 완료 대기 (최대 5분)
        print("    ⏳ Waiting for D-ID rendering...")
        for attempt in range(60):
            time.sleep(5)
            status_resp = requests.get(
                f"{DID_BASE}/talks/{talk_id}",
                headers={"Authorization": f"Basic {DID_API_KEY}"},
                timeout=15,
            )
            if status_resp.status_code != 200:
                continue

            data = status_resp.json()
            status = data.get("status")

            if status == "done":
                result_url = data.get("result_url")
                if result_url:
                    # 4. 다운로드
                    print(f"    📥 Downloading result video...")
                    video_resp = requests.get(result_url, timeout=60)
                    with open(output_path, "wb") as f:
                        f.write(video_resp.content)
                    print(f"    ✅ D-ID video → {os.path.basename(output_path)}")
                    return True
                break

            elif status == "error":
                err = data.get("error", {})
                print(f"    ❌ D-ID error: {err}")
                return False

            elif status in ("created", "started"):
                if attempt % 6 == 0:
                    print(f"      ... still rendering ({attempt * 5}s)")
                continue

        print("    ⚠ D-ID timeout (5min)")
        return False

    except Exception as e:
        print(f"    ❌ D-ID exception: {e}")
        return False


def create_full_avatar_clip(script_text: str, output_video: str,
                            output_audio: str = None) -> bool:
    """
    전체 흐름: 텍스트 → ElevenLabs TTS → D-ID 아바타 영상

    1. ElevenLabs로 음성 생성
    2. D-ID로 말하는 영상 생성
    3. 결과를 output_video에 저장

    하나라도 실패하면 False 반환 (기존 파이프라인으로 폴백).
    """
    if not is_elevenlabs_available() or not is_did_available():
        return False

    audio_path = output_audio or output_video.replace(".mp4", "_audio.mp3")

    # Step 1: TTS
    print("  🎙️ [AI Avatar] Step 1: ElevenLabs TTS")
    if not elevenlabs_tts(script_text, audio_path):
        return False

    # Step 2: Talking Head
    print("  🎬 [AI Avatar] Step 2: D-ID Talking Head")
    result = create_talking_head(audio_path, output_video)

    # Cleanup temp audio
    try:
        if os.path.exists(audio_path) and output_audio is None:
            os.remove(audio_path)
    except OSError:
        pass

    return result


# ═══════════════════════════════════════════════════════
# 상태 확인 유틸리티
# ═══════════════════════════════════════════════════════

def check_status():
    """현재 AI 서비스 연결 상태 확인"""
    print("=" * 50)
    print(" [AI] Avatar Service Status")
    print("=" * 50)

    # ElevenLabs
    if ELEVENLABS_API_KEY:
        print(f"  [OK] ElevenLabs: API key set ({ELEVENLABS_API_KEY[:8]}...)")
        try:
            resp = requests.get(
                f"{ELEVENLABS_BASE}/user",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                timeout=10,
            )
            if resp.status_code == 200:
                user = resp.json()
                sub = user.get("subscription", {})
                chars = sub.get("character_count", 0)
                limit = sub.get("character_limit", 0)
                print(f"       Plan: {sub.get('tier', '?')}")
                print(f"       Chars: {chars:,} / {limit:,}")
            else:
                print(f"       [!] API check failed: {resp.status_code}")
        except Exception as e:
            print(f"       [!] Connection error: {e}")
    else:
        print("  [X] ElevenLabs: No API key (set ELEVENLABS_API_KEY)")

    # D-ID
    if DID_API_KEY:
        print(f"  [OK] D-ID: API key set ({DID_API_KEY[:8]}...)")
        try:
            resp = requests.get(
                f"{DID_BASE}/credits",
                headers={"Authorization": f"Basic {DID_API_KEY}"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                remaining = data.get("remaining", "?")
                print(f"       Credits: {remaining}")
            else:
                print(f"       [!] API check failed: {resp.status_code}")
        except Exception as e:
            print(f"       [!] Connection error: {e}")
    else:
        print("  [X] D-ID: No API key (set DID_API_KEY)")

    # Presenter
    if os.path.exists(PRESENTER_IMAGE):
        size = os.path.getsize(PRESENTER_IMAGE)
        print(f"  [OK] Presenter image: {size / 1024:.0f}KB")
    else:
        print(f"  [X] Presenter image not found: {PRESENTER_IMAGE}")

    print()
    print(f"  [~] Fallback: Edge TTS + static background")
    print("=" * 50)


if __name__ == "__main__":
    check_status()

