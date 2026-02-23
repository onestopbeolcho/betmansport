from google.cloud import firestore
import os
import logging

logger = logging.getLogger(__name__)

# Singleton instance
_db = None

def get_firestore_db():
    global _db
    if _db is None:
        try:
            # Automatic authentication via Google Application Default Credentials
            # Works in Cloud Functions and locally if 'gcloud auth application-default login' was run.
            _db = firestore.Client()
            logger.info("Firestore Client Initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            raise e
    return _db
