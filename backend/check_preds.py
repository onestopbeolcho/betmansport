import urllib.request
import json
try:
    res = urllib.request.urlopen("https://scorenix-backend-n5dv44kdaa-du.a.run.app/api/ai/predictions")
    data = json.loads(res.read().decode('utf-8'))
    preds = data.get("predictions", [])
    print(f"Total predictions: {len(preds)}")
    if preds:
        high_conf = [p for p in preds if p.get("confidence", 0) >= 55]
        print(f"High confidence predictions (>=55%): {len(high_conf)}")
        if high_conf:
            print(f"Example: {high_conf[0].get('match_id')} - conf: {high_conf[0].get('confidence')}%")
        else:
            print(f"Max confidence: {max(p.get('confidence', 0) for p in preds)}%")
except Exception as e:
    print("Error:", e)
