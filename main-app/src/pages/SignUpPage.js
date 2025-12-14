import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Shield, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

const SignUpPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await authService.signup({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      
      if (response.success) {
        setSignupSuccess(true);
      } else {
        setErrors({ general: response.error || 'Sign up failed. Please try again.' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (signupSuccess) {
    return (
      <div className="k8s-container min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Account Created!</h2>
            <p className="text-k8s-gray">Your account has been created successfully</p>
          </div>
          
          <div className="k8s-card p-8 text-center">
            <p className="text-k8s-gray mb-6">
              You can now sign in with your new credentials.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="k8s-button-primary flex items-center justify-center gap-3 text-lg px-8 py-4 mx-auto"
            >
              Go to Sign In
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="k8s-container min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-6">
            <Shield className="w-16 h-16 text-k8s-blue k8s-logo-animation" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-k8s-cyan rounded-full animate-k8s-pulse"></div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-k8s-gray">Join the Kubernetes Smart Bot</p>
        </div>

        {/* Sign Up Form */}
        <div className="k8s-card p-8">
          {/* General Error */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{errors.general}</span>
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
                  className={`k8s-input k8s-input-with-icon w-full ${errors.username ? 'border-red-500/50' : ''}`}
                  placeholder="Username"
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-red-400 text-xs">{errors.username}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-k8s-gray mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none k8s-icon-container">
                  <Mail className="w-5 h-5 text-k8s-gray/50" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`k8s-input k8s-input-with-icon w-full ${errors.email ? 'border-red-500/50' : ''}`}
                  placeholder="Email"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-red-400 text-xs">{errors.email}</p>
              )}
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
                  className={`k8s-input k8s-input-with-icon k8s-input-with-eye w-full ${errors.password ? 'border-red-500/50' : ''}`}
                  placeholder="Password"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-k8s-gray/50 hover:text-k8s-cyan transition-colors k8s-icon-container"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-red-400 text-xs">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-k8s-gray mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none k8s-icon-container">
                  <Lock className="w-5 h-5 text-k8s-gray/50" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`k8s-input k8s-input-with-icon k8s-input-with-eye w-full ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-k8s-gray/50 hover:text-k8s-cyan transition-colors k8s-icon-container"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-red-400 text-xs">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="k8s-button-primary w-full flex items-center justify-center gap-3 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-k8s-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <Shield className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign In Link */}
        <div className="mt-6 text-center">
          <p className="text-k8s-gray">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-k8s-cyan hover:text-k8s-blue font-medium transition-colors duration-200"
            >
              Sign In
            </a>
          </p>
        </div>

        {/* Password Requirements */}
        <div className="mt-6 text-center">
          <div className="k8s-glass p-4 rounded-lg inline-block">
            <p className="text-k8s-gray text-sm mb-2">Password Requirements:</p>
            <ul className="text-k8s-gray text-xs space-y-1 text-left">
              <li>• At least 6 characters long</li>
              <li>• Contains uppercase and lowercase letters</li>
              <li>• Contains at least one number</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;