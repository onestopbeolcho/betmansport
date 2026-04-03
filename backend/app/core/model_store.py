"""
GCS Model Store — Google Cloud Storage 기반 ML 모델 저장/로드.
LightGBM .pkl 모델 파일을 GCS 버킷에 저장하고 Cloud Run에서 로드.
"""
import logging
import os
import tempfile
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_storage_client = None
_initialized = False

BUCKET_NAME = os.getenv("GCS_MODEL_BUCKET", "scorenix-ml-models")
MODEL_PREFIX = "models/"


def _get_storage_client():
    """Lazy-init GCS client."""
    global _storage_client, _initialized
    if _initialized:
        return _storage_client
    _initialized = True
    try:
        from google.cloud import storage
        _storage_client = storage.Client()
        logger.info("✅ GCS client initialized")
        return _storage_client
    except Exception as e:
        logger.warning(f"GCS init failed (will use local fallback): {e}")
        return None


def _ensure_bucket():
    """Create bucket if it doesn't exist."""
    client = _get_storage_client()
    if not client:
        return None
    try:
        bucket = client.bucket(BUCKET_NAME)
        if not bucket.exists():
            bucket = client.create_bucket(BUCKET_NAME, location="asia-northeast3")
            logger.info(f"✅ Created GCS bucket: {BUCKET_NAME}")
        return bucket
    except Exception as e:
        logger.error(f"GCS bucket error: {e}")
        return None


def save_model(model, model_name: str = "lightgbm_predictor", version: Optional[str] = None) -> str:
    """
    Save a model to GCS (or local fallback).
    Returns the model path/URI.
    """
    import joblib

    if version is None:
        version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    filename = f"{model_name}_v{version}.pkl"
    gcs_path = f"{MODEL_PREFIX}{filename}"

    # Always save locally first
    local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "ml_models")
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    joblib.dump(model, local_path)
    logger.info(f"Model saved locally: {local_path}")

    # Also save as 'latest'
    latest_path = os.path.join(local_dir, f"{model_name}_latest.pkl")
    joblib.dump(model, latest_path)

    # Try GCS upload
    client = _get_storage_client()
    if client:
        try:
            bucket = _ensure_bucket()
            if bucket:
                blob = bucket.blob(gcs_path)
                blob.upload_from_filename(local_path)
                logger.info(f"✅ Model uploaded to GCS: gs://{BUCKET_NAME}/{gcs_path}")

                # Also upload as 'latest'
                latest_blob = bucket.blob(f"{MODEL_PREFIX}{model_name}_latest.pkl")
                latest_blob.upload_from_filename(local_path)
                return f"gs://{BUCKET_NAME}/{gcs_path}"
        except Exception as e:
            logger.warning(f"GCS upload failed (local copy retained): {e}")

    return local_path


def load_model(model_name: str = "lightgbm_predictor", version: Optional[str] = None):
    """
    Load model from GCS (or local fallback).
    Tries: GCS latest → local latest → None.
    """
    import joblib

    filename = f"{model_name}_latest.pkl" if version is None else f"{model_name}_v{version}.pkl"

    # Try local first (faster)
    local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "ml_models")
    local_path = os.path.join(local_dir, filename)
    if os.path.exists(local_path):
        try:
            model = joblib.load(local_path)
            logger.info(f"Model loaded from local: {local_path}")
            return model
        except Exception as e:
            logger.warning(f"Local model load failed: {e}")

    # Try GCS
    client = _get_storage_client()
    if client:
        try:
            bucket = client.bucket(BUCKET_NAME)
            gcs_path = f"{MODEL_PREFIX}{filename}"
            blob = bucket.blob(gcs_path)
            if blob.exists():
                with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as tmp:
                    blob.download_to_filename(tmp.name)
                    model = joblib.load(tmp.name)
                    # Cache locally
                    os.makedirs(local_dir, exist_ok=True)
                    joblib.dump(model, local_path)
                    logger.info(f"Model loaded from GCS and cached: {gcs_path}")
                    return model
        except Exception as e:
            logger.warning(f"GCS model load failed: {e}")

    logger.warning(f"No model found for {model_name}")
    return None


def list_model_versions(model_name: str = "lightgbm_predictor") -> list:
    """List all available model versions."""
    versions = []

    # Check local
    local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "ml_models")
    if os.path.exists(local_dir):
        for f in os.listdir(local_dir):
            if f.startswith(model_name) and f.endswith(".pkl") and "latest" not in f:
                version = f.replace(f"{model_name}_v", "").replace(".pkl", "")
                versions.append({"version": version, "source": "local", "path": os.path.join(local_dir, f)})

    # Check GCS
    client = _get_storage_client()
    if client:
        try:
            bucket = client.bucket(BUCKET_NAME)
            blobs = bucket.list_blobs(prefix=f"{MODEL_PREFIX}{model_name}_v")
            for blob in blobs:
                version = blob.name.replace(f"{MODEL_PREFIX}{model_name}_v", "").replace(".pkl", "")
                if version not in [v["version"] for v in versions]:
                    versions.append({"version": version, "source": "gcs", "path": f"gs://{BUCKET_NAME}/{blob.name}"})
        except Exception:
            pass

    return sorted(versions, key=lambda x: x["version"], reverse=True)
