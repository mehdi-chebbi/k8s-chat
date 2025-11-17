import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import logging
import bcrypt
from datetime import datetime
from typing import Optional, Dict, Any, List
import json

logger = logging.getLogger(__name__)

class Database:
    """Database manager for K8s Audit Bot using PostgreSQL"""
    
    def __init__(self, host='localhost', port=5432, database='k8s_bot', 
                 user='bot_user', password='bot_password_123', min_conn=1, max_conn=10):
        """Initialize database connection pool"""
        self.connection_pool = None
        try:
            self.connection_pool = psycopg2.pool.SimpleConnectionPool(
                min_conn,
                max_conn,
                host=host,
                port=port,
                database=database,
                user=user,
                password=password
            )
            
            if self.connection_pool:
                logger.info(f"Connected to PostgreSQL database: {database}")
                self._init_tables()
            else:
                raise Exception("Failed to create connection pool")
                
        except Exception as e:
            logger.error(f"Failed to connect to database: {str(e)}")
            raise
    
    def _get_connection(self):
        """Get a connection from the pool"""
        return self.connection_pool.getconn()
    
    def _put_connection(self, conn):
        """Return a connection to the pool"""
        self.connection_pool.putconn(conn)
    
    def _init_tables(self):
        """Initialize database tables with migration support - preserves existing data"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Check existing tables
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            existing_tables = {row[0] for row in cursor.fetchall()}
            logger.info(f"Existing tables: {existing_tables}")
            
            # Create tables only if they don't exist
            if 'users' not in existing_tables:
                self._create_users_table(cursor)
                logger.info("Created users table")
            else:
                self._verify_users_schema(cursor)
                logger.info("Verified users table schema")
            
            if 'user_preferences' not in existing_tables:
                self._create_user_preferences_table(cursor)
                logger.info("Created user_preferences table")
            else:
                self._verify_user_preferences_schema(cursor)
                logger.info("Verified user_preferences table schema")
            
            if 'activity_logs' not in existing_tables:
                self._create_activity_logs_table(cursor)
                logger.info("Created activity_logs table")
            else:
                self._verify_activity_logs_schema(cursor)
                logger.info("Verified activity_logs table schema")
            
            if 'chat_history' not in existing_tables:
                self._create_chat_history_table(cursor)
                logger.info("Created chat_history table")
            else:
                self._verify_chat_history_schema(cursor)
                logger.info("Verified chat_history table schema")
            
            if 'sessions' not in existing_tables:
                self._create_sessions_table(cursor)
                logger.info("Created sessions table")
            else:
                self._verify_sessions_schema(cursor)
                logger.info("Verified sessions table schema")
            
            if 'kubeconfigs' not in existing_tables:
                self._create_kubeconfigs_table(cursor)
                logger.info("Created kubeconfigs table")
            else:
                self._verify_kubeconfigs_schema(cursor)
                logger.info("Verified kubeconfigs table schema")
            
            if 'api_keys' not in existing_tables:
                self._create_api_keys_table(cursor)
                logger.info("Created api_keys table")
            else:
                self._verify_api_keys_schema(cursor)
                logger.info("Verified api_keys table schema")
            
            # Create indexes for better performance
            self._create_indexes(cursor)
            
            conn.commit()
            logger.info("Database tables initialization/verification completed successfully")
            
            # Create default admin if no users exist
            self._create_default_admin()
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to initialize database tables: {str(e)}")
            raise
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def _create_users_table(self, cursor):
        """Create users table"""
        cursor.execute("""
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                is_banned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL,
                last_login TIMESTAMP,
                CONSTRAINT role_check CHECK (role IN ('admin', 'user'))
            )
        """)
    
    def _verify_users_schema(self, cursor):
        """Verify and potentially update users table schema"""
        # Check if all required columns exist
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' AND table_schema = 'public'
        """)
        existing_columns = {row[0]: row for row in cursor.fetchall()}
        
        required_columns = {
            'id': ('integer', 'NO', None),
            'username': ('character varying', 'NO', None),
            'email': ('character varying', 'NO', None),
            'password_hash': ('text', 'NO', None),
            'role': ('character varying', 'NO', "'user'::character varying"),
            'is_banned': ('boolean', 'NO', 'false'),
            'created_at': ('timestamp without time zone', 'NO', None),
            'last_login': ('timestamp without time zone', 'YES', None)
        }
        
        for col_name, (expected_type, nullable, default) in required_columns.items():
            if col_name not in existing_columns:
                logger.warning(f"Missing column {col_name} in users table - manual migration may be needed")
    
    def _create_user_preferences_table(self, cursor):
        """Create user_preferences table"""
        cursor.execute("""
            CREATE TABLE user_preferences (
                user_id INTEGER PRIMARY KEY,
                tone VARCHAR(100) DEFAULT 'casual',
                response_style VARCHAR(100) DEFAULT 'detailed',
                personality VARCHAR(100) DEFAULT 'friendly',
                max_commands_preference INTEGER DEFAULT 3,
                auto_investigate BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    
    def _verify_user_preferences_schema(self, cursor):
        """Verify user_preferences table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'user_preferences' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'user_id', 'tone', 'response_style', 'personality', 
                          'max_commands_preference', 'auto_investigate', 'updated_at'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in user_preferences: {missing}")
    
    def _create_activity_logs_table(self, cursor):
        """Create activity_logs table"""
        cursor.execute("""
            CREATE TABLE activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                action_type VARCHAR(100) NOT NULL,
                command TEXT,
                classification_type VARCHAR(100),
                success BOOLEAN,
                error_message TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    
    def _verify_activity_logs_schema(self, cursor):
        """Verify activity_logs table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'activity_logs' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'id', 'user_id', 'timestamp', 'action_type', 
                          'command', 'classification_type', 'success', 'error_message'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in activity_logs: {missing}")
    
    def _create_chat_history_table(self, cursor):
        """Create chat_history table"""
        cursor.execute("""
            CREATE TABLE chat_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                role VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                commands_executed JSONB,
                classification_info JSONB,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT role_check CHECK (role IN ('user', 'assistant'))
            )
        """)
    
    def _verify_chat_history_schema(self, cursor):
        """Verify chat_history table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'chat_history' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'id', 'user_id', 'session_id', 'timestamp', 
                          'role', 'message', 'commands_executed', 'classification_info'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in chat_history: {missing}")
    
    def _create_sessions_table(self, cursor):
        """Create sessions table"""
        cursor.execute("""
            CREATE TABLE sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) DEFAULT 'New Chat',
                created_at TIMESTAMP NOT NULL,
                last_activity TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    
    def _verify_sessions_schema(self, cursor):
        """Verify sessions table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'sessions' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'id', 'user_id', 'session_id', 'title', 'created_at', 
                          'last_activity', 'is_active'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in sessions: {missing}")
            
            # Add title column if missing
            if 'title' in missing:
                cursor.execute("""
                    ALTER TABLE sessions 
                    ADD COLUMN title VARCHAR(255) DEFAULT 'New Chat'
                """)
                logger.info("Added title column to sessions table")
    
    def _create_kubeconfigs_table(self, cursor):
        """Create kubeconfigs table"""
        cursor.execute("""
            CREATE TABLE kubeconfigs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                path TEXT NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                created_by INTEGER,
                last_tested TIMESTAMP,
                test_status VARCHAR(50) DEFAULT 'untested',
                test_message TEXT,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        """)
    
    def _verify_kubeconfigs_schema(self, cursor):
        """Verify kubeconfigs table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'kubeconfigs' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'id', 'name', 'path', 'description', 'is_active', 
                          'is_default', 'created_at', 'updated_at', 'created_by',
                          'last_tested', 'test_status', 'test_message'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in kubeconfigs: {missing}")
    
    def _create_api_keys_table(self, cursor):
        """Create api_keys table"""
        cursor.execute("""
            CREATE TABLE api_keys (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                provider VARCHAR(100) NOT NULL DEFAULT 'openrouter',
                api_key TEXT NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                created_by INTEGER,
                last_used TIMESTAMP,
                usage_count INTEGER DEFAULT 0,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        """)
    
    def _verify_api_keys_schema(self, cursor):
        """Verify api_keys table schema"""
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'api_keys' AND table_schema = 'public'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        required_columns = {'id', 'name', 'provider', 'api_key', 'description', 
                          'is_active', 'created_at', 'updated_at', 'created_by',
                          'last_used', 'usage_count'}
        
        missing = required_columns - existing_columns
        if missing:
            logger.warning(f"Missing columns in api_keys: {missing}")
    
    def _create_indexes(self, cursor):
        """Create database indexes for performance"""
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)",
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_kubeconfigs_name ON kubeconfigs(name)",
            "CREATE INDEX IF NOT EXISTS idx_kubeconfigs_is_active ON kubeconfigs(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_kubeconfigs_is_default ON kubeconfigs(is_default)",
            "CREATE INDEX IF NOT EXISTS idx_kubeconfigs_created_by ON kubeconfigs(created_by)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(name)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by)"
        ]
        
        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
                logger.debug(f"Created/verified index: {index_sql.split('idx_')[1].split(' ')[0]}")
            except Exception as e:
                logger.warning(f"Failed to create index: {e}")
    
    def _create_default_admin(self):
        """Create default admin user if no users exist"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("SELECT COUNT(*) as count FROM users")
            result = cursor.fetchone()
            
            if result['count'] == 0:
                # Create default admin
                default_password = "admin123"  # Should be changed on first login
                password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt())
                
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, role, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, ("admin", "admin@localhost", password_hash.decode('utf-8'), "admin", datetime.now()))
                
                # Create default preferences for admin
                cursor.execute("""
                    INSERT INTO user_preferences (user_id, updated_at)
                    VALUES ((SELECT id FROM users WHERE username = 'admin'), %s)
                """, (datetime.now(),))
                
                conn.commit()
                logger.info("Default admin user created (username: admin, password: admin123)")
                logger.warning("IMPORTANT: Change the default admin password immediately!")
            else:
                logger.info(f"Users already exist ({result['count']} users), skipping default admin creation")
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create default admin: {str(e)}")
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def health_check(self) -> dict:
        """Perform database health check"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Test basic connectivity
            cursor.execute("SELECT 1")
            cursor.fetchone()
            
            # Check table counts
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM users) as users_count,
                    (SELECT COUNT(*) FROM sessions) as sessions_count,
                    (SELECT COUNT(*) FROM chat_history) as messages_count,
                    (SELECT COUNT(*) FROM activity_logs) as logs_count
            """)
            stats = cursor.fetchone()
            
            cursor.close()
            self._put_connection(conn)
            
            return {
                'status': 'healthy',
                'connection': 'ok',
                'tables': 'verified',
                'stats': {
                    'users': stats[0],
                    'sessions': stats[1],
                    'messages': stats[2],
                    'logs': stats[3]
                }
            }
            
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    # ==================== USER MANAGEMENT ====================
    
    def create_user(self, username: str, email: str, password: str, role: str = 'user') -> Optional[int]:
        """Create a new user"""
        conn = None
        try:
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, role, created_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (username, email, password_hash.decode('utf-8'), role, datetime.now()))
            
            user_id = cursor.fetchone()[0]
            
            # Create default preferences
            cursor.execute("""
                INSERT INTO user_preferences (user_id, updated_at)
                VALUES (%s, %s)
            """, (user_id, datetime.now()))
            
            conn.commit()
            logger.info(f"User created: {username} (ID: {user_id})")
            return user_id
        
        except psycopg2.IntegrityError as e:
            if conn:
                conn.rollback()
            logger.error(f"User creation failed - duplicate username/email: {str(e)}")
            return None
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create user: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user and return user info"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, username, email, password_hash, role, is_banned
                FROM users
                WHERE username = %s
            """, (username,))
            
            user = cursor.fetchone()
            
            if not user:
                logger.warning(f"Authentication failed - user not found: {username}")
                return None
            
            if user['is_banned']:
                logger.warning(f"Authentication failed - user is banned: {username}")
                return None
            
            # Verify password
            if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                # Update last login
                cursor.execute("""
                    UPDATE users SET last_login = %s WHERE id = %s
                """, (datetime.now(), user['id']))
                conn.commit()
                
                logger.info(f"User authenticated: {username}")
                return {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'role': user['role']
                }
            else:
                logger.warning(f"Authentication failed - invalid password: {username}")
                return None
        
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, username, email, role, is_banned, created_at, last_login
                FROM users
                WHERE id = %s
            """, (user_id,))
            
            user = cursor.fetchone()
            return dict(user) if user else None
        
        except Exception as e:
            logger.error(f"Failed to get user: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users (for admin dashboard)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, username, email, role, is_banned, created_at, last_login
                FROM users
                ORDER BY created_at DESC
            """)
            
            users = cursor.fetchall()
            return [dict(user) for user in users]
        
        except Exception as e:
            logger.error(f"Failed to get users: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_user_role(self, user_id: int, new_role: str) -> bool:
        """Update user role"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users SET role = %s WHERE id = %s
            """, (new_role, user_id))
            
            conn.commit()
            logger.info(f"User role updated: ID {user_id} -> {new_role}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update user role: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def ban_user(self, user_id: int) -> bool:
        """Ban a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users SET is_banned = TRUE WHERE id = %s
            """, (user_id,))
            
            conn.commit()
            logger.info(f"User banned: ID {user_id}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to ban user: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def unban_user(self, user_id: int) -> bool:
        """Unban a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users SET is_banned = FALSE WHERE id = %s
            """, (user_id,))
            
            conn.commit()
            logger.info(f"User unbanned: ID {user_id}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to unban user: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def change_password(self, user_id: int, new_password: str) -> bool:
        """Change user password"""
        conn = None
        try:
            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users SET password_hash = %s WHERE id = %s
            """, (password_hash.decode('utf-8'), user_id))
            
            conn.commit()
            logger.info(f"Password changed for user ID: {user_id}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to change password: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== USER PREFERENCES ====================
    
    def get_user_preferences(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user preferences"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT tone, response_style, personality, max_commands_preference, auto_investigate
                FROM user_preferences
                WHERE user_id = %s
            """, (user_id,))
            
            prefs = cursor.fetchone()
            return dict(prefs) if prefs else None
        
        except Exception as e:
            logger.error(f"Failed to get user preferences: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_user_preferences(self, user_id: int, preferences: Dict[str, Any]) -> bool:
        """Update user preferences"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Build dynamic update query
            fields = []
            values = []
            
            for key in ['tone', 'response_style', 'personality', 'max_commands_preference', 'auto_investigate']:
                if key in preferences:
                    fields.append(f"{key} = %s")
                    values.append(preferences[key])
            
            if not fields:
                return False
            
            fields.append("updated_at = %s")
            values.append(datetime.now())
            values.append(user_id)
            
            query = f"UPDATE user_preferences SET {', '.join(fields)} WHERE user_id = %s"
            cursor.execute(query, values)
            
            conn.commit()
            logger.info(f"User preferences updated: ID {user_id}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update user preferences: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== ACTIVITY LOGS ====================
    
    def log_activity(self, user_id: int, action_type: str, command: str = None,
                    classification_type: str = None, success: bool = True,
                    error_message: str = None):
        """Log user activity (for admin visibility)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO activity_logs 
                (user_id, timestamp, action_type, command, classification_type, success, error_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_id, datetime.now(), action_type, command,
                  classification_type, success, error_message))
            
            conn.commit()
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to log activity: {str(e)}")
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_activity_logs(self, user_id: int = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get activity logs (for admin dashboard)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            if user_id:
                cursor.execute("""
                    SELECT l.*, u.username
                    FROM activity_logs l
                    JOIN users u ON l.user_id = u.id
                    WHERE l.user_id = %s
                    ORDER BY l.timestamp DESC
                    LIMIT %s
                """, (user_id, limit))
            else:
                cursor.execute("""
                    SELECT l.*, u.username
                    FROM activity_logs l
                    JOIN users u ON l.user_id = u.id
                    ORDER BY l.timestamp DESC
                    LIMIT %s
                """, (limit,))
            
            logs = cursor.fetchall()
            return [dict(log) for log in logs]
        
        except Exception as e:
            logger.error(f"Failed to get activity logs: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== CHAT HISTORY ====================
    
    def save_chat_message(self, user_id: int, session_id: str, role: str, message: str,
                         commands_executed: List[str] = None, classification_info: Dict = None):
        """Save chat message to history"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO chat_history 
                (user_id, session_id, timestamp, role, message, commands_executed, classification_info)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_id, session_id, datetime.now(), role, message,
                  json.dumps(commands_executed) if commands_executed else None,
                  json.dumps(classification_info) if classification_info else None))
            
            conn.commit()
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to save chat message: {str(e)}")
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_chat_history(self, user_id: int, session_id: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get chat history for a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            if session_id:
                cursor.execute("""
                    SELECT id, session_id, timestamp, role, message, commands_executed, classification_info
                    FROM chat_history
                    WHERE user_id = %s AND session_id = %s
                    ORDER BY timestamp ASC
                    LIMIT %s
                """, (user_id, session_id, limit))
            else:
                cursor.execute("""
                    SELECT id, session_id, timestamp, role, message, commands_executed, classification_info
                    FROM chat_history
                    WHERE user_id = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                """, (user_id, limit))
            
            history = cursor.fetchall()
            return [dict(msg) for msg in history]
        
        except Exception as e:
            logger.error(f"Failed to get chat history: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_user_sessions(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all sessions for a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT s.session_id, s.title, s.created_at, s.last_activity,
                       COUNT(ch.id) as message_count
                FROM sessions s
                LEFT JOIN chat_history ch ON s.session_id = ch.session_id
                WHERE s.user_id = %s
                GROUP BY s.session_id, s.title, s.created_at, s.last_activity
                ORDER BY s.last_activity DESC
            """, (user_id,))
            
            sessions = cursor.fetchall()
            return [dict(session) for session in sessions]
        
        except Exception as e:
            logger.error(f"Failed to get user sessions: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def delete_chat_history(self, user_id: int, session_id: str = None) -> bool:
        """Delete chat history for a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            if session_id:
                cursor.execute("""
                    DELETE FROM chat_history WHERE user_id = %s AND session_id = %s
                """, (user_id, session_id))
            else:
                cursor.execute("""
                    DELETE FROM chat_history WHERE user_id = %s
                """, (user_id,))
            
            conn.commit()
            logger.info(f"Chat history deleted for user ID: {user_id}")
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to delete chat history: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== SESSIONS ====================
    
    def create_session(self, user_id: int, session_id: str, title: str = 'New Chat') -> bool:
        """Create a new session"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            now = datetime.now()
            
            cursor.execute("""
                INSERT INTO sessions (user_id, session_id, title, created_at, last_activity)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, session_id, title, now, now))
            
            conn.commit()
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create session: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_session_activity(self, session_id: str) -> bool:
        """Update session last activity"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE sessions SET last_activity = %s WHERE session_id = %s
            """, (datetime.now(), session_id))
            
            conn.commit()
            return True
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update session activity: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by session ID"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT * FROM sessions WHERE session_id = %s AND is_active = TRUE
            """, (session_id,))
            
            result = cursor.fetchone()
            if result:
                # Convert datetime objects to strings for JSON serialization
                if 'created_at' in result and result['created_at']:
                    result['created_at'] = result['created_at'].isoformat()
                if 'last_activity' in result and result['last_activity']:
                    result['last_activity'] = result['last_activity'].isoformat()
                return dict(result)
            else:
                return None
        
        except Exception as e:
            logger.error(f"Failed to get session: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_session_title(self, user_id: int, session_id: str, title: str) -> bool:
        """Update session title"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE sessions SET title = %s 
                WHERE user_id = %s AND session_id = %s
            """, (title, user_id, session_id))
            
            conn.commit()
            return cursor.rowcount > 0
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update session title: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def delete_session(self, user_id: int, session_id: str) -> bool:
        """Delete a session and its chat history"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Delete chat history first
            cursor.execute("""
                DELETE FROM chat_history 
                WHERE user_id = %s AND session_id = %s
            """, (user_id, session_id))
            
            # Delete the session
            cursor.execute("""
                DELETE FROM sessions 
                WHERE user_id = %s AND session_id = %s
            """, (user_id, session_id))
            
            conn.commit()
            return cursor.rowcount > 0
        
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to delete session: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== KUBECONFIG MANAGEMENT ====================
    
    def create_kubeconfig(self, name: str, path: str, description: str = None, 
                         created_by: int = None, is_default: bool = False) -> Optional[int]:
        """Create a new kubeconfig entry"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # If setting as default, unset all other defaults
            if is_default:
                cursor.execute("UPDATE kubeconfigs SET is_default = FALSE WHERE is_default = TRUE")
            
            cursor.execute("""
                INSERT INTO kubeconfigs (name, path, description, is_default, created_at, updated_at, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (name, path, description, is_default, datetime.now(), datetime.now(), created_by))
            
            result = cursor.fetchone()
            conn.commit()
            
            if result:
                logger.info(f"Created kubeconfig '{name}' with path '{path}'")
                return result['id']
            return None
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create kubeconfig: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_all_kubeconfigs(self) -> List[Dict[str, Any]]:
        """Get all kubeconfig entries"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT k.*, u.username as created_by_username
                FROM kubeconfigs k
                LEFT JOIN users u ON k.created_by = u.id
                ORDER BY k.created_at DESC
            """)
            
            results = cursor.fetchall()
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Failed to get kubeconfigs: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_kubeconfig(self, kubeconfig_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific kubeconfig by ID"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT k.*, u.username as created_by_username
                FROM kubeconfigs k
                LEFT JOIN users u ON k.created_by = u.id
                WHERE k.id = %s
            """, (kubeconfig_id,))
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Failed to get kubeconfig {kubeconfig_id}: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_active_kubeconfig(self) -> Optional[Dict[str, Any]]:
        """Get the currently active kubeconfig"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT k.*, u.username as created_by_username
                FROM kubeconfigs k
                LEFT JOIN users u ON k.created_by = u.id
                WHERE k.is_active = TRUE
                LIMIT 1
            """)
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Failed to get active kubeconfig: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_kubeconfig(self, kubeconfig_id: int, name: str = None, path: str = None,
                         description: str = None, is_default: bool = None) -> bool:
        """Update a kubeconfig entry"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build update query dynamically
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = %s")
                params.append(name)
            if path is not None:
                updates.append("path = %s")
                params.append(path)
            if description is not None:
                updates.append("description = %s")
                params.append(description)
            if is_default is not None:
                updates.append("is_default = %s")
                params.append(is_default)
            
            if not updates:
                return False  # Nothing to update
            
            updates.append("updated_at = %s")
            params.append(datetime.now())
            params.append(kubeconfig_id)
            
            # If setting as default, unset all other defaults
            if is_default:
                cursor.execute("UPDATE kubeconfigs SET is_default = FALSE WHERE is_default = TRUE")
            
            cursor.execute(f"""
                UPDATE kubeconfigs 
                SET {', '.join(updates)}
                WHERE id = %s
            """, params)
            
            conn.commit()
            logger.info(f"Updated kubeconfig {kubeconfig_id}")
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update kubeconfig {kubeconfig_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def delete_kubeconfig(self, kubeconfig_id: int) -> bool:
        """Delete a kubeconfig entry"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("DELETE FROM kubeconfigs WHERE id = %s", (kubeconfig_id,))
            
            conn.commit()
            logger.info(f"Deleted kubeconfig {kubeconfig_id}")
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to delete kubeconfig {kubeconfig_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def set_active_kubeconfig(self, kubeconfig_id: int) -> bool:
        """Set a kubeconfig as active (unset all others)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Unset all active configs
            cursor.execute("UPDATE kubeconfigs SET is_active = FALSE")
            
            # Set the specified one as active
            cursor.execute("UPDATE kubeconfigs SET is_active = TRUE, updated_at = %s WHERE id = %s",
                          (datetime.now(), kubeconfig_id))
            
            conn.commit()
            logger.info(f"Set kubeconfig {kubeconfig_id} as active")
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to set active kubeconfig {kubeconfig_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_kubeconfig_test_result(self, kubeconfig_id: int, test_status: str, 
                                    test_message: str = None) -> bool:
        """Update the test result for a kubeconfig"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                UPDATE kubeconfigs 
                SET last_tested = %s, test_status = %s, test_message = %s, updated_at = %s
                WHERE id = %s
            """, (datetime.now(), test_status, test_message, datetime.now(), kubeconfig_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update test result for kubeconfig {kubeconfig_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    # ==================== API KEYS MANAGEMENT ====================
    
    def create_api_key(self, name: str, api_key: str, provider: str = 'openrouter', 
                      description: str = None, created_by: int = None) -> Optional[int]:
        """Create a new API key"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                INSERT INTO api_keys (name, provider, api_key, description, created_at, updated_at, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (name, provider, api_key, description, datetime.now(), datetime.now(), created_by))
            
            result = cursor.fetchone()
            conn.commit()
            return result['id'] if result else None
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create API key: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_all_api_keys(self) -> List[Dict[str, Any]]:
        """Get all API keys"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT ak.*, u.username as created_by_username
                FROM api_keys ak
                LEFT JOIN users u ON ak.created_by = u.id
                ORDER BY ak.created_at DESC
            """)
            
            return cursor.fetchall()
            
        except Exception as e:
            logger.error(f"Failed to get API keys: {str(e)}")
            return []
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_api_key(self, api_key_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific API key by ID"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT ak.*, u.username as created_by_username
                FROM api_keys ak
                LEFT JOIN users u ON ak.created_by = u.id
                WHERE ak.id = %s
            """, (api_key_id,))
            
            result = cursor.fetchone()
            return result
            
        except Exception as e:
            logger.error(f"Failed to get API key {api_key_id}: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def get_active_api_key(self, provider: str = 'openrouter') -> Optional[Dict[str, Any]]:
        """Get the active API key for a specific provider"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT ak.*, u.username as created_by_username
                FROM api_keys ak
                LEFT JOIN users u ON ak.created_by = u.id
                WHERE ak.provider = %s AND ak.is_active = TRUE
                ORDER BY ak.created_at DESC
                LIMIT 1
            """, (provider,))
            
            result = cursor.fetchone()
            return result
            
        except Exception as e:
            logger.error(f"Failed to get active API key for {provider}: {str(e)}")
            return None
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_api_key(self, api_key_id: int, name: str = None, api_key: str = None,
                      provider: str = None, description: str = None, is_active: bool = None) -> bool:
        """Update an API key"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build dynamic update query
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = %s")
                params.append(name)
            if api_key is not None:
                updates.append("api_key = %s")
                params.append(api_key)
            if provider is not None:
                updates.append("provider = %s")
                params.append(provider)
            if description is not None:
                updates.append("description = %s")
                params.append(description)
            if is_active is not None:
                updates.append("is_active = %s")
                params.append(is_active)
            
            if not updates:
                return False  # Nothing to update
            
            updates.append("updated_at = %s")
            params.append(datetime.now())
            params.append(api_key_id)
            
            cursor.execute(f"""
                UPDATE api_keys 
                SET {', '.join(updates)}
                WHERE id = %s
            """, params)
            
            conn.commit()
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update API key {api_key_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def delete_api_key(self, api_key_id: int) -> bool:
        """Delete an API key"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("DELETE FROM api_keys WHERE id = %s", (api_key_id,))
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to delete API key {api_key_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def set_active_api_key(self, api_key_id: int) -> bool:
        """Set an API key as active (deactivate all others for the same provider)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # First get the provider of the API key to activate
            cursor.execute("SELECT provider FROM api_keys WHERE id = %s", (api_key_id,))
            result = cursor.fetchone()
            
            if not result:
                return False
            
            provider = result['provider']
            
            # Deactivate all API keys for this provider
            cursor.execute("""
                UPDATE api_keys 
                SET is_active = FALSE, updated_at = %s
                WHERE provider = %s
            """, (datetime.now(), provider))
            
            # Activate the specified API key
            cursor.execute("""
                UPDATE api_keys 
                SET is_active = TRUE, updated_at = %s
                WHERE id = %s
            """, (datetime.now(), api_key_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to set active API key {api_key_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def update_api_key_usage(self, api_key_id: int) -> bool:
        """Update the usage statistics for an API key"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                UPDATE api_keys 
                SET last_used = %s, usage_count = usage_count + 1
                WHERE id = %s
            """, (datetime.now(), api_key_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to update API key usage {api_key_id}: {str(e)}")
            return False
        finally:
            if conn:
                cursor.close()
                self._put_connection(conn)
    
    def close_all(self):
        """Close all database connections"""
        if self.connection_pool:
            self.connection_pool.closeall()
            logger.info("All database connections closed")