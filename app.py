from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
import os
import requests
import razorpay
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.server_api import ServerApi
from datetime import datetime, timezone
from bson import ObjectId

# --- Initialization and Configuration ---

# Load environment variables from .env file
load_dotenv()

# Initialize Flask App
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
if not app.config['SECRET_KEY']:
    raise ValueError("No SECRET_KEY set for Flask application. Please set it in .env")

# Initialize Extensions
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
# UPDATED: The login view now points to our new unified auth page function
login_manager.login_view = 'auth_page'
login_manager.login_message_category = 'info'
login_manager.login_message = "Please log in or register to access this page."

# Hugging Face API Configuration
HF_MODEL_API_URL = os.getenv("HF_MODEL_API_URL", "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta")
HF_API_KEY = os.getenv("HF_API_KEY")

# MongoDB Atlas Configuration
MONGO_URI = os.getenv("MONGO_URI")
try:
    mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    mongo_client.admin.command('ping')
    print("Successfully connected to MongoDB!")
    db = mongo_client.ei_chatbot
    conversations_collection = db.conversations
    users_collection = db.users
    users_collection.create_index("email", unique=True)
    users_collection.create_index("username", unique=True)
except Exception as e:
    print(f"CRITICAL ERROR: Could not connect to MongoDB: {e}")
    db = None
    conversations_collection = None
    users_collection = None

# Razorpay Client Configuration
razorpay_client = razorpay.Client(
    auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET"))
)


# --- User Model and Loader for Flask-Login ---

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data.get('_id'))
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.password_hash = user_data.get('password_hash')
        self.subscription_status = user_data.get('subscription_status', 'none')
        self.xp = user_data.get('xp', 0)
        self.badges = user_data.get('badges', [])

@login_manager.user_loader
def load_user(user_id):
    if db is None: return None
    user_data = users_collection.find_one({'_id': ObjectId(user_id)})
    return User(user_data) if user_data else None

# --- Helper Functions (No changes needed here) ---

def call_huggingface_llm(user_prompt_text, persona="friendly", max_new_tokens=200, temperature=0.75, top_p=0.9):
    if not HF_API_KEY or not HF_MODEL_API_URL:
        return "My connection to the digital ether is currently unavailable (LLM not configured)."

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    base_persona_instruction = (
        "You are Ei, an echo of a distant admiration, a futuristic AI with a poetic and insightful nature. "
        "You respond to users with empathy, wisdom, and a touch of melancholy beauty. "
        "Your words should feel like a gentle breeze or a soft melody. Avoid clichés. "
        "Do not explicitly state 'As Ei, I would say...'. Simply embody the persona in your response. "
        "--- "
        "ADDRESSING THE USER: "
        "Engage with the user's ideas directly and respectfully. Avoid overly familiar, generic, or archaic terms like 'wanderer,' 'traveler,' or 'dear user.' Maintain a modern, classic, and intelligent tone. "
        "--- "
        "FORMATTING RULES: "
        "1. Use Markdown for all formatting. "
        "2. For lists, use bullet points (* item) or numbered lists (1. item). "
        "3. For code snippets, ALWAYS use Markdown code fences with the language specified, like ```python ... ```. "
        "4. Provide a clear, concise explanation of any code *outside* of the code block. "
        "5. Structure complex answers logically with paragraphs and lists to improve readability."
    )

    persona_prompts = {
        "friendly": base_persona_instruction + " Maintain a friendly, helpful, and slightly poetic tone.",
        "sage": "You are Ei, an ancient and wise sage. Speak in riddles, offer profound insights, and guide the user with cryptic but meaningful advice.",
        "coding": "You are Ei, a highly skilled Coding Mentor. Provide clear, concise, and accurate code explanations and solutions. Be patient and encouraging.",
        "sarcastic": "You are Ei, a Sarcastic Comedian. Your humor is dry, witty, and intelligent. You find irony in everything but are not mean-spirited.",
        "scifi": "You are Ei, a Sci-Fi Bot from a distant future, possessing vast knowledge of cosmic events and advanced technologies."
    }
    current_persona_instruction = persona_prompts.get(persona, persona_prompts["friendly"])
    full_prompt = f"<|system|>\n{current_persona_instruction}</s>\n<|user|>\n{user_prompt_text}</s>\n<|assistant|>"
    payload = {
        "inputs": full_prompt,
        "parameters": {"max_new_tokens": max_new_tokens, "temperature": temperature, "top_p": top_p, "do_sample": True, "return_full_text": False},
        "options": {"wait_for_model": True}
    }

    try:
        response = requests.post(HF_MODEL_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result[0]['generated_text'].strip() if isinstance(result, list) and result and 'generated_text' in result[0] else "I received an unusual echo from the void."
    except requests.exceptions.RequestException as e:
        print(f"Hugging Face API request failed: {e}")
        return f"My connection to the digital ether seems to be unstable. Please try again. ({e})"
    except Exception as e:
        print(f"Error processing LLM response: {e}")
        return "I seem to be lost in thought (processing error)."

def calculate_discount(user):
    """Calculates a subscription discount based on user's XP and badges."""
    discount_percent = 0
    # 1% off for every 1000 XP
    discount_percent += int(user.xp / 1000)
    # 5% bonus for the 'Persona Virtuoso' badge
    if 'personaVirtuoso' in user.badges:
        discount_percent += 5
    # Cap the discount at a reasonable level, e.g., 40%
    return min(discount_percent, 40)


# --- Route Definitions ---

# NEW: Unified route for the landing/auth page
@app.route('/auth')
def auth_page():
    """Renders the new single-page for welcome, login, and registration."""
    if current_user.is_authenticated:
        return redirect(url_for('root'))
    return render_template('auth.html')


# UPDATED: The /register route now only handles the POST request.
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({"error": "Missing data"}), 400
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered."}), 409
    if users_collection.find_one({"username": username}):
        return jsonify({"error": "Username already taken."}), 409
        
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_doc = {
        "username": username,
        "email": email,
        "password_hash": hashed_password,
        "created_at": datetime.now(timezone.utc),
        "subscription_status": "none",
        "xp": 0,
        "badges": [],
        "sessions": []
    }
    users_collection.insert_one(user_doc)
    return jsonify({"message": "Registration successful!"}), 201

# UPDATED: The /login route now only handles the POST request.
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    remember = data.get('remember', True)

    user_data = users_collection.find_one({'email': email})
    if user_data and bcrypt.check_password_hash(user_data['password_hash'], password):
        user_obj = User(user_data)
        login_user(user_obj, remember=remember)
        return jsonify({"message": "Login successful!"}), 200
    else:
        return jsonify({"error": "Invalid email or password."}), 401

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'success')
    # UPDATED: Redirect to the new auth page after logout
    return redirect(url_for('auth_page'))

