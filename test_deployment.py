import urllib.request
import json

try:
    print("Testing http://3.26.129.31:8000/ ...")
    with urllib.request.urlopen("http://3.26.129.31:8000/") as response:
        data = json.loads(response.read().decode())
        print("Success:", data)
except Exception as e:
    print("Failed:", e)
