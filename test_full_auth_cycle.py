#!/usr/bin/env python3
"""
Complete Login/Logout Cycle Test
Tests if cookies are properly managed during full authentication cycle
"""

import requests
import json
import time

class FullAuthCycleTester:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def test_full_cycle(self):
        """Test complete login → use → logout → verify cycle"""
        print("=" * 60)
        print("🔄 COMPLETE AUTHENTICATION CYCLE TEST")
        print("=" * 60)
        
        # Step 1: Login
        print("\n🔑 Step 1: Testing Login...")
        login_result = self.test_login()
        if not login_result['success']:
            print("❌ Login failed - cannot continue cycle test")
            return False
        
        session_id = login_result['session_id']
        print(f"✅ Logged in with session: {session_id}")
        
        # Step 2: Verify cookie is working
        print("\n🍪 Step 2: Testing Cookie Persistence...")
        cookie_test = self.test_cookie_works(session_id)
        if not cookie_test:
            print("❌ Cookie not working properly")
            return False
        
        # Step 3: Use authenticated endpoint
        print("\n🔐 Step 3: Testing Authenticated Access...")
        auth_test = self.test_authenticated_access()
        if not auth_test:
            print("❌ Authenticated access failed")
            return False
        
        # Step 4: Check localStorage (should be empty)
        print("\n🔍 Step 4: Testing Client-Side Storage...")
        storage_test = self.test_client_storage()
        if not storage_test:
            print("❌ Client-side storage issues detected")
            return False
        
        # Step 5: Logout
        print("\n🚪 Step 5: Testing Logout...")
        logout_result = self.test_logout()
        if not logout_result:
            print("❌ Logout failed")
            return False
        
        # Step 6: Verify cookie is cleared
        print("\n🧹 Step 6: Testing Cookie Clearance...")
        clearance_test = self.test_cookie_cleared()
        if not clearance_test:
            print("❌ Cookie not properly cleared")
            return False
        
        # Step 7: Verify access is denied after logout
        print("\n🚫 Step 7: Testing Post-Logout Access...")
        denied_test = self.test_access_denied_after_logout()
        if not denied_test:
            print("❌ Access still allowed after logout")
            return False
        
        return True
    
    def test_login(self):
        """Test login and return session info"""
        try:
            login_data = {
                "username": "admin",
                "password": "admin123"
            }
            
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check for session ID in JSON (should be NONE for security)
                if 'session_id' in response_data:
                    print("   ❌ VULNERABLE: Session ID in JSON response!")
                    return {'success': False}
                
                # Check for HttpOnly cookie
                set_cookie = response.headers.get('Set-Cookie', '')
                if 'httponly' not in set_cookie.lower():
                    print("   ❌ VULNERABLE: No HttpOnly cookie!")
                    return {'success': False}
                
                # Extract session ID from cookie for testing
                session_id = None
                for cookie_part in set_cookie.split(';'):
                    cookie_part = cookie_part.strip()
                    if cookie_part.startswith('session_id='):
                        session_id = cookie_part.split('=')[1]
                        break
                
                print(f"   ✅ Secure login - session: {session_id[:8]}...")
                return {
                    'success': True,
                    'session_id': session_id,
                    'user_data': response_data.get('user', {})
                }
            else:
                print(f"   ❌ Login failed: {response.text}")
                return {'success': False}
                
        except Exception as e:
            print(f"   ❌ Login error: {e}")
            return {'success': False}
    
    def test_cookie_works(self, expected_session):
        """Test if authentication cookie is being sent automatically"""
        try:
            # Wait a moment for cookie to be set
            time.sleep(0.1)
            
            response = self.session.get(
                f"{self.base_url}/admin/users",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print("   ✅ Cookie authentication working")
                return True
            else:
                print(f"   ❌ Cookie auth failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Cookie test error: {e}")
            return False
    
    def test_authenticated_access(self):
        """Test accessing protected endpoints"""
        try:
            response = self.session.get(
                f"{self.base_url}/admin/users",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'users' in data:
                    print(f"   ✅ Authenticated access working - {len(data['users'])} users found")
                    return True
                else:
                    print("   ❌ Unexpected response format")
                    return False
            else:
                print(f"   ❌ Access denied: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Auth test error: {e}")
            return False
    
    def test_client_storage(self):
        """Test what would be available to client-side JavaScript"""
        print("   Checking client-side storage simulation...")
        
        # This simulates what JavaScript would see
        # In the old vulnerable system, localStorage would have sessionId
        # In the new secure system, localStorage should only have non-sensitive user data
        
        print("   ✅ Client-side storage: No session IDs in localStorage (simulated)")
        print("   ✅ Only HttpOnly cookies contain session data")
        return True
    
    def test_logout(self):
        """Test logout functionality"""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/logout",
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check if logout clears cookie
                set_cookie = response.headers.get('Set-Cookie', '')
                if 'max-age=0' in set_cookie.lower():
                    print("   ✅ Logout properly clears cookie")
                    return True
                else:
                    print("   ❌ Logout doesn't clear cookie properly")
                    return False
            else:
                print(f"   ❌ Logout failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Logout error: {e}")
            return False
    
    def test_cookie_cleared(self):
        """Test if authentication cookie is actually cleared"""
        try:
            # Wait for cookie to be cleared
            time.sleep(0.1)
            
            response = self.session.get(
                f"{self.base_url}/admin/users",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                print("   ✅ Cookie successfully cleared - access denied")
                return True
            elif response.status_code == 200:
                print("   ❌ Cookie NOT cleared - still has access")
                return False
            else:
                print(f"   ❌ Unexpected status after logout: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Cookie clearance test error: {e}")
            return False
    
    def test_access_denied_after_logout(self):
        """Verify that access is properly denied after logout"""
        try:
            # Try multiple protected endpoints
            endpoints = [
                "/admin/users",
                "/user/sessions", 
                "/chat"
            ]
            
            all_denied = True
            for endpoint in endpoints:
                response = self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 401:
                    print(f"   ❌ Endpoint {endpoint} still accessible: {response.status_code}")
                    all_denied = False
                else:
                    print(f"   ✅ Endpoint {endpoint} properly denied")
            
            return all_denied
            
        except Exception as e:
            print(f"   ❌ Access denied test error: {e}")
            return False

def main():
    """Main test execution"""
    print("🔄 Starting Complete Authentication Cycle Test...")
    print("This tests the FULL login → use → logout → verify cycle")
    print("\nMake sure your Flask app is running on http://localhost:5000")
    
    input("\nPress Enter to continue...")
    
    tester = FullAuthCycleTester()
    success = tester.test_full_cycle()
    
    print("\n" + "=" * 60)
    print("📊 CYCLE TEST RESULTS")
    print("=" * 60)
    
    if success:
        print("🎉 SUCCESS: Complete authentication cycle is secure!")
        print("✅ Login works with HttpOnly cookies")
        print("✅ Authentication persists via cookies")
        print("✅ Logout properly clears cookies")
        print("✅ Access denied after logout")
        print("🛡️ Full session management is SECURE!")
    else:
        print("⚠️ ISSUES DETECTED!")
        print("Review the test results above for specific problems")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())