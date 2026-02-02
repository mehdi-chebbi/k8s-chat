import React from 'react';
import { ArrowRight, Cpu, Shield, Zap, Database, Cloud, Terminal, Users, LogIn, Sparkles, CheckCircle, Star } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="k8s-container min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-k8s-blue/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-k8s-cyan/10 rounded-full blur-3xl animate-float-delay"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-k8s-purple/5 rounded-full blur-2xl animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-k8s-green/5 rounded-full blur-2xl animate-float-delay-2"></div>
      </div>

      <div className="max-w-6xl mx-auto text-center relative z-10">
        {/* Header Section */}
        <div className="mb-12 animate-fadeIn">
          <div className="flex justify-center items-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-k8s-blue to-k8s-cyan rounded-2xl blur-2xl opacity-50 animate-pulse-slow"></div>
              <div className="relative bg-k8s-dark/50 backdrop-blur-sm p-4 rounded-2xl border-2 border-k8s-blue/30">
                <Cpu className="w-16 h-16 text-k8s-cyan k8s-logo-animation" />
              </div>
              <div className="absolute -top-2 -right-2 flex gap-1">
                <Sparkles className="w-5 h-5 text-k8s-cyan animate-pulse" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            Looking for an AI to help you
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-k8s-blue via-k8s-cyan to-k8s-blue mt-2 animate-gradient">
              investigate your infrastructure?
            </span>
          </h1>
          
          <p className="text-base md:text-lg text-k8s-gray mb-6 max-w-2xl mx-auto leading-relaxed">
            You are in the right place. KubeMate is your intelligent Kubernetes assistant 
            that provides real-time insights, automated troubleshooting, and infrastructure management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
            <button
              onClick={() => window.location.href = '/login'}
              className="k8s-button-primary flex items-center gap-2 text-sm px-6 py-3 shadow-lg shadow-k8s-blue/30 hover:shadow-k8s-blue/50 transition-all duration-300 hover:scale-105 group"
            >
              <LogIn className="w-4 h-4" />
              Sign In
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => window.location.href = '/signup'}
              className="k8s-button-secondary flex items-center gap-2 text-sm px-6 py-3 border-2 border-k8s-cyan/30 hover:border-k8s-cyan/60 transition-all duration-300 hover:scale-105 group"
            >
              <Users className="w-4 h-4" />
              Create Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-k8s-gray/70">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-k8s-green" />
              <span>Production Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-k8s-cyan" />
              <span>Enterprise Security</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-k8s-yellow" />
              <span>AI-Powered</span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-blue/20 border border-k8s-blue/20 hover:border-k8s-blue/40 animate-slideUp group" style={{ animationDelay: '0ms' }}>
            <div className="w-12 h-12 bg-k8s-blue/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-blue/30 transition-colors border border-k8s-blue/30">
              <Shield className="w-6 h-6 text-k8s-blue" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Intelligent Analysis</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              AI-powered analysis of your Kubernetes clusters with smart classification and automated problem detection.
            </p>
          </div>

          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-cyan/20 border border-k8s-blue/20 hover:border-k8s-cyan/40 animate-slideUp group" style={{ animationDelay: '100ms' }}>
            <div className="w-12 h-12 bg-k8s-cyan/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-cyan/30 transition-colors border border-k8s-cyan/30">
              <Zap className="w-6 h-6 text-k8s-cyan" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Real-time Monitoring</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              Live monitoring of pods, deployments, and services with instant alerts and performance metrics.
            </p>
          </div>

          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-orange/20 border border-k8s-blue/20 hover:border-k8s-orange/40 animate-slideUp group" style={{ animationDelay: '200ms' }}>
            <div className="w-12 h-12 bg-k8s-orange/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-orange/30 transition-colors border border-k8s-orange/30">
              <Terminal className="w-6 h-6 text-k8s-orange" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Natural Language</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              Interact with your infrastructure using plain English. No complex kubectl commands required.
            </p>
          </div>

          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-green/20 border border-k8s-blue/20 hover:border-k8s-green/40 animate-slideUp group" style={{ animationDelay: '300ms' }}>
            <div className="w-12 h-12 bg-k8s-green/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-green/30 transition-colors border border-k8s-green/30">
              <Database className="w-6 h-6 text-k8s-green" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Secure & Audited</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              Enterprise-grade security with full audit trails, user management, and role-based access control.
            </p>
          </div>

          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-purple/20 border border-k8s-blue/20 hover:border-k8s-purple/40 animate-slideUp group" style={{ animationDelay: '400ms' }}>
            <div className="w-12 h-12 bg-k8s-purple/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-purple/30 transition-colors border border-k8s-purple/30">
              <Cloud className="w-6 h-6 text-k8s-purple" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multi-Cluster Support</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              Manage multiple Kubernetes clusters from a single interface with unified monitoring and control.
            </p>
          </div>

          <div className="k8s-card p-5 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-k8s-yellow/20 border border-k8s-blue/20 hover:border-k8s-yellow/40 animate-slideUp group" style={{ animationDelay: '500ms' }}>
            <div className="w-12 h-12 bg-k8s-yellow/20 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-k8s-yellow/30 transition-colors border border-k8s-yellow/30">
              <Cpu className="w-6 h-6 text-k8s-yellow" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Smart Automation</h3>
            <p className="text-sm text-k8s-gray leading-relaxed">
              Automated responses to common issues with intelligent suggestions and proactive problem resolution.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center animate-fadeIn">
          <p className="text-k8s-gray/60 text-xs mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3 text-k8s-cyan" />
            Powered by Kubernetes AI • Production-ready infrastructure intelligence
          </p>
          <p className="text-k8s-gray/40 text-xs">
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
            transform: translateY(-30px) scale(1.05);
          }
        }

        @keyframes float-delay {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(30px) scale(1.05);
          }
        }

        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(20px, -20px) scale(1.1);
          }
        }

        @keyframes float-delay-2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-20px, 20px) scale(1.1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
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

        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-float {
          animation: float 10s ease-in-out infinite;
        }

        .animate-float-delay {
          animation: float-delay 12s ease-in-out infinite;
        }

        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }

        .animate-float-delay-2 {
          animation: float-delay-2 13s ease-in-out infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;