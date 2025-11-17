import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Cpu, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

const LoginPage = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await authService.login(formData.username, formData.password);
      
      if (result.success) {
        onLogin(result.user); // No sessionId parameter needed - it's in HttpOnly cookie
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="k8s-container min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-6">
            <Cpu className="w-16 h-16 text-k8s-blue k8s-logo-animation" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-k8s-cyan rounded-full animate-k8s-pulse"></div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-k8s-gray">Sign in to access your K8s Smart Bot</p>
        </div>

        {/* Login Form */}
        <div className="k8s-card p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-k8s-gray mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none k8s-icon-container">
                  <User className="w-5 h-5 text-k8s-gray/50" />
                </div>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="k8s-input k8s-input-with-icon w-full"
                  placeholder="Username"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-k8s-gray mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none k8s-icon-container">
                  <Lock className="w-5 h-5 text-k8s-gray/50" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="k8s-input k8s-input-with-icon k8s-input-with-eye w-full"
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-k8s-gray/50 hover:text-k8s-cyan transition-colors k8s-icon-container"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="k8s-button-primary w-full flex items-center justify-center gap-3 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-k8s-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <Cpu className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Default Credentials Info */}
        <div className="mt-6 text-center">
          <div className="k8s-glass p-4 rounded-lg inline-block">
            <p className="text-k8s-gray text-sm mb-2">Default Admin Credentials:</p>
            <p className="text-white font-mono">Username: <span className="text-k8s-cyan">admin</span></p>
            <p className="text-white font-mono">Password: <span className="text-k8s-cyan">admin123</span></p>
            <p className="text-k8s-orange text-xs mt-2">⚠️ Please change the default password after first login</p>
          </div>
        </div>

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="text-k8s-gray">
            Don't have an account?{' '}
            <a
              href="/signup"
              className="text-k8s-cyan hover:text-k8s-blue font-medium transition-colors duration-200"
            >
              Create Account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;