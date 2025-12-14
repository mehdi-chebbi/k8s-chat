from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import re
import sys
from datetime import datetime
import uuid

from k8s_client import K8sClient
from llm_client import LLMClientFactory
from question_classifier import HybridQuestionClassifier, QuestionType
from database import Database
from functools import wraps

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def require_admin_auth(f):
    """Decorator to require admin authentication and role verification"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get session ID from HttpOnly cookie
            session_id = request.cookies.get('session_id')
            
            if not session_id:
                return jsonify({'error': 'Session ID required for admin access'}), 401
            
            # Validate session and get user
            session = app.db.get_session(session_id)
            if not session:
                return jsonify({'error': 'Invalid or expired session'}), 401
            
            # Get user details
            user = app.db.get_user_by_id(session['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            # Check if user is admin and not banned
            if user['role'] != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            if user['is_banned']:
                return jsonify({'error': 'Account is banned'}), 403
            
            # Update session activity
            app.db.update_session_activity(session_id)
            
            # Store user info in request context for use in the endpoint
            request.current_user = user
            request.current_session = session
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 500
    
    return decorated_function

def require_user_auth(f):
    """Decorator to require user authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get session ID from HttpOnly cookie
            session_id = request.cookies.get('session_id')
            
            if not session_id:
                return jsonify({'error': 'Session ID required'}), 401
            
            # Validate session and get user
            session = app.db.get_session(session_id)
            if not session:
                return jsonify({'error': 'Invalid or expired session'}), 401
            
            # Get user details
            user = app.db.get_user_by_id(session['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            # Check if user is not banned
            if user['is_banned']:
                return jsonify({'error': 'Account is banned'}), 403
            
            # Update session activity
            app.db.update_session_activity(session_id)
            
            # Store user info in request context for use in the endpoint
            request.current_user = user
            request.current_session = session
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 500
    
    return decorated_function

def determine_role_from_system_pods(node_name, k8s_client):
    """
    PRECISE: Determine node role by checking what system pods run on it
    Only use this as LAST RESORT when no labels/taints are available
    """
    try:
        # Get pods in kube-system namespace
        pods_result = k8s_client._run_kubectl_command([
            'get', 'pods', '-n', 'kube-system', '-o', 'json'
        ])
        
        if not pods_result['success']:
            return 'worker'
        
        import json
        pods_data = json.loads(pods_result['stdout'])
        pods = pods_data.get('items', [])
        
        # Count control-plane components on THIS SPECIFIC NODE
        control_plane_components_on_node = 0
        
        for pod in pods:
            pod_node = pod.get('spec', {}).get('nodeName')
            if pod_node != node_name:
                continue  # Skip pods not on this node
                
            pod_name = pod.get('metadata', {}).get('name', '').lower()
            
            # CRITICAL: Only count core control-plane components
            critical_components = [
                'kube-apiserver',
                'kube-controller-manager', 
                'kube-scheduler',
                'etcd'
            ]
            
            for component in critical_components:
                if component in pod_name:
                    control_plane_components_on_node += 1
                    break
        
        # THRESHOLD: Need at least 2 critical components to be control-plane
        if control_plane_components_on_node >= 2:
            return 'master'
        
        return 'worker'
        
    except Exception as e:
        logger.warning(f"Failed to determine role from system pods for {node_name}: {e}")
        return 'worker'

def create_app():
    """Create and configure Flask application with proper error handling"""
    app = Flask(__name__)
    CORS(app, supports_credentials=True, origins=['http://localhost:3000'])  # Enable CORS with credentials support
    
    # Initialize components with error handling
    k8s_client = None
    hybrid_classifier = None
    db = None
    
    # Initialize K8s client
    try:
        k8s_client = K8sClient()
        logger.info("K8s client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize K8s client: {e}")
        # Continue without K8s - will be handled in endpoints
    
    # Initialize question classifier
    try:
        hybrid_classifier = HybridQuestionClassifier()
        logger.info("Question classifier initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize question classifier: {e}")
        sys.exit(1)  # This is critical - exit if we can't initialize
    
    # Initialize database with proper error handling
    try:
        db = Database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.error("This is a critical component - application cannot start without database")
        sys.exit(1)  # Exit if we can't connect to database
    
    # Store components in app context
    app.k8s_client = k8s_client
    app.hybrid_classifier = hybrid_classifier
    app.db = db
    
    # Store in-memory conversation history (will be synced with DB)
    app.conversation_history = {}
    
    # Add health check caching
    app.health_cache = {
        'last_check': None,
        'result': None,
        'cache_duration': 30  # Cache health results for 30 seconds
    }
    
    return app

# Create application instance
app = create_app()

@app.route('/health', methods=['GET'])
def health_check():
    """Enhanced health check endpoint with comprehensive status and caching"""
    import time
    
    # Check if we have a cached result that's still valid
    current_time = time.time()
    if (app.health_cache['last_check'] and 
        app.health_cache['result'] and 
        current_time - app.health_cache['last_check'] < app.health_cache['cache_duration']):
        
        # Return cached result with updated timestamp
        cached_result = app.health_cache['result'].copy()
        cached_result['timestamp'] = datetime.now().isoformat()
        cached_result['cached'] = True
        return jsonify(cached_result), 200
    
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'k8s-audit-bot',
        'version': 'v0.1',
        'cached': False
    }
    
    # Check database health
    try:
        if app.db:
            db_health = app.db.health_check()
            health_status['database'] = db_health
            if db_health['status'] != 'healthy':
                health_status['status'] = 'degraded'
        else:
            health_status['database'] = {'status': 'not_initialized'}
            health_status['status'] = 'unhealthy'
    except Exception as e:
        health_status['database'] = {'status': 'error', 'error': str(e)}
        health_status['status'] = 'unhealthy'
    
    # Check K8s client health (with optimization)
    try:
        if app.k8s_client:
            # Check if there's an active kubeconfig in database
            active_kubeconfig = app.db.get_active_kubeconfig()
            
            if active_kubeconfig:
                # Use the existing app.k8s_client if it has the same config path
                # or create a new one only if necessary
                k8s_client_to_use = app.k8s_client
                if hasattr(app.k8s_client, 'kubeconfig_path') and app.k8s_client.kubeconfig_path != active_kubeconfig['path']:
                    k8s_client_to_use = K8sClient(kubeconfig_path=active_kubeconfig['path'])
                
                result = k8s_client_to_use._run_kubectl_command(['cluster-info'], timeout=5)
                
                if result['success']:
                    health_status['kubernetes'] = {
                        'status': 'connected', 
                        'kubectl_available': True,
                        'cluster_accessible': True,
                        'kubeconfig': active_kubeconfig['name'],
                        'kubeconfig_path': active_kubeconfig['path']
                    }
                else:
                    health_status['kubernetes'] = {
                        'status': 'cluster_error', 
                        'kubectl_available': True,
                        'cluster_accessible': False,
                        'error': result.get('error', 'Unknown error'),
                        'kubeconfig': active_kubeconfig['name'],
                        'kubeconfig_path': active_kubeconfig['path']
                    }
            else:
                # No active kubeconfig in database
                health_status['kubernetes'] = {
                    'status': 'no_active_kubeconfig', 
                    'kubectl_available': True,
                    'cluster_accessible': False,
                    'error': 'No active kubeconfig configured. Please add and activate a kubeconfig first.',
                    'kubeconfig': 'none',
                    'kubeconfig_path': 'none'
                }
        else:
            health_status['kubernetes'] = {'status': 'not_initialized'}
    except Exception as e:
        health_status['kubernetes'] = {'status': 'error', 'error': str(e)}
    
    # Check classifier health
    try:
        if app.hybrid_classifier:
            health_status['classifier'] = {'status': 'healthy'}
        else:
            health_status['classifier'] = {'status': 'not_initialized'}
            health_status['status'] = 'unhealthy'
    except Exception as e:
        health_status['classifier'] = {'status': 'error', 'error': str(e)}
        health_status['status'] = 'unhealthy'
    
    # Cache the result
    app.health_cache['last_check'] = current_time
    app.health_cache['result'] = health_status.copy()
    
    # Determine appropriate HTTP status code
    status_code = 200 if health_status['status'] == 'healthy' else 503
    
    return jsonify(health_status), status_code

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.route('/auth/signup', methods=['POST'])
def signup():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # Basic validation
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
        
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return jsonify({'error': 'Invalid email address'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        # Create user
        user_id = app.db.create_user(username, email, password, 'user')
        
        if user_id:
            # Log successful registration
            app.db.log_activity(user_id, 'signup', success=True)
            
            return jsonify({
                'success': True,
                'message': 'Account created successfully! You can now sign in.',
                'user_id': user_id
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create account - username or email already exists'
            }), 400
        
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Registration failed. Please try again.'
        }), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Username and password are required'}), 400
        
        username = data['username']
        password = data['password']
        
        # Authenticate user
        user = app.db.authenticate_user(username, password)
        
        if not user:
            return jsonify({'error': 'Invalid credentials or user is banned'}), 401
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        app.db.create_session(user['id'], session_id, 'Login Session')
        
        # Log activity
        app.db.log_activity(user['id'], 'login', success=True)
        
        # Create response with HttpOnly cookie
        response = jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role']
            }
        })
        
        # Set secure HttpOnly cookie
        is_production = os.environ.get('FLASK_ENV') == 'production'
        response.set_cookie(
            'session_id',
            session_id,
            httponly=True,      # Prevents JavaScript access
            secure=is_production,  # Only over HTTPS in production
            samesite='Lax',     # CSRF protection
            max_age=86400,      # 24 hours
            path='/'            # Available across entire site
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    try:
        # Get session ID from cookie
        session_id = request.cookies.get('session_id')
        
        if session_id:
            # Clear in-memory conversation history
            if session_id in app.conversation_history:
                del app.conversation_history[session_id]
        
        # Create response that clears the cookie
        response = jsonify({'message': 'Logout successful'})
        response.set_cookie(
            'session_id',
            '',
            httponly=True,
            secure=os.environ.get('FLASK_ENV') == 'production',
            samesite='Lax',
            max_age=0,  # Expire immediately
            path='/'
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500

# ==================== ADMIN ENDPOINTS ====================

@app.route('/admin/users', methods=['GET'])
@require_admin_auth
def get_users():
    """Get all users (admin only)"""
    try:
        users = app.db.get_all_users()
        return jsonify({'users': users})
        
    except Exception as e:
        logger.error(f"Error getting users: {str(e)}")
        return jsonify({'error': 'Failed to get users'}), 500

@app.route('/admin/users', methods=['POST'])
@require_admin_auth
def create_user():
    """Create new user (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        username = data['username']
        email = data['email']
        password = data['password']
        role = data.get('role', 'user')
        
        user_id = app.db.create_user(username, email, password, role)
        
        if user_id:
            return jsonify({
                'message': 'User created successfully',
                'user_id': user_id
            }), 201
        else:
            return jsonify({'error': 'Failed to create user - username or email already exists'}), 400
        
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        return jsonify({'error': 'Failed to create user'}), 500

@app.route('/admin/users/<int:user_id>/ban', methods=['POST'])
@require_admin_auth
def ban_user(user_id):
    """Ban a user (admin only)"""
    try:
        success = app.db.ban_user(user_id)
        
        if success:
            return jsonify({'message': f'User {user_id} banned successfully'})
        else:
            return jsonify({'error': 'Failed to ban user'}), 500
        
    except Exception as e:
        logger.error(f"Error banning user: {str(e)}")
        return jsonify({'error': 'Failed to ban user'}), 500

@app.route('/admin/users/<int:user_id>/unban', methods=['POST'])
@require_admin_auth
def unban_user(user_id):
    """Unban a user (admin only)"""
    try:
        success = app.db.unban_user(user_id)
        
        if success:
            return jsonify({'message': f'User {user_id} unbanned successfully'})
        else:
            return jsonify({'error': 'Failed to unban user'}), 500
        
    except Exception as e:
        logger.error(f"Error unbanning user: {str(e)}")
        return jsonify({'error': 'Failed to unban user'}), 500

@app.route('/admin/users/<int:user_id>/role', methods=['PUT'])
@require_admin_auth
def update_user_role(user_id):
    """Update user role (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'role' not in data:
            return jsonify({'error': 'Role is required'}), 400
        
        new_role = data['role']
        
        if new_role not in ['admin', 'user']:
            return jsonify({'error': 'Invalid role'}), 400
        
        success = app.db.update_user_role(user_id, new_role)
        
        if success:
            return jsonify({'message': f'User {user_id} role updated to {new_role}'})
        else:
            return jsonify({'error': 'Failed to update role'}), 500
        
    except Exception as e:
        logger.error(f"Error updating user role: {str(e)}")
        return jsonify({'error': 'Failed to update role'}), 500

@app.route('/admin/users/<int:user_id>/password', methods=['PUT'])
@require_admin_auth
def change_user_password(user_id):
    """Change user password (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'new_password' not in data:
            return jsonify({'error': 'New password is required'}), 400
        
        new_password = data['new_password']
        success = app.db.change_password(user_id, new_password)
        
        if success:
            return jsonify({'message': f'Password changed for user {user_id}'})
        else:
            return jsonify({'error': 'Failed to change password'}), 500
        
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500

@app.route('/admin/logs', methods=['GET'])
@require_admin_auth
def get_activity_logs():
    """Get activity logs (admin only)"""
    try:
        user_id = request.args.get('user_id', type=int)
        limit = request.args.get('limit', default=100, type=int)
        
        logs = app.db.get_activity_logs(user_id=user_id, limit=limit)
        return jsonify({'logs': logs})
        
    except Exception as e:
        logger.error(f"Error getting logs: {str(e)}")
        return jsonify({'error': 'Failed to get logs'}), 500

# ==================== USER ENDPOINTS ====================

@app.route('/user/preferences', methods=['GET'])
@require_user_auth
def get_preferences():
    """Get user preferences"""
    try:
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        preferences = app.db.get_user_preferences(user_id)
        
        if preferences:
            return jsonify({'preferences': preferences})
        else:
            return jsonify({'error': 'Preferences not found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting preferences: {str(e)}")
        return jsonify({'error': 'Failed to get preferences'}), 500

@app.route('/user/preferences', methods=['PUT'])
@require_user_auth
def update_preferences():
    """Update user preferences"""
    try:
        data = request.get_json()
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        # Extract preference fields
        preferences = {
            key: data[key]
            for key in ['tone', 'response_style', 'personality', 'max_commands_preference', 'auto_investigate']
            if key in data
        }
        
        success = app.db.update_user_preferences(user_id, preferences)
        
        if success:
            return jsonify({'message': 'Preferences updated successfully'})
        else:
            return jsonify({'error': 'Failed to update preferences'}), 500
        
    except Exception as e:
        logger.error(f"Error updating preferences: {str(e)}")
        return jsonify({'error': 'Failed to update preferences'}), 500

@app.route('/user/sessions', methods=['GET'])
@require_user_auth
def get_user_sessions():
    """Get all chat sessions for a user"""
    try:
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        sessions = app.db.get_user_sessions(user_id)
        return jsonify({'sessions': sessions})
        
    except Exception as e:
        logger.error(f"Error getting sessions: {str(e)}")
        return jsonify({'error': 'Failed to get sessions'}), 500

@app.route('/user/history', methods=['GET'])
@require_user_auth
def get_user_history():
    """Get chat history for a user"""
    try:
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        session_id = request.args.get('session_id')
        limit = request.args.get('limit', default=50, type=int)
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        history = app.db.get_chat_history(user_id, session_id=session_id, limit=limit)
        return jsonify({'history': history})
        
    except Exception as e:
        logger.error(f"Error getting history: {str(e)}")
        return jsonify({'error': 'Failed to get history'}), 500

@app.route('/user/history', methods=['DELETE'])
@require_user_auth
def delete_user_history():
    """Delete chat history for a user"""
    try:
        data = request.get_json()
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        session_id = data.get('session_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        success = app.db.delete_chat_history(user_id, session_id=session_id)
        
        if success:
            return jsonify({'message': 'Chat history deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete history'}), 500
        
    except Exception as e:
        logger.error(f"Error deleting history: {str(e)}")
        return jsonify({'error': 'Failed to delete history'}), 500

@app.route('/user/sessions', methods=['POST'])
@require_user_auth
def create_chat_session():
    """Create a new chat session"""
    try:
        data = request.get_json()
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        title = data.get('title', 'New Chat')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        
        # Create session in database
        success = app.db.create_session(user_id, session_id, title)
        
        if success:
            return jsonify({
                'message': 'Session created successfully',
                'session_id': session_id,
                'title': title
            }), 201
        else:
            return jsonify({'error': 'Failed to create session'}), 500
        
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        return jsonify({'error': 'Failed to create session'}), 500

@app.route('/user/sessions/<session_id>', methods=['PUT'])
@require_user_auth
def update_chat_session(session_id):
    """Update chat session title"""
    try:
        data = request.get_json()
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        title = data.get('title')
        
        if not user_id or not title:
            return jsonify({'error': 'User ID and title are required'}), 400
        
        success = app.db.update_session_title(user_id, session_id, title)
        
        if success:
            return jsonify({'message': 'Session updated successfully'})
        else:
            return jsonify({'error': 'Failed to update session'}), 500
        
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        return jsonify({'error': 'Failed to update session'}), 500

@app.route('/user/sessions/<session_id>', methods=['DELETE'])
@require_user_auth
def delete_chat_session(session_id):
    """Delete a chat session"""
    try:
        data = request.get_json()
        # Get user_id from authenticated session instead of request
        user_id = request.current_user['id']
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        success = app.db.delete_session(user_id, session_id)
        
        if success:
            return jsonify({'message': 'Session deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete session'}), 500
        
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}")
        return jsonify({'error': 'Failed to delete session'}), 500

# ==================== CHAT ENDPOINT ====================

@app.route('/chat', methods=['POST'])
@require_user_auth
def chat():
    """
    Enhanced intelligent chat endpoint with hybrid classification and database integration
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        user_message = data['message']
        session_id = data.get('session_id', 'default')
        user_id = request.current_user['id']  # User ID from authenticated session
        
        logger.info(f"Received message from user {user_id}: {user_message}")
        
        # Get user preferences
        user_prefs = app.db.get_user_preferences(user_id)
        
        # Initialize conversation history for session
        if session_id not in app.conversation_history:
            # Load from database
            db_history = app.db.get_chat_history(user_id, session_id=session_id)
            app.conversation_history[session_id] = [
                {
                    'role': msg['role'],
                    'message': msg['message'],
                    'timestamp': msg['timestamp']
                }
                for msg in db_history
            ]
        
        # Add user message to history
        app.conversation_history[session_id].append({
            'role': 'user',
            'message': user_message,
            'timestamp': datetime.now().isoformat()
        })
        
        # Get active LLM configuration from database
        active_llm_config = app.db.get_active_llm_config()
        
        if not active_llm_config:
            return jsonify({
                'error': 'No active LLM configuration found. Please add and activate an LLM configuration in the settings.',
                'requires_setup': True
            }), 400
        
        # Initialize LLM provider with active configuration
        try:
            provider_config = {
                'provider': active_llm_config['provider'],
                'api_key': active_llm_config.get('api_key'),
                'endpoint_url': active_llm_config.get('endpoint_url'),
                'model': active_llm_config.get('model') or 'default'
            }
            
            llm_provider = LLMClientFactory.create_provider(provider_config)
            
        except Exception as e:
            logger.error(f"Failed to initialize LLM provider: {str(e)}")
            return jsonify({
                'error': f'Failed to initialize LLM provider: {str(e)}',
                'requires_setup': True
            }), 500
        
        # Update usage statistics for the LLM configuration
        app.db.update_api_key_usage(active_llm_config['id'])
        
        # Step 1: Classify question using hybrid approach
        logger.info("Step 1: Classifying question with hybrid approach...")
        classification = app.hybrid_classifier.classify_question(
            message=user_message,
            conversation_history=app.conversation_history[session_id],
            ai_client=llm_provider
        )
        
        logger.info(f"Classification result: {classification.question_type.value} "
                   f"(score: {classification.complexity_score:.2f}, "
                   f"confidence: {classification.confidence:.2f}, "
                   f"method: {classification.classification_method})")
        
        # Step 2: Determine command strategy based on classification
        max_commands = classification.suggested_max_commands
        follow_up_allowed = classification.follow_up_allowed
        
        # Apply user preferences if they exist
        if user_prefs and user_prefs.get('max_commands_preference'):
            max_commands = min(max_commands, user_prefs['max_commands_preference'])
        
        # Step 3: Ask model to suggest appropriate commands based on classification
        logger.info("Step 3: Requesting command suggestions from model...")
        suggested_commands = llm_provider.suggest_commands(
            user_question=user_message,
            conversation_history=app.conversation_history[session_id]
        )
        
        # Limit commands based on classification
        if suggested_commands and len(suggested_commands) > max_commands:
            logger.info(f"Limiting commands from {len(suggested_commands)} to {max_commands} based on classification")
            suggested_commands = suggested_commands[:max_commands]
        
        if not suggested_commands:
            logger.info("No commands needed - providing direct advice response")
            # Use analysis method directly without command outputs
            bot_response = llm_provider.analyze_command_outputs(
                user_question=user_message,
                command_outputs={},  # Empty command outputs
                conversation_history=app.conversation_history[session_id]
            )
            
            # Save to database
            app.db.save_chat_message(
                user_id=user_id,
                session_id=session_id,
                role='user',
                message=user_message
            )
            
            app.db.save_chat_message(
                user_id=user_id,
                session_id=session_id,
                role='assistant',
                message=bot_response,
                commands_executed=[],
                classification_info={
                    'type': classification.question_type.value,
                    'complexity_score': classification.complexity_score,
                    'confidence': classification.confidence,
                    'method': classification.classification_method
                }
            )
            
            # Log activity
            app.db.log_activity(
                user_id=user_id,
                action_type='advice_query',
                classification_type=classification.question_type.value,
                success=True
            )
            
            # Add response to history
            app.conversation_history[session_id].append({
                'role': 'assistant',
                'message': bot_response,
                'timestamp': datetime.now().isoformat(),
                'commands_executed': [],
                'classification': {
                    'type': classification.question_type.value,
                    'complexity_score': classification.complexity_score,
                    'confidence': classification.confidence,
                    'method': classification.classification_method
                },
                'analysis_type': 'advice_only'
            })
            
            return jsonify({
                'response': bot_response,
                'commands_executed': [],
                'classification': {
                    'type': classification.question_type.value,
                    'complexity_score': classification.complexity_score,
                    'confidence': classification.confidence,
                    'method': classification.classification_method,
                    'reasoning': classification.reasoning
                },
                'session_id': session_id,
                'timestamp': datetime.now().isoformat(),
                'analysis_type': 'advice_only'
            })
        
        logger.info(f"Model suggested commands: {suggested_commands}")
        
        # Step 4: Execute safe commands (no verification needed now)
        logger.info("Step 4: Executing commands...")
        
        # Get active kubeconfig and create appropriate K8sClient
        active_kubeconfig = app.db.get_active_kubeconfig()
        if active_kubeconfig:
            from k8s_client import K8sClient
            k8s_client_to_use = K8sClient(kubeconfig_path=active_kubeconfig['path'])
            logger.info(f"Using active kubeconfig: {active_kubeconfig['name']} at {active_kubeconfig['path']}")
        else:
            k8s_client_to_use = app.k8s_client  # Fallback to default client
            logger.warning("No active kubeconfig found, using default client")
        
        command_outputs = {}
        executed_commands = []
        
        for cmd in suggested_commands:
            logger.info(f"Executing command: {cmd}")
            # Execute the command (remove 'kubectl' prefix for the k8s_client)
            cmd_parts = cmd.split()[1:]  # Remove 'kubectl'
            output = k8s_client_to_use._run_kubectl_command(cmd_parts)
            command_outputs[cmd] = output
            executed_commands.append(cmd)
            
            # Log command execution
            app.db.log_activity(
                user_id=user_id,
                action_type='command_executed',
                command=cmd,
                classification_type=classification.question_type.value,
                success=output.get('success'),
                error_message=output.get('stderr') if not output.get('success') else None
            )
            
            # Log command execution result
            if output.get('success'):
                logger.info(f"Command succeeded: {cmd}")
            else:
                logger.warning(f"Command failed: {cmd} - {output.get('stderr', 'Unknown error')}")
        
        # Step 5: Generate follow-up commands if allowed and appropriate
        follow_up_commands = []
        if (follow_up_allowed and command_outputs and 
            classification.question_type in [QuestionType.MODERATE_INVESTIGATION, QuestionType.DEEP_ANALYSIS]):
            
            logger.info("Step 5: Generating follow-up commands...")
            follow_up_commands = llm_provider.suggest_follow_up_commands(
                original_question=user_message,
                discovery_outputs=command_outputs,
                conversation_history=app.conversation_history[session_id]
            )
            
            # Limit follow-up commands based on classification
            if follow_up_commands and len(follow_up_commands) > 2:  # Conservative limit for follow-ups
                follow_up_commands = follow_up_commands[:2]
            
            if follow_up_commands:
                logger.info(f"Model suggested follow-up commands: {follow_up_commands}")
                
                for cmd in follow_up_commands:
                    logger.info(f"Executing follow-up command: {cmd}")
                    cmd_parts = cmd.split()[1:]  # Remove 'kubectl'
                    output = k8s_client_to_use._run_kubectl_command(cmd_parts)
                    command_outputs[cmd] = output
                    executed_commands.append(cmd)
                    
                    # Log follow-up command
                    app.db.log_activity(
                        user_id=user_id,
                        action_type='followup_command_executed',
                        command=cmd,
                        classification_type=classification.question_type.value,
                        success=output.get('success'),
                        error_message=output.get('stderr') if not output.get('success') else None
                    )
                    
                    # Log command execution result
                    if output.get('success'):
                        logger.info(f"Follow-up command succeeded: {cmd}")
                    else:
                        logger.warning(f"Follow-up command failed: {cmd} - {output.get('stderr', 'Unknown error')}")
        
        # Step 6: Send command outputs to model for analysis
        logger.info("Step 6: Analyzing command outputs...")
        bot_response = llm_provider.analyze_command_outputs(
            user_question=user_message,
            command_outputs=command_outputs,
            conversation_history=app.conversation_history[session_id]
        )
        
        # Save to database
        app.db.save_chat_message(
            user_id=user_id,
            session_id=session_id,
            role='user',
            message=user_message
        )
        
        app.db.save_chat_message(
            user_id=user_id,
            session_id=session_id,
            role='assistant',
            message=bot_response,
            commands_executed=executed_commands,
            classification_info={
                'type': classification.question_type.value,
                'complexity_score': classification.complexity_score,
                'confidence': classification.confidence,
                'method': classification.classification_method
            }
        )
        
        # Add bot response to history
        app.conversation_history[session_id].append({
            'role': 'assistant',
            'message': bot_response,
            'timestamp': datetime.now().isoformat(),
            'commands_executed': executed_commands,
            'classification': {
                'type': classification.question_type.value,
                'complexity_score': classification.complexity_score,
                'confidence': classification.confidence,
                'method': classification.classification_method,
                'reasoning': classification.reasoning
            },
            'analysis_type': 'command_based'
        })
        
        return jsonify({
            'response': bot_response,
            'commands_executed': executed_commands,
            'classification': {
                'type': classification.question_type.value,
                'complexity_score': classification.complexity_score,
                'confidence': classification.confidence,
                'method': classification.classification_method,
                'reasoning': classification.reasoning,
                'strategy': classification.strategy_type.value,
                'max_commands_suggested': classification.suggested_max_commands,
                'follow_up_allowed': classification.follow_up_allowed
            },
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'analysis_type': 'command_based'
        })
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'Failed to process your request. Please try again.'
        }), 500

# ==================== KUBECONFIG ENDPOINTS ====================

@app.route('/admin/kubeconfigs', methods=['GET'])
@require_admin_auth
def get_kubeconfigs():
    """Get all kubeconfigurations (admin only)"""
    try:
        kubeconfigs = app.db.get_all_kubeconfigs()
        return jsonify({'kubeconfigs': kubeconfigs})
        
    except Exception as e:
        logger.error(f"Error getting kubeconfigs: {str(e)}")
        return jsonify({'error': 'Failed to get kubeconfigs'}), 500

@app.route('/admin/kubeconfigs', methods=['POST'])
@require_admin_auth
def create_kubeconfig():
    """Create new kubeconfig (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data or 'path' not in data:
            return jsonify({'error': 'Name and path are required'}), 400
        
        name = data['name'].strip()
        path = data['path'].strip()
        description = data.get('description', '').strip()
        is_default = data.get('is_default', False)
        created_by = data.get('created_by')  # Optional user ID
        
        if not name or not path:
            return jsonify({'error': 'Name and path cannot be empty'}), 400
        
        kubeconfig_id = app.db.create_kubeconfig(
            name=name,
            path=path,
            description=description,
            created_by=created_by,
            is_default=is_default
        )
        
        if kubeconfig_id:
            # Clear health cache as new kubeconfig might affect cluster connectivity
            app.health_cache['last_check'] = None
            app.health_cache['result'] = None
            
            return jsonify({
                'message': 'Kubeconfig created successfully',
                'kubeconfig_id': kubeconfig_id
            }), 201
        else:
            return jsonify({'error': 'Failed to create kubeconfig - name may already exist'}), 400
        
    except Exception as e:
        logger.error(f"Error creating kubeconfig: {str(e)}")
        return jsonify({'error': 'Failed to create kubeconfig'}), 500

@app.route('/admin/kubeconfigs/<int:kubeconfig_id>', methods=['GET'])
@require_admin_auth
def get_kubeconfig(kubeconfig_id):
    """Get a specific kubeconfig (admin only)"""
    try:
        kubeconfig = app.db.get_kubeconfig(kubeconfig_id)
        
        if kubeconfig:
            return jsonify({'kubeconfig': kubeconfig})
        else:
            return jsonify({'error': 'Kubeconfig not found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting kubeconfig {kubeconfig_id}: {str(e)}")
        return jsonify({'error': 'Failed to get kubeconfig'}), 500

@app.route('/admin/kubeconfigs/<int:kubeconfig_id>', methods=['PUT'])
@require_admin_auth
def update_kubeconfig(kubeconfig_id):
    """Update a kubeconfig (admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name')
        path = data.get('path')
        description = data.get('description')
        is_default = data.get('is_default')
        
        success = app.db.update_kubeconfig(
            kubeconfig_id=kubeconfig_id,
            name=name,
            path=path,
            description=description,
            is_default=is_default
        )
        
        if success:
            # Clear health cache as kubeconfig changes might affect cluster connectivity
            app.health_cache['last_check'] = None
            app.health_cache['result'] = None
            
            return jsonify({'message': f'Kubeconfig {kubeconfig_id} updated successfully'})
        else:
            return jsonify({'error': 'Failed to update kubeconfig or no changes made'}), 400
        
    except Exception as e:
        logger.error(f"Error updating kubeconfig {kubeconfig_id}: {str(e)}")
        return jsonify({'error': 'Failed to update kubeconfig'}), 500

@app.route('/admin/kubeconfigs/<int:kubeconfig_id>', methods=['DELETE'])
@require_admin_auth
def delete_kubeconfig(kubeconfig_id):
    """Delete a kubeconfig (admin only)"""
    try:
        success = app.db.delete_kubeconfig(kubeconfig_id)
        
        if success:
            # Clear health cache as deleting kubeconfig might affect cluster connectivity
            app.health_cache['last_check'] = None
            app.health_cache['result'] = None
            
            return jsonify({'message': f'Kubeconfig {kubeconfig_id} deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete kubeconfig'}), 500
        
    except Exception as e:
        logger.error(f"Error deleting kubeconfig {kubeconfig_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete kubeconfig'}), 500

@app.route('/admin/kubeconfigs/<int:kubeconfig_id>/activate', methods=['POST'])
@require_admin_auth
def activate_kubeconfig(kubeconfig_id):
    """Set a kubeconfig as active (admin only)"""
    try:
        success = app.db.set_active_kubeconfig(kubeconfig_id)
        
        if success:
            # Clear health cache to force refresh with new kubeconfig
            app.health_cache['last_check'] = None
            app.health_cache['result'] = None
            
            return jsonify({'message': f'Kubeconfig {kubeconfig_id} activated successfully'})
        else:
            return jsonify({'error': 'Failed to activate kubeconfig'}), 500
        
    except Exception as e:
        logger.error(f"Error activating kubeconfig {kubeconfig_id}: {str(e)}")
        return jsonify({'error': 'Failed to activate kubeconfig'}), 500

@app.route('/admin/kubeconfigs/<int:kubeconfig_id>/test', methods=['POST'])
@require_admin_auth
def test_kubeconfig(kubeconfig_id):
    """Test a kubeconfig connection (admin only)"""
    try:
        # Get kubeconfig details
        kubeconfig = app.db.get_kubeconfig(kubeconfig_id)
        if not kubeconfig:
            return jsonify({'error': 'Kubeconfig not found'}), 404
        
        # Test the kubeconfig using K8sClient
        try:
            from k8s_client import K8sClient
            k8s_client = K8sClient(kubeconfig_path=kubeconfig['path'])
            
            # Try a simple kubectl command to test connectivity
            result = k8s_client._run_kubectl_command(['cluster-info'], timeout=10)
            
            if result['success']:
                # Update test result in database
                app.db.update_kubeconfig_test_result(
                    kubeconfig_id, 
                    'success', 
                    'Connection successful - cluster info retrieved'
                )
                
                return jsonify({
                    'success': True,
                    'message': 'Kubeconfig test successful',
                    'details': {
                        'cluster_accessible': True,
                        'kubectl_available': True,
                        'output': result['stdout'][:500] + '...' if len(result['stdout']) > 500 else result['stdout']
                    }
                })
            else:
                # Update test result in database
                app.db.update_kubeconfig_test_result(
                    kubeconfig_id, 
                    'failed', 
                    result.get('error', 'Unknown error')
                )
                
                return jsonify({
                    'success': False,
                    'message': 'Kubeconfig test failed',
                    'error': result.get('error', 'Unknown error'),
                    'details': {
                        'cluster_accessible': result.get('cluster_accessible', False),
                        'kubectl_available': result.get('kubectl_available', True),
                        'stderr': result.get('stderr', '')[:500] + '...' if len(result.get('stderr', '')) > 500 else result.get('stderr', '')
                    }
                })
                
        except Exception as test_error:
            # Update test result in database
            app.db.update_kubeconfig_test_result(
                kubeconfig_id, 
                'error', 
                str(test_error)
            )
            
            return jsonify({
                'success': False,
                'message': 'Kubeconfig test failed with exception',
                'error': str(test_error)
            })
        
    except Exception as e:
        logger.error(f"Error testing kubeconfig {kubeconfig_id}: {str(e)}")
        return jsonify({'error': 'Failed to test kubeconfig'}), 500

@app.route('/admin/kubeconfigs/active', methods=['GET'])
@require_admin_auth
def get_active_kubeconfig():
    """Get currently active kubeconfig (admin only)"""
    try:
        kubeconfig = app.db.get_active_kubeconfig()
        
        if kubeconfig:
            return jsonify({'kubeconfig': kubeconfig})
        else:
            return jsonify({'kubeconfig': None, 'message': 'No active kubeconfig found'})
        
    except Exception as e:
        logger.error(f"Error getting active kubeconfig: {str(e)}")
        return jsonify({'error': 'Failed to get active kubeconfig'}), 500

# ==================== API KEYS ENDPOINTS ====================

@app.route('/admin/api-keys', methods=['GET'])
@require_admin_auth
def get_api_keys():
    """Get all API keys (admin only)"""
    try:
        api_keys = app.db.get_all_api_keys()
        return jsonify({'api_keys': api_keys})
        
    except Exception as e:
        logger.error(f"Error getting API keys: {str(e)}")
        return jsonify({'error': 'Failed to get API keys'}), 500

@app.route('/admin/api-keys', methods=['POST'])
@require_admin_auth
def create_api_key():
    """Create new API key (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data or 'api_key' not in data:
            return jsonify({'error': 'Name and API key are required'}), 400
        
        name = data['name']
        api_key = data['api_key']
        provider = data.get('provider', 'openrouter')
        description = data.get('description', '')
        created_by = data.get('created_by')
        
        api_key_id = app.db.create_api_key(name, api_key, provider, description, created_by)
        
        if api_key_id:
            return jsonify({
                'message': 'API key created successfully',
                'api_key_id': api_key_id
            }), 201
        else:
            return jsonify({'error': 'Failed to create API key - name may already exist'}), 400
        
    except Exception as e:
        logger.error(f"Error creating API key: {str(e)}")
        return jsonify({'error': 'Failed to create API key'}), 500

@app.route('/admin/api-keys/<int:api_key_id>', methods=['GET'])
@require_admin_auth
def get_api_key(api_key_id):
    """Get specific API key (admin only)"""
    try:
        api_key = app.db.get_api_key(api_key_id)
        
        if api_key:
            return jsonify({'api_key': api_key})
        else:
            return jsonify({'error': 'API key not found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting API key {api_key_id}: {str(e)}")
        return jsonify({'error': 'Failed to get API key'}), 500

@app.route('/admin/api-keys/<int:api_key_id>', methods=['PUT'])
@require_admin_auth
def update_api_key(api_key_id):
    """Update API key (admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name')
        api_key_value = data.get('api_key')
        provider = data.get('provider')
        description = data.get('description')
        is_active = data.get('is_active')
        
        success = app.db.update_api_key(api_key_id, name, api_key_value, provider, description, is_active)
        
        if success:
            return jsonify({'message': f'API key {api_key_id} updated successfully'})
        else:
            return jsonify({'error': 'Failed to update API key'}), 500
        
    except Exception as e:
        logger.error(f"Error updating API key {api_key_id}: {str(e)}")
        return jsonify({'error': 'Failed to update API key'}), 500

@app.route('/admin/api-keys/<int:api_key_id>', methods=['DELETE'])
@require_admin_auth
def delete_api_key(api_key_id):
    """Delete API key (admin only)"""
    try:
        success = app.db.delete_api_key(api_key_id)
        
        if success:
            return jsonify({'message': f'API key {api_key_id} deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete API key'}), 500
        
    except Exception as e:
        logger.error(f"Error deleting API key {api_key_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete API key'}), 500

@app.route('/admin/api-keys/<int:api_key_id>/activate', methods=['POST'])
@require_admin_auth
def activate_api_key(api_key_id):
    """Activate API key (admin only)"""
    try:
        success = app.db.set_active_api_key(api_key_id)
        
        if success:
            return jsonify({'message': f'API key {api_key_id} activated successfully'})
        else:
            return jsonify({'error': 'Failed to activate API key'}), 500
        
    except Exception as e:
        logger.error(f"Error activating API key {api_key_id}: {str(e)}")
        return jsonify({'error': 'Failed to activate API key'}), 500

@app.route('/admin/api-keys/active', methods=['GET'])
@require_admin_auth
def get_active_api_key():
    """Get currently active API key (admin only)"""
    try:
        provider = request.args.get('provider', 'openrouter')
        api_key = app.db.get_active_api_key(provider)
        
        if api_key:
            # Don't expose the actual API key in the response, just metadata
            safe_api_key = {
                'id': api_key['id'],
                'name': api_key['name'],
                'provider': api_key['provider'],
                'description': api_key['description'],
                'is_active': api_key['is_active'],
                'created_at': api_key['created_at'],
                'updated_at': api_key['updated_at'],
                'created_by_username': api_key.get('created_by_username'),
                'last_used': api_key['last_used'],
                'usage_count': api_key['usage_count']
            }
            return jsonify({'api_key': safe_api_key})
        else:
            return jsonify({'api_key': None, 'message': f'No active API key found for provider: {provider}'})
        
    except Exception as e:
        logger.error(f"Error getting active API key: {str(e)}")
        return jsonify({'error': 'Failed to get active API key'}), 500

# ==================== LLM CONFIGURATION ENDPOINTS ====================

@app.route('/admin/llm/providers', methods=['GET'])
@require_admin_auth
def get_supported_llm_providers():
    """Get list of supported LLM providers (admin only)"""
    try:
        providers = LLMClientFactory.get_supported_providers()
        return jsonify({'providers': providers})
    except Exception as e:
        logger.error(f"Error getting supported LLM providers: {str(e)}")
        return jsonify({'error': 'Failed to get supported LLM providers'}), 500

@app.route('/admin/llm/configs', methods=['GET'])
@require_admin_auth
def get_llm_configs():
    """Get all LLM configurations (admin only)"""
    try:
        configs = app.db.get_all_llm_configs()
        return jsonify({'configs': configs})
    except Exception as e:
        logger.error(f"Error getting LLM configs: {str(e)}")
        return jsonify({'error': 'Failed to get LLM configurations'}), 500

@app.route('/admin/llm/configs', methods=['POST'])
@require_admin_auth
def create_llm_config():
    """Create a new LLM configuration (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data or 'provider' not in data:
            return jsonify({'error': 'Name and provider are required'}), 400
        
        # Validate provider-specific requirements
        provider = data['provider']
        if provider == 'openrouter' and not data.get('api_key'):
            return jsonify({'error': 'API key is required for OpenRouter provider'}), 400
        
        if provider == 'local' and not data.get('endpoint_url'):
            return jsonify({'error': 'Endpoint URL is required for Local LLM provider'}), 400
        
        config_id = app.db.create_llm_config(
            name=data['name'],
            provider=data['provider'],
            api_key=data.get('api_key'),
            endpoint_url=data.get('endpoint_url'),
            model=data.get('model'),
            description=data.get('description'),
            created_by=request.current_user['id']
        )
        
        if config_id:
            return jsonify({
                'success': True,
                'message': 'LLM configuration created successfully',
                'config_id': config_id
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create LLM configuration'
            }), 400
        
    except Exception as e:
        logger.error(f"Error creating LLM config: {str(e)}")
        return jsonify({'error': 'Failed to create LLM configuration'}), 500

@app.route('/admin/llm/configs/<int:config_id>', methods=['PUT'])
@require_admin_auth
def update_llm_config(config_id):
    """Update an LLM configuration (admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Name is required'}), 400
        
        # Validate provider-specific requirements
        config_data = {
            'name': data['name'],
            'description': data.get('description')
        }
        
        # Get existing config to check provider
        existing_config = app.db.get_all_llm_configs()
        current_config = next((c for c in existing_config if c['id'] == config_id), None)
        
        if current_config:
            provider = current_config['provider']
            
            if provider == 'openrouter' and data.get('api_key'):
                config_data['api_key'] = data['api_key']
            elif provider == 'local' and data.get('endpoint_url'):
                config_data['endpoint_url'] = data['endpoint_url']
            
            if data.get('model'):
                config_data['model'] = data['model']
        
        success = app.db.update_api_key(config_id, config_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'LLM configuration updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update LLM configuration'
            }), 400
        
    except Exception as e:
        logger.error(f"Error updating LLM config {config_id}: {str(e)}")
        return jsonify({'error': 'Failed to update LLM configuration'}), 500

@app.route('/admin/llm/configs/<int:config_id>', methods=['DELETE'])
@require_admin_auth
def delete_llm_config(config_id):
    """Delete an LLM configuration (admin only)"""
    try:
        success = app.db.delete_llm_config(config_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'LLM configuration deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete LLM configuration'
            }), 400
        
    except Exception as e:
        logger.error(f"Error deleting LLM config {config_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete LLM configuration'}), 500

@app.route('/admin/llm/configs/<int:config_id>/activate', methods=['POST'])
@require_admin_auth
def activate_llm_config(config_id):
    """Activate an LLM configuration (admin only)"""
    try:
        success = app.db.set_active_llm_config(config_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'LLM configuration activated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to activate LLM configuration'
            }), 400
        
    except Exception as e:
        logger.error(f"Error activating LLM config {config_id}: {str(e)}")
        return jsonify({'error': 'Failed to activate LLM configuration'}), 500

@app.route('/admin/llm/configs/<int:config_id>/test', methods=['POST'])
@require_admin_auth
def test_llm_config(config_id):
    """Test an LLM configuration (admin only)"""
    try:
        # Get the configuration
        configs = app.db.get_all_llm_configs()
        config = next((c for c in configs if c['id'] == config_id), None)
        
        if not config:
            return jsonify({'error': 'LLM configuration not found'}), 404
        
        # Create provider instance
        try:
            provider_config = {
                'provider': config['provider'],
                'api_key': config.get('api_key'),
                'endpoint_url': config.get('endpoint_url'),
                'model': config.get('model') or 'default'
            }
            
            llm_provider = LLMClientFactory.create_provider(provider_config)
            
            # Test connection
            test_result = llm_provider.test_connection()
            
            # Update test results in database
            app.db.test_llm_config(config_id, test_result)
            
            return jsonify({
                'success': test_result['success'],
                'message': test_result['message'],
                'test_result': test_result
            })
            
        except Exception as e:
            # Update test results with failure
            error_result = {
                'success': False,
                'message': f'Provider initialization failed: {str(e)}'
            }
            app.db.test_llm_config(config_id, error_result)
            
            return jsonify({
                'success': False,
                'message': f'Test failed: {str(e)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Error testing LLM config {config_id}: {str(e)}")
        return jsonify({'error': 'Failed to test LLM configuration'}), 500

@app.route('/admin/llm/configs/active', methods=['GET'])
@require_admin_auth
def get_active_llm_config():
    """Get currently active LLM configuration (admin only)"""
    try:
        config = app.db.get_active_llm_config()
        
        if config:
            # Don't expose sensitive information in the response
            safe_config = {
                'id': config['id'],
                'name': config['name'],
                'provider': config['provider'],
                'description': config['description'],
                'model': config['model'],
                'endpoint_url': config.get('endpoint_url'),
                'is_active': config['is_active'],
                'created_at': config['created_at'],
                'updated_at': config['updated_at'],
                'created_by_username': config.get('created_by_username'),
                'last_used': config['last_used'],
                'usage_count': config['usage_count'],
                'test_status': config.get('test_status'),
                'test_message': config.get('test_message'),
                'last_tested': config.get('last_tested')
            }
            return jsonify({'config': safe_config})
        else:
            return jsonify({'config': None, 'message': 'No active LLM configuration found'})
        
    except Exception as e:
        logger.error(f"Error getting active LLM config: {str(e)}")
        return jsonify({'error': 'Failed to get active LLM configuration'}), 500

# ==================== TOPOLOGY ENDPOINTS ====================

@app.route('/topology/nodes', methods=['GET'])
@require_user_auth
def get_topology_nodes():
    """Get node topology data for 3D visualization"""
    try:
        # Check if there's an active kubeconfig in database
        active_kubeconfig = app.db.get_active_kubeconfig()
        
        if not active_kubeconfig:
            return jsonify({
                'error': 'No active kubeconfig configured. Please add and activate a kubeconfig first.',
                'nodes': []
            }), 400
        
        # Initialize K8s client with active kubeconfig
        k8s_client = K8sClient(kubeconfig_path=active_kubeconfig['path'])
        
        # Get nodes data
        nodes_result = k8s_client.get_nodes()
        
        if not nodes_result['success']:
            return jsonify({
                'error': f'Failed to get nodes: {nodes_result.get("error", "Unknown error")}',
                'nodes': []
            }), 500
        
        # Parse node data and format for topology
        nodes_data = []
        
        if nodes_result.get('stdout'):
            import json
            try:
                nodes_json = json.loads(nodes_result['stdout'])
                items = nodes_json.get('items', [])
                
                for i, item in enumerate(items):
                    metadata = item.get('metadata', {})
                    spec = item.get('spec', {})
                    status = item.get('status', {})
                    
                    # Extract node information
                    node_info = {
                        'id': metadata.get('name', f'node-{i}'),
                        'name': metadata.get('name', f'node-{i}'),
                        'labels': metadata.get('labels', {}),
                        'creationTimestamp': metadata.get('creationTimestamp'),
                        'uid': metadata.get('uid'),
                        
                        # Node specifications
                        'podCIDR': spec.get('podCIDR'),
                        'providerID': spec.get('providerID'),
                        'unschedulable': spec.get('unschedulable', False),
                        
                        # Node status
                        'conditions': status.get('conditions', []),
                        'nodeInfo': status.get('nodeInfo', {}),
                        'addresses': status.get('addresses', []),
                        'allocatable': status.get('allocatable', {}),
                        'capacity': status.get('capacity', {}),
                        'images': status.get('images', [])
                    }
                    
                    # PROFESSIONAL NODE ROLE DETECTION - PRECISE LOGIC
                    labels = metadata.get('labels', {})
                    logger.info(f"Node {node_info['name']} labels: {labels}")
                    
                    # METHOD 1: Check standard Kubernetes role labels (PRIMARY)
                    if labels.get('node-role.kubernetes.io/control-plane'):
                        node_info['role'] = 'master'
                    elif labels.get('node-role.kubernetes.io/master'):
                        node_info['role'] = 'master'
                    elif labels.get('node-role.kubernetes.io/worker'):
                        node_info['role'] = 'worker'
                    
                    # METHOD 2: Check node taints (SECONDARY - more reliable)
                    else:
                        taints = spec.get('taints', [])
                        has_control_plane_taint = False
                        
                        for taint in taints:
                            taint_key = taint.get('key', '')
                            if taint_key in ['node-role.kubernetes.io/control-plane', 'node-role.kubernetes.io/master']:
                                has_control_plane_taint = True
                                break
                        
                        if has_control_plane_taint:
                            node_info['role'] = 'master'
                        else:
                            # METHOD 3: Only use system pods as LAST RESORT for edge cases
                            # AND only if we have no other information
                            if not labels and not taints:
                                node_info['role'] = determine_role_from_system_pods(node_info['name'], k8s_client)
                            else:
                                # DEFAULT: If no explicit role, assume worker
                                node_info['role'] = 'worker'
                    
                    # Store taint information for debugging
                    node_info['taints'] = taints
                    
                    # Extract IP addresses
                    ip_addresses = []
                    for addr in status.get('addresses', []):
                        if addr.get('type') in ['InternalIP', 'ExternalIP', 'Hostname']:
                            ip_addresses.append({
                                'type': addr.get('type'),
                                'address': addr.get('address')
                            })
                    node_info['ip_addresses'] = ip_addresses
                    
                    # Get node conditions for health status
                    conditions = status.get('conditions', [])
                    node_info['health_status'] = 'Unknown'
                    
                    for condition in conditions:
                        if condition.get('type') == 'Ready':
                            if condition.get('status') == 'True':
                                node_info['health_status'] = 'Ready'
                            else:
                                node_info['health_status'] = 'NotReady'
                            break
                    
                    # Calculate resource usage percentages
                    allocatable = status.get('allocatable', {})
                    capacity = status.get('capacity', {})
                    
                    if 'cpu' in allocatable and 'cpu' in capacity:
                        node_info['cpu_usage_percent'] = 0  # Will be calculated from metrics later
                    if 'memory' in allocatable and 'memory' in capacity:
                        node_info['memory_usage_percent'] = 0  # Will be calculated from metrics later
                    
                    nodes_data.append(node_info)
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse nodes JSON: {e}")
                return jsonify({
                    'error': 'Failed to parse node data from Kubernetes',
                    'nodes': []
                }), 500
        
        return jsonify({
            'nodes': nodes_data,
            'timestamp': datetime.now().isoformat(),
            'kubeconfig': active_kubeconfig['name']
        })
        
    except Exception as e:
        logger.error(f"Error getting topology nodes: {str(e)}")
        return jsonify({'error': 'Failed to get topology nodes', 'nodes': []}), 500

@app.route('/topology/namespaces', methods=['GET'])
@require_user_auth
def get_topology_namespaces():
    """Get all namespaces for filtering"""
    try:
        # Check if there's an active kubeconfig in database
        active_kubeconfig = app.db.get_active_kubeconfig()
        
        if not active_kubeconfig:
            return jsonify({
                'error': 'No active kubeconfig configured. Please add and activate a kubeconfig first.',
                'namespaces': []
            }), 400
        
        # Initialize K8s client with active kubeconfig
        k8s_client = K8sClient(kubeconfig_path=active_kubeconfig['path'])
        
        # Get namespaces data
        namespaces_result = k8s_client.get_namespaces()
        
        if not namespaces_result['success']:
            return jsonify({
                'error': f'Failed to get namespaces: {namespaces_result.get("error", "Unknown error")}',
                'namespaces': []
            }), 500
        
        # Parse namespace data
        namespaces_data = []
        
        if namespaces_result.get('stdout'):
            import json
            try:
                namespaces_json = json.loads(namespaces_result['stdout'])
                items = namespaces_json.get('items', [])
                
                for item in items:
                    metadata = item.get('metadata', {})
                    namespace_name = metadata.get('name', '')
                    
                    if namespace_name and not namespace_name.startswith('kube-'):
                        namespaces_data.append(namespace_name)
                        
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse namespaces JSON: {e}")
                return jsonify({
                    'error': f'Failed to parse namespaces data: {str(e)}',
                    'namespaces': []
                }), 500
        
        return jsonify({
            'success': True,
            'namespaces': sorted(namespaces_data),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting topology namespaces: {str(e)}")
        return jsonify({'error': 'Failed to get topology namespaces', 'namespaces': []}), 500

@app.route('/topology/pods', methods=['GET'])
@require_user_auth
def get_topology_pods():
    """Get pod topology data with namespace filtering"""
    try:
        # Check if there's an active kubeconfig in database
        active_kubeconfig = app.db.get_active_kubeconfig()
        
        if not active_kubeconfig:
            return jsonify({
                'error': 'No active kubeconfig configured. Please add and activate a kubeconfig first.',
                'pods': []
            }), 400
        
        # Initialize K8s client with active kubeconfig
        k8s_client = K8sClient(kubeconfig_path=active_kubeconfig['path'])
        
        # Get namespace parameter
        namespace = request.args.get('namespace', 'all')
        
        # Get pods data
        pods_result = k8s_client.get_pods(namespace)
        
        if not pods_result['success']:
            return jsonify({
                'error': f'Failed to get pods: {pods_result.get("error", "Unknown error")}',
                'pods': []
            }), 500
        
        # Parse pod data
        pods_data = []
        
        if pods_result.get('stdout'):
            import json
            try:
                pods_json = json.loads(pods_result['stdout'])
                items = pods_json.get('items', [])
                
                for item in items:
                    metadata = item.get('metadata', {})
                    spec = item.get('spec', {})
                    status = item.get('status', {})
                    
                    # Extract pod information
                    pod_info = {
                        'name': metadata.get('name', ''),
                        'namespace': metadata.get('namespace', ''),
                        'uid': metadata.get('uid', ''),
                        'creationTimestamp': metadata.get('creationTimestamp'),
                        'labels': metadata.get('labels', {}),
                        'annotations': metadata.get('annotations', {}),
                        
                        # Pod specifications
                        'node_name': spec.get('nodeName', ''),
                        'restart_policy': spec.get('restartPolicy', ''),
                        'service_account': spec.get('serviceAccountName', ''),
                        
                        # Pod status
                        'phase': status.get('phase', 'Unknown'),
                        'ip': status.get('podIP', ''),
                        'conditions': status.get('conditions', []),
                        'host_ip': status.get('hostIP', ''),
                        'start_time': status.get('startTime'),
                        
                        # Container information
                        'containers': []
                    }
                    
                    # Extract container information
                    containers = []
                    for container in spec.get('containers', []):
                        container_name = container.get('name', '')
                        container_image = container.get('image', '')
                        
                        # Get container status
                        container_status = 'Unknown'
                        for container_status_info in status.get('containerStatuses', []):
                            if container_status_info.get('name') == container_name:
                                if container_status_info.get('state', {}).get('running'):
                                    container_status = 'Running'
                                elif container_status_info.get('state', {}).get('waiting'):
                                    container_status = 'Waiting'
                                elif container_status_info.get('state', {}).get('terminated'):
                                    container_status = 'Terminated'
                                break
                        
                        containers.append({
                            'name': container_name,
                            'image': container_image,
                            'state': container_status
                        })
                    
                    pod_info['containers'] = containers
                    
                    pods_data.append(pod_info)
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse pods JSON: {e}")
                return jsonify({
                    'error': f'Failed to parse pods data: {str(e)}',
                    'pods': []
                }), 500
        
        return jsonify({
            'success': True,
            'pods': pods_data,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting topology pods: {str(e)}")
        return jsonify({'error': 'Failed to get topology pods', 'pods': []}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("Starting K8s Audit Bot Flask Server with Database Integration...")
    logger.info("=" * 60)
    logger.info("DEFAULT ADMIN CREDENTIALS:")
    logger.info("Username: admin")
    logger.info("Password: admin123")
    logger.info("PLEASE CHANGE THE DEFAULT PASSWORD IMMEDIATELY!")
    logger.info("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)