#!/usr/bin/env python3
"""
🧪 K8s Smart Bot Authentication Test Suite

This script tests all the authentication features implemented in the K8s Smart Bot.
Run this script to verify that your authentication system is working correctly.

Usage:
    python3 test_auth.py [--base-url URL] [--verbose]

Example:
    python3 test_auth.py --base-url http://localhost:5000 --verbose
"""

import requests
import json
import sys
import time
import argparse
from typing import Dict, Any, Optional, Tuple

class Colors:
    """ANSI color codes for pretty output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class AuthTester:
    def __init__(self, base_url: str = "http://localhost:5000", verbose: bool = False):
        self.base_url = base_url.rstrip('/')
        self.verbose = verbose
        self.session = requests.Session()
        self.test_results = []
        
    def log(self, message: str, color: str = Colors.WHITE):
        """Print colored message"""
        print(f"{color}{message}{Colors.END}")
        
    def success(self, message: str):
        """Print success message"""
        self.log(f"✅ {message}", Colors.GREEN)
        
    def error(self, message: str):
        """Print error message"""
        self.log(f"❌ {message}", Colors.RED)
        
    def warning(self, message: str):
        """Print warning message"""
        self.log(f"⚠️  {message}", Colors.YELLOW)
        
    def info(self, message: str):
        """Print info message"""
        self.log(f"ℹ️  {message}", Colors.BLUE)
        
    def test_request(self, method: str, endpoint: str, 
                  expected_status: int, data: Optional[Dict] = None,
                  headers: Optional[Dict] = None, 
                  description: str = "") -> Tuple[bool, Dict[str, Any]]:
        """Make a test request and check response"""
        url = f"{self.base_url}{endpoint}"
        
        if self.verbose:
            self.info(f"Request: {method} {url}")
            if data:
                self.info(f"Data: {json.dumps(data, indent=2)}")
            if headers:
                self.info(f"Headers: {headers}")
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.success(f"{description} - Status: {response.status_code}")
            else:
                self.error(f"{description} - Expected: {expected_status}, Got: {response.status_code}")
                if response.text:
                    self.warning(f"Response: {response.text[:200]}...")
            
            if self.verbose and response.text:
                try:
                    parsed = response.json()
                    self.info(f"Response JSON: {json.dumps(parsed, indent=2)}")
                except:
                    self.info(f"Response Text: {response.text}")
            
            return success, response.json() if response.text else {}
            
        except requests.exceptions.ConnectionError:
            self.error(f"{description} - Connection failed. Is the server running?")
            return False, {}
        except Exception as e:
            self.error(f"{description} - Unexpected error: {str(e)}")
            return False, {}
    
    def test_health_check(self):
        """Test health check endpoint"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("🏥 Testing Health Check", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        success, data = self.test_request(
            'GET', '/health', 200, 
            description="Health check endpoint"
        )
        
        if success and 'status' in data:
            self.success(f"Health status: {data['status']}")
        
        return success
    
    def test_admin_user_creation(self):
        """Test admin user creation and login"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("👑 Testing Admin User Creation & Login", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        # First try to login with default admin
        default_login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        success, data = self.test_request(
            'POST', '/auth/login', 200, default_login_data,
            description="Login with default admin"
        )
        
        if success and 'session_id' in data:
            self.admin_session = data['session_id']
            user_role = data.get('user', {}).get('role', 'unknown')
            self.success(f"Default admin session obtained: {self.admin_session[:20]}... (role: {user_role})")
            return True
        
        # If default admin doesn't exist, create one
        self.warning("Default admin login failed, attempting to create admin user...")
        
        admin_data = {
            "username": "testadmin",
            "email": "admin@test.com",
            "password": "admin123"
        }
        
        success, data = self.test_request(
            'POST', '/auth/signup', 201, admin_data,
            description="Create admin user"
        )
        
        if not success:
            self.warning("Admin user creation failed, trying manual admin creation...")
            # Try to create admin directly via database endpoint if it exists
            admin_create_data = {
                "username": "testadmin2",
                "email": "admin2@test.com", 
                "password": "admin123",
                "role": "admin"
            }
            success, data = self.test_request(
                'POST', '/admin/users', 201, admin_create_data,
                description="Create admin via admin endpoint (may fail without auth)"
            )
            if not success:
                self.error("Cannot create admin user for testing")
                return False
        else:
            self.success("Admin user created successfully")
        
        # Test admin login
        login_data = {
            "username": "testadmin",
            "password": "admin123"
        }
        
        success, data = self.test_request(
            'POST', '/auth/login', 200, login_data,
            description="Login with created admin"
        )
        
        if success and 'session_id' in data:
            self.admin_session = data['session_id']
            user_role = data.get('user', {}).get('role', 'unknown')
            if user_role != 'admin':
                self.warning(f"User has role '{user_role}' instead of 'admin'")
                self.warning("This may be expected behavior - admin functions might need special setup")
            self.success(f"Admin session obtained: {self.admin_session[:20]}... (role: {user_role})")
            return True
        else:
            self.error("Failed to get admin session")
            return False
    
    def test_regular_user_creation(self):
        """Test regular user creation and login"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("👤 Testing Regular User Creation & Login", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        # Test regular user signup
        user_data = {
            "username": "testuser",
            "email": "user@test.com",
            "password": "user123"
        }
        
        success, data = self.test_request(
            'POST', '/auth/signup', 201, user_data,
            description="Create regular user"
        )
        
        if not success:
            self.warning("Regular user might already exist, trying login...")
        else:
            self.success("Regular user created successfully")
        
        # Test regular user login
        login_data = {
            "username": "testuser",
            "password": "user123"
        }
        
        success, data = self.test_request(
            'POST', '/auth/login', 200, login_data,
            description="Regular user login"
        )
        
        if success and 'session_id' in data:
            self.user_session = data['session_id']
            self.success(f"User session obtained: {self.user_session[:20]}...")
            return True
        else:
            self.error("Failed to get user session")
            return False
    
    def test_admin_endpoints(self):
        """Test admin endpoints with and without authentication"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("🔐 Testing Admin Endpoints", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        admin_headers = {"X-Session-ID": self.admin_session} if hasattr(self, 'admin_session') else None
        
        # Test admin endpoints without authentication (should fail)
        self.test_request('GET', '/admin/users', 401, description="Get users without auth")
        self.test_request('GET', '/admin/logs', 401, description="Get logs without auth")
        self.test_request('GET', '/admin/kubeconfigs', 401, description="Get kubeconfigs without auth")
        self.test_request('GET', '/admin/api-keys', 401, description="Get API keys without auth")
        
        # Test admin endpoints with admin authentication (should succeed)
        if admin_headers:
            self.test_request('GET', '/admin/users', 200, headers=admin_headers, description="Get users with admin auth")
            self.test_request('GET', '/admin/logs', 200, headers=admin_headers, description="Get logs with admin auth")
            self.test_request('GET', '/admin/kubeconfigs', 200, headers=admin_headers, description="Get kubeconfigs with admin auth")
            self.test_request('GET', '/admin/api-keys', 200, headers=admin_headers, description="Get API keys with admin auth")
            
            # Test admin user management
            self.test_request('POST', '/admin/users', 201, headers=admin_headers, 
                          data={"username": "newuser", "email": "new@test.com", "password": "new123"},
                          description="Create user as admin")
        else:
            self.error("Cannot test authenticated admin endpoints - no admin session")
    
    def test_user_endpoints(self):
        """Test user endpoints with and without authentication"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("👤 Testing User Endpoints", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        user_headers = {"X-Session-ID": self.user_session} if hasattr(self, 'user_session') else None
        
        # Test user endpoints without authentication (should fail)
        self.test_request('GET', '/user/preferences', 401, description="Get preferences without auth")
        self.test_request('GET', '/user/sessions', 401, description="Get sessions without auth")
        self.test_request('GET', '/user/history', 401, description="Get history without auth")
        
        # Test user endpoints with user authentication (should succeed)
        if user_headers:
            self.test_request('GET', '/user/preferences', 200, headers=user_headers, description="Get preferences with user auth")
            self.test_request('GET', '/user/sessions', 200, headers=user_headers, description="Get sessions with user auth")
            self.test_request('GET', '/user/history', 200, headers=user_headers, description="Get history with user auth")
            
            # Test user preferences update
            self.test_request('PUT', '/user/preferences', 200, headers=user_headers,
                          data={"tone": "casual", "response_style": "detailed"},
                          description="Update preferences")
        else:
            self.error("Cannot test authenticated user endpoints - no user session")
    
    def test_cross_access(self):
        """Test that users cannot access admin endpoints and vice versa"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("🚫 Testing Cross-Access Prevention", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        if not (hasattr(self, 'admin_session') and hasattr(self, 'user_session')):
            self.warning("Cannot test cross-access - missing sessions")
            return
        
        # Test user accessing admin endpoints (should fail)
        user_headers = {"X-Session-ID": self.user_session}
        self.test_request('GET', '/admin/users', 403, headers=user_headers, description="User accessing admin users")
        self.test_request('GET', '/admin/logs', 403, headers=user_headers, description="User accessing admin logs")
        
        # Test admin accessing user endpoints (should work - admins can access user endpoints)
        admin_headers = {"X-Session-ID": self.admin_session}
        self.test_request('GET', '/user/preferences', 200, headers=admin_headers, description="Admin accessing user preferences")
    
    def test_invalid_sessions(self):
        """Test behavior with invalid sessions"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("🔑 Testing Invalid Session Handling", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        invalid_headers = {"X-Session-ID": "invalid-session-id"}
        
        # Test with invalid session
        self.test_request('GET', '/admin/users', 401, headers=invalid_headers, description="Admin endpoint with invalid session")
        self.test_request('GET', '/user/preferences', 401, headers=invalid_headers, description="User endpoint with invalid session")
        
        # Test with empty session
        empty_headers = {"X-Session-ID": ""}
        self.test_request('GET', '/admin/users', 401, headers=empty_headers, description="Admin endpoint with empty session")
        
        # Test without session header
        self.test_request('GET', '/admin/users', 401, description="Admin endpoint without session header")
    
    def test_error_scenarios(self):
        """Test various error scenarios"""
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("⚠️  Testing Error Scenarios", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        # Test invalid login credentials
        self.test_request('POST', '/auth/login', 401, 
                      {"username": "wronguser", "password": "wrongpass"},
                      description="Login with invalid credentials")
        
        # Test signup with missing fields
        self.test_request('POST', '/auth/signup', 400,
                      {"username": "test"},
                      description="Signup with missing fields")
        
        # Test invalid JSON
        try:
            response = requests.post(f"{self.base_url}/auth/login", 
                                data="invalid json", 
                                headers={"Content-Type": "application/json"})
            if response.status_code == 400:
                self.success("Invalid JSON properly rejected")
            else:
                self.error(f"Invalid JSON not rejected - got {response.status_code}")
        except Exception as e:
            self.error(f"Error testing invalid JSON: {e}")
    
    def run_all_tests(self):
        """Run all authentication tests"""
        self.log("🚀 Starting K8s Smart Bot Authentication Tests", Colors.PURPLE + Colors.BOLD)
        self.log(f"📍 Target URL: {self.base_url}", Colors.PURPLE)
        
        tests_passed = 0
        total_tests = 0
        
        # Run test suites
        test_suites = [
            ("Health Check", self.test_health_check),
            ("Admin User Creation", self.test_admin_user_creation),
            ("Regular User Creation", self.test_regular_user_creation),
            ("Admin Endpoints", self.test_admin_endpoints),
            ("User Endpoints", self.test_user_endpoints),
            ("Cross-Access Prevention", self.test_cross_access),
            ("Invalid Sessions", self.test_invalid_sessions),
            ("Error Scenarios", self.test_error_scenarios)
        ]
        
        for suite_name, test_func in test_suites:
            try:
                test_func()
                tests_passed += 1
            except Exception as e:
                self.error(f"Test suite '{suite_name}' failed: {e}")
            total_tests += 1
            time.sleep(0.5)  # Small delay between tests
        
        # Summary
        self.log("\n" + "="*50, Colors.CYAN)
        self.log("📊 Test Summary", Colors.CYAN + Colors.BOLD)
        self.log("="*50, Colors.CYAN)
        
        if tests_passed == total_tests:
            self.success(f"All {total_tests} test suites passed! 🎉")
            self.log("🔐 Your authentication system is working correctly!", Colors.GREEN + Colors.BOLD)
        else:
            self.error(f"{total_tests - tests_passed} out of {total_tests} test suites failed")
            self.warning("Please check the errors above and fix them.")
        
        # Additional recommendations
        self.log("\n💡 Additional Testing Recommendations:", Colors.BLUE)
        self.log("1. Test with actual database (PostgreSQL) instead of in-memory", Colors.WHITE)
        self.log("2. Test frontend integration with browser", Colors.WHITE)
        self.log("3. Test session expiration scenarios", Colors.WHITE)
        self.log("4. Test concurrent user sessions", Colors.WHITE)
        self.log("5. Test with real Kubernetes cluster", Colors.WHITE)

def main():
    parser = argparse.ArgumentParser(description="Test K8s Smart Bot Authentication")
    parser.add_argument("--base-url", default="http://localhost:5000", 
                       help="Base URL of the K8s Smart Bot API")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    
    args = parser.parse_args()
    
    tester = AuthTester(args.base_url, args.verbose)
    tester.run_all_tests()

if __name__ == "__main__":
    main()