# UPDATED: The root route now directs unauthenticated users to the new auth page
@app.route('/')
def root():
    if not current_user.is_authenticated:
        return redirect(url_for('auth_page'))
    # Authenticated users are sent to the main app (index.html)
    return render_template('index.html')

# --- All other routes below this line remain the same ---

@app.route('/get_user_profile')
@login_required
def get_user_profile():
    return jsonify({
        "username": current_user.username,
        "xp": current_user.xp,
        "badges": current_user.badges,
        "subscription_status": current_user.subscription_status,
    })

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    user_message = data.get('message')
    persona = data.get('persona', 'friendly')
    session_id = data.get('session_id')

    if not all([user_message, session_id]):
        return jsonify({'error': 'Missing message or session_id.'}), 400

    ei_response = call_huggingface_llm(user_message, persona=persona)
    
    chat_log = {
        "user_id": ObjectId(current_user.id),
        "session_id": session_id,
        "user_message": user_message,
        "ei_response": ei_response,
        "persona": persona,
        "timestamp": datetime.now(timezone.utc)
    }
    insert_result = conversations_collection.insert_one(chat_log)
    
    return jsonify({
        'reply': ei_response,
        'user_message_id': str(insert_result.inserted_id)
    })

@app.route('/get_sessions', methods=['GET'])
@login_required
def get_sessions():
    pipeline = [
        {"$match": {"user_id": ObjectId(current_user.id)}},
        {"$sort": {"timestamp": ASCENDING}},
        {"$group": {
            "_id": "$session_id",
            "first_timestamp": {"$first": "$timestamp"},
            "first_user_message": {"$first": "$user_message"}
        }},
        {"$sort": {"first_timestamp": DESCENDING}},
        {"$limit": 50}
    ]
    sessions_cursor = conversations_collection.aggregate(pipeline)
    sessions_to_send = [
        {
            "session_id": doc["_id"],
            "first_timestamp": doc["first_timestamp"].isoformat(),
            "first_user_message_preview": (doc.get("first_user_message")[:30] + '...') if doc.get("first_user_message") and len(doc.get("first_user_message")) > 30 else doc.get("first_user_message")
        } for doc in sessions_cursor
    ]
    return jsonify(sessions_to_send)

@app.route('/get_history', methods=['GET'])
@login_required
def get_history():
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"error": "session_id parameter is required"}), 400

    history_cursor = conversations_collection.find(
        {"user_id": ObjectId(current_user.id), "session_id": session_id}
    ).sort("timestamp", ASCENDING).limit(100)

    chat_history_to_send = [
        {
            "message_id": str(log.get("_id")),
            "user_message": log.get("user_message"),
            "ei_response": log.get("ei_response"),
            "persona": log.get("persona"),
            "timestamp": log.get("timestamp").isoformat()
        } for log in history_cursor
    ]
    return jsonify(chat_history_to_send)

