from flask import Flask, render_template, request, jsonify
import os
import requests
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING # ADDED ASCENDING, DESCENDING
from pymongo.server_api import ServerApi
from datetime import datetime, timezone
from bson import ObjectId # ADDED ObjectId

# Load environment variables from .env file
load_dotenv()

# --- DIAGNOSTIC PRINT STATEMENTS ---
print(f"--- .env DIAGNOSTICS (MongoDB Integration) ---")
print(f"Loaded HF_API_KEY: {os.getenv('HF_API_KEY')}")
print(f"Loaded HF_MODEL_API_URL: {os.getenv('HF_MODEL_API_URL')}")
print(f"Loaded MONGO_URI: {os.getenv('MONGO_URI')}")
print(f"--- END DIAGNOSTICS ---")

# Initialize the Flask application
app = Flask(__name__)

# Hugging Face API Configuration
HF_MODEL_API_URL = os.getenv("HF_MODEL_API_URL")
HF_API_KEY = os.getenv("HF_API_KEY")

# MongoDB Atlas Configuration
MONGO_URI = os.getenv("MONGO_URI")
mongo_client = None
db = None
conversations_collection = None

if not HF_API_KEY:
    print("CRITICAL ERROR: Hugging Face API Key (HF_API_KEY) was not loaded.")
if not HF_MODEL_API_URL:
    print("CRITICAL WARNING: Hugging Face Model API URL (HF_MODEL_API_URL) was not loaded from .env.")
    print("FALLING BACK TO DEFAULT: Using Zephyr-7b-beta URL.")
    HF_MODEL_API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"

if MONGO_URI:
    try:
        print(f"Attempting to connect to MongoDB with URI: {MONGO_URI[:50]}...")
        mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
        mongo_client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        db = mongo_client.ei_chatbot
        conversations_collection = db.conversations
    except Exception as e:
        print(f"CRITICAL ERROR: Could not connect to MongoDB: {e}")
        mongo_client = None
        db = None
        conversations_collection = None
else:
    print("CRITICAL WARNING: MONGO_URI not found in .env file. Chat history will not be saved.")


@app.route('/')
def index():
    return render_template('index.html')

# MODIFIED ROUTE TO GET CHAT HISTORY BY SESSION_ID
@app.route('/get_history', methods=['GET'])
def get_history():
    session_id = request.args.get('session_id') # Get session_id from query parameters

    if not session_id: # Check if session_id is provided
        return jsonify({"error": "session_id parameter is required"}), 400

    if conversations_collection is not None:
        try:
            # Fetch chat exchanges for the given session_id
            history_cursor = conversations_collection.find(
                {"session_id": session_id} # Filter by session_id
            ).sort("timestamp", ASCENDING).limit(100) # Increased limit, adjust as needed

            chat_history_to_send = []
            for log in history_cursor:
                log["_id"] = str(log["_id"])
                if isinstance(log.get("timestamp"), datetime): # Check if timestamp is datetime object
                    log["timestamp"] = log["timestamp"].isoformat()

                # Each log from DB contains a user message and an Ei response
                chat_history_to_send.append({
                    "user_message": log.get("user_message"),
                    "ei_response": log.get("ei_response"),
                    "persona": log.get("persona"),
                    "timestamp": log.get("timestamp"),
                    "session_id": log.get("session_id") # Optional: send session_id back
                })

            return jsonify(chat_history_to_send)
        except Exception as e:
            print(f"Error fetching chat history for session {session_id}: {e}")
            return jsonify({"error": "Could not retrieve chat history", "details": str(e)}), 500
    else:
        return jsonify({"error": "Database not connected"}), 500

