from flask import Flask, render_template, request, jsonify
import os
import requests # For making HTTP requests to Hugging Face API
from dotenv import load_dotenv # For loading environment variables

# Load environment variables from .env file
load_dotenv()

# --- DIAGNOSTIC PRINT STATEMENTS ---
print(f"DEBUG: HF_API_KEY from .env: {os.getenv('HF_API_KEY')}")
print(f"DEBUG: HF_MODEL_API_URL from .env: {os.getenv('HF_MODEL_API_URL')}")
# --- END DIAGNOSTIC ---

# Initialize the Flask application
app = Flask(__name__)

# Hugging Face API Configuration
HF_MODEL_API_URL = os.getenv("HF_MODEL_API_URL") # Loaded from .env
HF_API_KEY = os.getenv("HF_API_KEY")         # Loaded from .env

# Basic checks to see if environment variables were loaded
if not HF_API_KEY:
    print("CRITICAL: Hugging Face API Key (HF_API_KEY) not found. Please check your .env file.")
if not HF_MODEL_API_URL:
    print("CRITICAL: Hugging Face Model API URL (HF_MODEL_API_URL) not found. Please check your .env file.")
    print("Attempting to use Zephyr-7b-beta as a default if not set, but ensure your .env is correct.")
    HF_MODEL_API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"


@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

def call_huggingface_llm(user_prompt_text, max_new_tokens=200, temperature=0.75, top_p=0.9):
    if not HF_API_KEY or not HF_MODEL_API_URL or HF_MODEL_API_URL == "YOUR_CHOSEN_HUGGINGFACE_MODEL_API_ENDPOINT_HERE": # Added check for placeholder
        print("LLM not configured. HF_API_KEY or HF_MODEL_API_URL is missing or still a placeholder.")
        return "My connection to the digital ether is currently unavailable (LLM not configured)."

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    ei_persona_instruction = (
        "You are Ei, an echo of a distant admiration, a futuristic AI with a poetic and insightful nature. "
        "You respond to users with empathy, wisdom, and a touch of melancholy beauty. "
        "Your words should feel like a gentle breeze or a soft melody. Avoid clichés. "
        "Do not explicitly state 'As Ei, I would say...'. Simply embody the persona in your response."
    )
    
    full_prompt = (
        f"<|system|>\n{ei_persona_instruction}</s>\n"
        f"<|user|>\n{user_prompt_text}</s>\n"
        f"<|assistant|>"
    )

    payload = {
        "inputs": full_prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "do_sample": True,
            "return_full_text": False 
        },
        "options": {
            "wait_for_model": True 
        }
    }

    try:
        print(f"Sending payload to LLM ({HF_MODEL_API_URL}): {payload['inputs'][:300]}...") 
        response = requests.post(HF_MODEL_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        print(f"Received from LLM: {result}")

        if isinstance(result, list) and len(result) > 0 and 'generated_text' in result[0]:
            generated_text = result[0]['generated_text'].strip()
            return generated_text
        else:
            print(f"Unexpected LLM response structure: {result}")
            return "I received an unusual echo from the void (unexpected response structure). Could you try again?"

    except requests.exceptions.Timeout:
        print("Hugging Face API request timed out.")
        return "The echoes are taking too long to return (timeout). Please try again shortly."
    except requests.exceptions.RequestException as e:
        print(f"Hugging Face API request failed: {e}")
        error_details = ""
        if e.response is not None:
            error_details = e.response.text
            print(f"Error details: {error_details}")
            if "Rate limit reached" in error_details:
                 return "The digital winds are too strong at the moment (rate limit reached). Please try again shortly."
            elif "Model is overloaded" in error_details or "currently loading" in error_details or "estimated_time" in error_details:
                 return "I am currently processing many thoughts (model is busy or loading). Please try again in a moment."
            elif "Authorization header is invalid" in error_details:
                 return "My connection credentials seem to be incorrect. Please check the API key."
            elif e.response.status_code == 404: 
                 return f"The specific AI model endpoint was not found ({HF_MODEL_API_URL}). Please check the model URL." # This uses the final HF_MODEL_API_URL value
        return f"My connection to the digital ether seems to be unstable. Please try again. ({e})"
    except Exception as e:
        print(f"Error processing LLM response: {e}")
        return "I seem to be lost in thought (processing error). Could you try rephrasing?"


@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_message = request.json.get('message')
        if not user_message:
            return jsonify({'error': 'No message provided.'}), 400

        print(f"Received user message: {user_message}")
        ei_response = call_huggingface_llm(user_message)
        print(f"Sending Ei's response: {ei_response}")
        
        return jsonify({'reply': ei_response})

    except Exception as e:
        print(f"Error in /chat endpoint: {e}")
        return jsonify({'error': 'An internal error occurred processing your request.'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