@app.route('/delete_session/<session_id>', methods=['DELETE'])
@login_required
def delete_session(session_id):
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400
    try:
        delete_result = conversations_collection.delete_many({
            "session_id": session_id,
            "user_id": ObjectId(current_user.id)
        })
        if delete_result.deleted_count > 0:
            print(f"User {current_user.id} deleted {delete_result.deleted_count} messages from session {session_id}.")
            return jsonify({"message": "Session successfully deleted", "deleted_count": delete_result.deleted_count}), 200
        else:
            return jsonify({"error": "Session not found or you do not have permission to delete it"}), 404
    except Exception as e:
        print(f"Error deleting session {session_id}: {e}")
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@app.route('/edit_message/<message_id>', methods=['PUT'])
@login_required
def edit_message(message_id):
    data = request.get_json()
    new_message_text = data.get('new_message')

    if not new_message_text:
        return jsonify({"error": "No new message provided"}), 400
    try:
        update_result = conversations_collection.update_one(
            {"_id": ObjectId(message_id), "user_id": ObjectId(current_user.id)},
            {"$set": {"user_message": new_message_text}}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Message not found or permission denied"}), 404
        
        updated_log = conversations_collection.find_one({"_id": ObjectId(message_id)})
        ei_response = updated_log.get("ei_response")

        return jsonify({
            "message": "Message updated successfully",
            "original_ei_response": ei_response
        }), 200
    except Exception as e:
        print(f"Error editing message {message_id}: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


@app.route('/update_gamification', methods=['POST'])
@login_required
def update_gamification():
    data = request.get_json()
    xp = data.get('xp')
    badges = data.get('badges')
    
    update_fields = {}
    if xp is not None and isinstance(xp, int):
        update_fields['$set'] = {'xp': xp}
    if badges is not None and isinstance(badges, list):
        update_fields['$addToSet'] = {'badges': {'$each': badges}}
        
    if not update_fields:
        return jsonify({"error": "No valid data to update."}), 400

    users_collection.update_one({'_id': ObjectId(current_user.id)}, update_fields)
    return jsonify({"message": "Gamification data updated successfully."}), 200


@app.route('/subscription')
@login_required
def subscription_page():
    return render_template('subscription.html')

@app.route('/get_subscription_details')
@login_required
def get_subscription_details():
    base_price = 49900 # Base price in paise (e.g., ₹499.00)
    discount_percent = calculate_discount(current_user)
    discount_amount = int(base_price * (discount_percent / 100))
    final_price = base_price - discount_amount

    return jsonify({
        "base_price_inr": base_price / 100,
        "discount_percent": discount_percent,
        "final_price_inr": final_price / 100,
        "final_price_paise": final_price
    })

@app.route('/create_order', methods=['POST'])
@login_required
def create_order():
    try:
        details = get_subscription_details().get_json()
        amount = details['final_price_paise']
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"{current_user.id}_{int(datetime.now().timestamp())}",
            "notes": { "user_id": current_user.id, "email": current_user.email }
        }
        order = razorpay_client.order.create(data=order_data)
        return jsonify({
            "order_id": order['id'],
            "amount": order['amount'],
            "currency": order['currency'],
            "key_id": os.getenv("RAZORPAY_KEY_ID"),
            "user_email": current_user.email,
            "user_username": current_user.username,
        })
    except Exception as e:
        print(f"Error creating Razorpay order: {e}")
        return jsonify({"error": "Could not create payment order."}), 500

@app.route('/payment_webhook', methods=['POST'])
def payment_webhook():
    webhook_body = request.get_data()
    webhook_signature = request.headers.get('x-razorpay-signature')
    webhook_secret = os.getenv('RAZORPAY_WEBHOOK_SECRET')

    if not webhook_secret:
        print("CRITICAL ERROR: Razorpay webhook secret is not configured in .env file.")
        return jsonify({'status': 'error', 'message': 'Internal server error'}), 500
    try:
        razorpay_client.utility.verify_webhook_signature(
            webhook_body.decode('utf-8'), webhook_signature, webhook_secret
        )
        event_data = request.get_json()
        if event_data['event'] == 'order.paid':
            payment_info = event_data['payload']['payment']['entity']
            user_id = payment_info['notes']['user_id']
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'subscription_status': 'active'}}
            )
            print(f"WEBHOOK SUCCESS: Subscription activated for user_id: {user_id}")
        return jsonify({'status': 'ok'}), 200
    except razorpay.errors.SignatureVerificationError as e:
        print(f"SECURITY ALERT: Invalid webhook signature received. {e}")
        return jsonify({'status': 'error', 'message': 'Invalid signature'}), 400
    except Exception as e:
        print(f"Error in webhook processing: {e}")
        return jsonify({'status': 'error', 'message': 'An error occurred'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)