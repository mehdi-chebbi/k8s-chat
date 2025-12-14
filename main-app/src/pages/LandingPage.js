import React from 'react';
import { ArrowRight, Cpu, Shield, Zap, Database, Cloud, Terminal, Users, LogIn } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="k8s-container min-h-screen flex items-center justify-center px-4">
      <div className="max-w-6xl mx-auto text-center">
        {/* Header Section */}
        <div className="mb-16">
          <div className="flex justify-center items-center mb-8">
            <div className="relative">
              <Cpu className="w-20 h-20 text-k8s-blue k8s-logo-animation" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-k8s-cyan rounded-full animate-k8s-pulse"></div>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Looking for an AI to help you
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-k8s-blue to-k8s-cyan">
              investigate your infrastructure?
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-k8s-gray mb-8 max-w-3xl mx-auto">
            You are in the right place. K8s Smart Bot is your intelligent Kubernetes assistant 
            that provides real-time insights, automated troubleshooting, and infrastructure management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => window.location.href = '/login'}
              className="k8s-button-primary flex items-center gap-3 text-lg px-8 py-4"
            >
              <LogIn className="w-5 h-5" />
              Sign In
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.location.href = '/signup'}
              className="k8s-button-secondary flex items-center gap-3 text-lg px-8 py-4 border border-k8s-cyan/50 hover:border-k8s-cyan"
            >
              <Users className="w-5 h-5" />
              Create Account
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-blue/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Shield className="w-6 h-6 text-k8s-blue" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Intelligent Analysis</h3>
            <p className="text-k8s-gray leading-relaxed">
              AI-powered analysis of your Kubernetes clusters with smart classification and automated problem detection.
            </p>
          </div>

          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-cyan/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Zap className="w-6 h-6 text-k8s-cyan" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Real-time Monitoring</h3>
            <p className="text-k8s-gray leading-relaxed">
              Live monitoring of pods, deployments, and services with instant alerts and performance metrics.
            </p>
          </div>

          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-orange/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Terminal className="w-6 h-6 text-k8s-orange" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Natural Language</h3>
            <p className="text-k8s-gray leading-relaxed">
              Interact with your infrastructure using plain English. No complex kubectl commands required.
            </p>
          </div>

          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-green/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Database className="w-6 h-6 text-k8s-green" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Secure & Audited</h3>
            <p className="text-k8s-gray leading-relaxed">
              Enterprise-grade security with full audit trails, user management, and role-based access control.
            </p>
          </div>

          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-purple/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Cloud className="w-6 h-6 text-k8s-purple" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Multi-Cluster Support</h3>
            <p className="text-k8s-gray leading-relaxed">
              Manage multiple Kubernetes clusters from a single interface with unified monitoring and control.
            </p>
          </div>

          <div className="k8s-card p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 bg-k8s-yellow/20 rounded-lg flex items-center justify-center mb-6 mx-auto">
              <Cpu className="w-6 h-6 text-k8s-yellow" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Smart Automation</h3>
            <p className="text-k8s-gray leading-relaxed">
              Automated responses to common issues with intelligent suggestions and proactive problem resolution.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-k8s-gray/60 text-sm">
            Powered by Kubernetes AI • Production-ready infrastructure intelligence
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;