import os
import requests
from dotenv import load_dotenv

load_dotenv('.env')
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("No API key found in .env")
    exit(1)

print("Checking available models...")
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)

if response.status_code == 200:
    models = response.json().get('models', [])
    print("\nSupported Models for generateContent:")
    for model in models:
        if 'generateContent' in model.get('supportedGenerationMethods', []):
            print(f"- {model['name']}")
else:
    print(f"Error: {response.status_code} - {response.text}")
