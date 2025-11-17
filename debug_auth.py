#!/usr/bin/env python3
"""
Quick debug test for authentication
"""

import requests
import json

def test_auth():
    base_url = "http://localhost:5000"
    
    print("🧪 Quick Authentication Debug Test")
    print("="*50)
    
    # 1. Test login
    print("1. Testing login...")
    login_data = {"username": "admin", "password": "admin123"}
    response = requests.post(f"{base_url}/auth/login", json=login_data)
    
    print(f"Login Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        session_id = data.get('session_id')
        print(f"Session ID: {session_id}")
        print(f"User role: {data.get('user', {}).get('role')}")
        
        # 2. Test admin endpoint with session
        print("\n2. Testing admin endpoint with session...")
        headers = {"X-Session-ID": session_id}
        print(f"Headers: {headers}")
        
        response = requests.get(f"{base_url}/admin/users", headers=headers)
        print(f"Admin endpoint Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        # 3. Test with curl-like headers
        print("\n3. Testing with different header format...")
        headers2 = {"X-Session-ID": session_id, "Content-Type": "application/json"}
        response2 = requests.get(f"{base_url}/admin/users", headers=headers2)
        print(f"With Content-Type - Status: {response2.status_code}")
        
    else:
        print(f"Login failed: {response.text}")

if __name__ == "__main__":
    test_auth()