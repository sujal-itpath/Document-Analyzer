import os
import sys
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("Error: No API key found in .env")
    sys.exit(1)

models_to_test = process.env.get("TEST_CASE_MODEL_NAME", "gemini-2.5-flash").split(",")
for model in models_to_test:
    try:
        print(f"Testing model: {model} ... ", end="", flush=True)
        llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=0.0,
        )
        response = llm.invoke("Hi, tell me one word.")
        print(f"SUCCESS! Response: {response.content.strip()}")
    except Exception as e:
        print(f"FAILED: {e}")
