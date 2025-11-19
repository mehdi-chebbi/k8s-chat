import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class AuthService {
  constructor() {
    // Create base API instance with credentials support
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // This sends HttpOnly cookies automatically
    });
  }

  async signup(userData) {
    try {
      const response = await this.api.post('/auth/signup', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
      });

      return {
        success: response.data.success,
        message: response.data.message,
        error: response.data.error,
        userId: response.data.user_id,
      };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed. Please try again.',
      };
    }
  }

  async login(username, password) {
    try {
      const response = await this.api.post('/auth/login', {
        username,
        password,
      });

      if (response.data.user) {
        // Store only non-sensitive user data in localStorage
        // Session ID is now stored in HttpOnly cookie
        localStorage.setItem('userData', JSON.stringify(response.data.user));
        
        return {
          success: true,
          user: response.data.user,
          // No sessionId returned - it's in HttpOnly cookie
        };
      }
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please try again.',
      };
    }
  }

  async logout() {
    try {
      // Call logout endpoint - cookie will be cleared by server
      await this.api.post('/auth/logout');
      
      // Clear local user data
      localStorage.removeItem('userData');
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local data even if API call fails
      localStorage.removeItem('userData');
      return { success: false, error: 'Logout failed' };
    }
  }

  isAuthenticated() {
    // Check if we have user data (session is in HttpOnly cookie)
    const userData = localStorage.getItem('userData');
    return !!userData;
  }

  getCurrentUser() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  }

  getSessionId() {
    // Session ID is now in HttpOnly cookie, not accessible via JavaScript
    // This method is kept for compatibility but returns null
    return null;
  }

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  }
}

export const authService = new AuthService();