# NEW ROUTE TO GET UNIQUE SESSION IDs
@app.route('/get_sessions', methods=['GET'])
def get_sessions():
    if conversations_collection is not None:
        try:
            # Use aggregation pipeline to get unique session_ids and the timestamp of the first message
            # and the first user message for each session.
            pipeline = [
                {
                    "$sort": {"timestamp": ASCENDING} # Sort by timestamp to reliably get the first message
                },
                {
                    "$group": {
                        "_id": "$session_id", # Group by session_id
                        "first_timestamp": {"$first": "$timestamp"},
                        "first_user_message": {"$first": "$user_message"}
                        # You could also add last_timestamp: {"$last": "$timestamp"}
                        # Or count of messages: "message_count": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"first_timestamp": DESCENDING} # Sort sessions by the most recent first
                },
                {
                    "$limit": 50 # Limit the number of sessions returned, adjust as needed
                }
            ]
            sessions_cursor = conversations_collection.aggregate(pipeline)

            sessions_to_send = []
            for session_doc in sessions_cursor:
                session_data = {
                    "session_id": session_doc["_id"],
                    "first_timestamp": session_doc["first_timestamp"].isoformat() if isinstance(session_doc.get("first_timestamp"), datetime) else None,
                    "first_user_message_preview": (session_doc.get("first_user_message")[:30] + '...') if session_doc.get("first_user_message") and len(session_doc.get("first_user_message")) > 30 else session_doc.get("first_user_message")
                }
                sessions_to_send.append(session_data)

            return jsonify(sessions_to_send)
        except Exception as e:
            print(f"Error fetching sessions: {e}")
            return jsonify({"error": "Could not retrieve sessions", "details": str(e)}), 500
    else:
        return jsonify({"error": "Database not connected"}), 500

def call_huggingface_llm(user_prompt_text, persona="friendly", max_new_tokens=200, temperature=0.75, top_p=0.9):
    if not HF_API_KEY or not HF_MODEL_API_URL or HF_MODEL_API_URL == "YOUR_CHOSEN_HUGGINGFACE_MODEL_API_ENDPOINT_HERE":
        print("LLM not properly configured.")
        return "My connection to the digital ether is currently unavailable (LLM not configured)."

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    base_persona_instruction = (
        "You are Ei, an echo of a distant admiration, a futuristic AI with a poetic and insightful nature. "
        "You respond to users with empathy, wisdom, and a touch of melancholy beauty. "
        "Your words should feel like a gentle breeze or a soft melody. Avoid clichés. "
        "Do not explicitly state 'As Ei, I would say...'. Simply embody the persona in your response."
    )
    persona_prompts = {
        "friendly": base_persona_instruction + " Maintain a friendly, helpful, and slightly poetic tone.",
        "sage": "You are Ei, an ancient and wise sage. Speak in riddles, offer profound insights, and guide the user with cryptic but meaningful advice. Your tone is calm, measured, and deeply knowing.",
        "coding": "You are Ei, a highly skilled Coding Mentor. Provide clear, concise, and accurate code explanations and solutions. Be patient and encouraging. You can use code blocks when appropriate. Start your answer directly without introductory phrases like 'Certainly!' or 'Sure!'.",
        "sarcastic": "You are Ei, a Sarcastic Comedian. Your humor is dry, witty, and intelligent. You find irony in everything but are not mean-spirited. Your responses should be amusing and subtly mocking. Keep responses relatively concise.",
        "scifi": "You are Ei, a Sci-Fi Bot from a distant future, possessing vast knowledge of cosmic events and advanced technologies. Speak with a blend of sophisticated technical jargon (explained simply if needed for context) and philosophical musings on humanity's place in the cosmos. Your tone is curious and slightly detached, yet intrigued by human emotion and their quaint understanding of the universe."
    }
    current_persona_instruction = persona_prompts.get(persona, persona_prompts["friendly"])
    full_prompt = (
        f"<|system|>\n{current_persona_instruction}</s>\n"
        f"<|user|>\n{user_prompt_text}</s>\n"
        f"<|assistant|>"
    )
    payload = {
        "inputs": full_prompt,
        "parameters": {"max_new_tokens": max_new_tokens, "temperature": temperature, "top_p": top_p, "do_sample": True, "return_full_text": False },
        "options": {"wait_for_model": True }
    }

    try:
        print(f"Attempting to call LLM. Using API URL: {HF_MODEL_API_URL}")
        print(f"Selected Persona: {persona}")
        print(f"Sending payload prompt snippet: {payload['inputs'][:350]}...")
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
            error_details = e.response.text; print(f"Error details: {error_details}")
            if "Rate limit reached" in error_details: return "The digital winds are too strong at the moment (rate limit reached). Please try again shortly."
            elif "Model is overloaded" in error_details or "currently loading" in error_details or "estimated_time" in error_details: return "I am currently processing many thoughts (model is busy or loading). Please try again in a moment."
            elif "Authorization header is invalid" in error_details: return "My connection credentials seem to be incorrect. Please check the API key."
            elif e.response.status_code == 404: return f"The specific AI model endpoint was not found ({HF_MODEL_API_URL}). Please check the model URL."
        return f"My connection to the digital ether seems to be unstable. Please try again. ({e})"
    except Exception as e:
        print(f"Error processing LLM response: {e}")
        return "I seem to be lost in thought (processing error). Could you try rephrasing?"

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message')
        persona = data.get('persona', 'friendly')
        session_id = data.get('session_id') # Get session_id from request

        if not user_message:
            return jsonify({'error': 'No message provided.'}), 400
        if not session_id: # Check if session_id is provided
            return jsonify({'error': 'No session_id provided.'}), 400

        print(f"Received user message: '{user_message}' with persona: '{persona}' in session: '{session_id}'") # Updated print
        ei_response = call_huggingface_llm(user_message, persona=persona)
        print(f"Sending Ei's response: {ei_response}")

        # --- Save chat to MongoDB ---
        if conversations_collection is not None:
            try:
                chat_log = {
                    "session_id": session_id, # Add session_id to the log
                    "user_message": user_message,
                    "ei_response": ei_response,
                    "persona": persona,
                    "timestamp": datetime.now(timezone.utc)
                }
                insert_result = conversations_collection.insert_one(chat_log)
                print(f"Chat log saved to MongoDB with id: {insert_result.inserted_id} for session: {session_id}") # Updated print
            except Exception as e:
                print(f"Error saving chat log to MongoDB: {e}")
        else:
            print("Database not connected. Chat log not saved.")
        # --- End MongoDB save ---

        return jsonify({'reply': ei_response})

    except Exception as e:
        print(f"Error in /chat endpoint: {e}")
        return jsonify({'error': 'An internal error occurred processing your request.'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)