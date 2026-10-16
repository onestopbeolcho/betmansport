import pickle
import os
import sys
from datetime import datetime

token_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "youtube_token.pickle")
print(f"Checking token at: {token_path}")

if not os.path.exists(token_path):
    print("youtube_token.pickle does not exist!")
    sys.exit(1)

try:
    with open(token_path, "rb") as f:
        creds = pickle.load(f)
    
    print(f"Credentials type: {type(creds)}")
    print(f"Valid: {creds.valid}")
    print(f"Expired: {creds.expired}")
    print(f"Scopes: {creds.scopes}")
    
    if hasattr(creds, "expiry"):
        print(f"Expiry: {creds.expiry} (UTC)")
        # Calculate time remaining
        if creds.expiry:
            expiry_dt = creds.expiry.replace(tzinfo=None) if hasattr(creds.expiry, "replace") else datetime.strptime(str(creds.expiry), "%Y-%m-%d %H:%M:%S")
            now = datetime.utcnow()
            diff = expiry_dt - now
            print(f"Time remaining: {diff}")
    
    print(f"Has refresh token: {bool(creds.refresh_token)}")
    if creds.refresh_token:
         print(f"Refresh token: {creds.refresh_token[:5]}...{creds.refresh_token[-5:] if len(creds.refresh_token) > 10 else ''}")
    else:
         print("WARNING: No refresh token found!")

    # Attempt to refresh if expired
    if creds.expired:
        print("Token is expired. Attempting to refresh...")
        from google.auth.transport.requests import Request
        try:
            creds.refresh(Request())
            print(f"Refresh successful! New expiry: {creds.expiry}")
            # Save the refreshed token
            with open(token_path, "wb") as token:
                pickle.dump(creds, token)
            print("Saved refreshed token back to pickle file.")
        except Exception as refresh_err:
            print(f"Failed to refresh token: {refresh_err}")

except Exception as e:
    print(f"Error reading token: {e}")
