import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Cpu } from 'lucide-react';

// Components
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import TopologyPage from './pages/TopologyPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (session is in HttpOnly cookie)
    const userData = localStorage.getItem('userData');
    
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('userData');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // Store only non-sensitive user data
    localStorage.setItem('userData', JSON.stringify(userData));
    // Session ID is handled by HttpOnly cookie - no localStorage needed
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('userData');
    // Session cookie will be cleared by backend logout endpoint
  };

  if (loading) {
    return (
      <div className="k8s-container flex items-center justify-center">
        <div className="text-center">
          <Cpu className="k8s-logo-animation w-16 h-16 text-k8s-blue mx-auto mb-4" />
          <div className="k8s-loader mx-auto"></div>
          <p className="text-k8s-gray mt-4">Initializing K8s Smart Bot...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="k8s-container">
        <Routes>
          <Route 
            path="/" 
            element={
              user ? (
                user.role === 'admin' ? 
                <Navigate to="/admin/dashboard" replace /> : 
                <Navigate to="/user/dashboard" replace />
              ) : 
              <LandingPage />
            } 
          />
          <Route 
            path="/login" 
            element={
              user ? (
                user.role === 'admin' ? 
                <Navigate to="/admin/dashboard" replace /> : 
                <Navigate to="/user/dashboard" replace />
              ) : 
              <LoginPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/signup" 
            element={
              user ? (
                user.role === 'admin' ? 
                <Navigate to="/admin/dashboard" replace /> : 
                <Navigate to="/user/dashboard" replace />
              ) : 
              <SignUpPage />
            } 
          />
          <Route 
            path="/admin/dashboard" 
            element={
              user && user.role === 'admin' ? 
              <AdminDashboard user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/user/dashboard" 
            element={
              user && user.role === 'user' ? 
              <UserDashboard user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/topology" 
            element={
              user ? 
              <TopologyPage user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;