#!/usr/bin/env python3
"""
Debug Chat Endpoint After Logout
Tests specifically why /chat endpoint is still accessible after logout
"""

import requests
import json
import time

class ChatEndpointDebugger:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def debug_chat_endpoint(self):
        """Debug why chat endpoint is accessible after logout"""
        print("=" * 60)
        print("🔍 DEBUGGING CHAT ENDPOINT AFTER LOGOUT")
        print("=" * 60)
        
        # Step 1: Login
        print("\n🔑 Step 1: Login...")
        login_response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False
        
        print("✅ Login successful")
        
        # Step 2: Verify chat works while logged in
        print("\n💬 Step 2: Test chat while logged in...")
        chat_response = self.session.post(
            f"{self.base_url}/chat",
            json={"message": "test message", "user_id": 1, "session_id": "test"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Status: {chat_response.status_code}")
        if chat_response.status_code == 200:
            print("✅ Chat works while logged in")
        elif chat_response.status_code == 401:
            print("✅ Chat properly requires authentication")
        else:
            print(f"❌ Unexpected status: {chat_response.text}")
        
        # Step 3: Logout
        print("\n🚪 Step 3: Logout...")
        logout_response = self.session.post(
            f"{self.base_url}/auth/logout",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Status: {logout_response.status_code}")
        if logout_response.status_code == 200:
            print("✅ Logout successful")
        else:
            print(f"❌ Logout failed: {logout_response.text}")
        
        # Step 4: Check cookies after logout
        print("\n🍪 Step 4: Check cookies after logout...")
        cookies = self.session.cookies.get_dict()
        print(f"   Cookies: {cookies}")
        
        if 'session_id' in cookies:
            print("❌ Session cookie still present!")
        else:
            print("✅ Session cookie cleared")
        
        # Step 5: Test chat after logout (should fail)
        print("\n💬 Step 5: Test chat after logout...")
        chat_after_logout = self.session.post(
            f"{self.base_url}/chat",
            json={"message": "test after logout", "user_id": 1, "session_id": "test"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Status: {chat_after_logout.status_code}")
        print(f"   Response: {chat_after_logout.text}")
        
        if chat_after_logout.status_code == 401:
            print("✅ Chat properly denies access after logout")
            return True
        elif chat_after_logout.status_code == 200:
            print("❌ CRITICAL: Chat allows access after logout!")
            print("   This is a SECURITY VULNERABILITY!")
            return False
        elif chat_after_logout.status_code == 405:
            print("⚠️  Method not allowed (maybe different endpoint)")
            return False
        else:
            print(f"❌ Unexpected response: {chat_after_logout.status_code}")
            return False
    
    def test_with_no_session(self):
        """Test chat endpoint with no session cookie"""
        print("\n🔍 Testing chat with no session cookie...")
        
        # Create new session with no cookies
        clean_session = requests.Session()
        
        response = clean_session.post(
            f"{self.base_url}/chat",
            json={"message": "test with no session", "user_id": 1, "session_id": "test"},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Chat properly requires authentication")
            return True
        else:
            print("❌ Chat allows access without authentication!")
            return False
    
    def inspect_chat_endpoint_structure(self):
        """Check what endpoints exist"""
        print("\n🔍 Inspecting available endpoints...")
        
        # Test different methods to /chat
        methods = ['GET', 'POST', 'PUT', 'DELETE']
        
        for method in methods:
            try:
                response = self.session.request(
                    method,
                    f"{self.base_url}/chat",
                    headers={"Content-Type": "application/json"}
                )
                print(f"   {method}: {response.status_code}")
            except Exception as e:
                print(f"   {method}: Error - {e}")

def main():
    """Main debug execution"""
    print("🔍 Starting Chat Endpoint Debug...")
    print("This will identify why /chat is accessible after logout")
    print("\nMake sure your Flask app is running on http://localhost:5000")
    
    input("\nPress Enter to continue...")
    
    debugger = ChatEndpointDebugger()
    
    # Test the specific issue
    chat_secure = debugger.debug_chat_endpoint()
    
    # Additional tests
    no_session_secure = debugger.test_with_no_session()
    
    # Inspect endpoint
    debugger.inspect_chat_endpoint_structure()
    
    print("\n" + "=" * 60)
    print("📊 DEBUG RESULTS SUMMARY")
    print("=" * 60)
    
    if chat_secure and no_session_secure:
        print("🎉 Chat endpoint is properly secured!")
        print("   The previous test may have been a false positive")
    elif not chat_secure:
        print("🚨 CRITICAL SECURITY ISSUE FOUND!")
        print("   Chat endpoint allows access after logout")
        print("   This needs immediate fixing!")
    elif not no_session_secure:
        print("⚠️  Chat endpoint allows access without authentication")
        print("   Missing or broken auth decorator!")
    
    return 0 if (chat_secure and no_session_secure) else 1

if __name__ == "__main__":
    exit(main())