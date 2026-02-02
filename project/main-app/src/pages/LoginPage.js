import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Cpu, AlertCircle, Loader2, Sparkles, Shield, ArrowRight } from 'lucide-react';
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
        onLogin(result.user);
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
    <div className="k8s-container min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-k8s-blue/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-k8s-cyan/10 rounded-full blur-3xl animate-float-delay"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-k8s-blue/5 rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10 animate-fadeIn">
        {/* Logo Section */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-k8s-blue to-k8s-cyan rounded-2xl blur-xl opacity-50 animate-pulse-slow"></div>
              <div className="relative bg-k8s-dark/50 backdrop-blur-sm p-4 rounded-2xl border-2 border-k8s-blue/30">
                <Cpu className="w-12 h-12 text-k8s-cyan k8s-logo-animation" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 flex gap-1">
              <Sparkles className="w-4 h-4 text-k8s-cyan animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1.5 tracking-tight">Welcome Back</h1>
          <p className="text-sm text-k8s-gray flex items-center justify-center gap-1.5">
            <Shield className="w-4 h-4 text-k8s-cyan" />
            Sign in to access your KubeMate
          </p>
        </div>

        {/* Login Form Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-k8s-blue/20 via-k8s-cyan/10 to-transparent rounded-2xl blur-xl"></div>
          <div className="relative k8s-card p-6 border-2 border-k8s-blue/20 hover:border-k8s-blue/30 transition-all duration-300">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 rounded-lg flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-xs mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-xs font-semibold text-white flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-k8s-cyan" />
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-k8s-gray/50 group-focus-within:text-k8s-cyan transition-colors" />
                  </div>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="k8s-input k8s-input-with-icon w-full text-sm py-2.5 transition-all duration-200 focus:scale-[1.01] focus:border-k8s-cyan/50"
                    placeholder="Enter your username"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-k8s-cyan" />
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-k8s-gray/50 group-focus-within:text-k8s-cyan transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="k8s-input k8s-input-with-icon k8s-input-with-eye w-full text-sm py-2.5 transition-all duration-200 focus:scale-[1.01] focus:border-k8s-cyan/50"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-k8s-gray/50 hover:text-k8s-cyan transition-all duration-200 hover:scale-110"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="k8s-button-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 mt-6 shadow-lg shadow-k8s-blue/30 hover:shadow-k8s-blue/50 transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-k8s-cyan/0 via-k8s-cyan/20 to-k8s-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-k8s-blue/20"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-k8s-dark text-k8s-gray">Secure Authentication</span>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-k8s-blue/5 rounded-lg border border-k8s-blue/10 hover:border-k8s-blue/30 transition-colors">
                <Shield className="w-4 h-4 text-k8s-cyan mx-auto mb-1" />
                <p className="text-xs text-k8s-gray">Secure</p>
              </div>
              <div className="p-2 bg-k8s-blue/5 rounded-lg border border-k8s-blue/10 hover:border-k8s-blue/30 transition-colors">
                <Cpu className="w-4 h-4 text-k8s-cyan mx-auto mb-1" />
                <p className="text-xs text-k8s-gray">Fast</p>
              </div>
              <div className="p-2 bg-k8s-blue/5 rounded-lg border border-k8s-blue/10 hover:border-k8s-blue/30 transition-colors">
                <Sparkles className="w-4 h-4 text-k8s-cyan mx-auto mb-1" />
                <p className="text-xs text-k8s-gray">Smart</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Up Link */}
        <div className="mt-5 text-center">
          <p className="text-xs text-k8s-gray">
            Don't have an account?{' '}
            <a
              href="/signup"
              className="text-k8s-cyan hover:text-k8s-blue font-semibold transition-all duration-200 hover:underline inline-flex items-center gap-1 group"
            >
              Create Account
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-k8s-gray/50">
            © 2024 KubeMate. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-20px) scale(1.05);
          }
        }

        @keyframes float-delay {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(20px) scale(1.05);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-float-delay {
          animation: float-delay 10s ease-in-out infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-shake {
          animation: shake 0.3s ease-out;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;