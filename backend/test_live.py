import urllib.request
import json

data = json.dumps({'username': 'testdeact', 'password': 'Tpass123'}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/users/token/', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status Output: {response.status}")
        print(f"JSON Output: {response.read().decode('utf-8')}")
except urllib.error.HTTPError as e:
    print(f"Status Output: {e.code}")
    print(f"JSON Output: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
