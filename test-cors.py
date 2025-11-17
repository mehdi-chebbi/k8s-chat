#!/usr/bin/env python3

"""
Simple test script to verify CORS configuration
"""

import requests
import json

def test_cors():
    """Test CORS configuration"""
    
    # Test health endpoint (no auth required)
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        print(f"✅ Health endpoint: {response.status_code}")
        if 'Access-Control-Allow-Credentials' in response.headers:
            print(f"✅ CORS Credentials: {response.headers['Access-Control-Allow-Credentials']}")
        else:
            print("❌ Missing Access-Control-Allow-Credentials header")
    except requests.exceptions.ConnectionError:
        print("❌ Backend not running - start with: python app.py")
    except Exception as e:
        print(f"❌ Health test failed: {e}")
    
    # Test topology endpoint (requires auth)
    try:
        response = requests.get(
            'http://localhost:5000/topology/nodes', 
            timeout=5,
            headers={
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            }
        )
        print(f"✅ Topology endpoint: {response.status_code}")
        if response.status_code == 401:
            print("✅ Auth required (expected)")
    except Exception as e:
        print(f"❌ Topology test failed: {e}")

if __name__ == "__main__":
    print("🔍 Testing CORS Configuration...")
    print("=" * 40)
    test_cors()
    print("=" * 40)
    print("📝 If CORS tests pass, your topology should work!")
    print("🚀 Start frontend: cd main-app && npm start")
    print("🎯 Visit: http://localhost:3000/topology")