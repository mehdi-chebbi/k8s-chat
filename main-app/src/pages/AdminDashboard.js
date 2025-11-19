import React, { useState } from 'react';
import { LogOut, Cpu, AlertCircle, Network, Users, FolderOpen, Activity, Key } from 'lucide-react';

// Import the extracted components
import AdminOverview from '../components/admin/AdminOverview';
import UserManagement from '../components/admin/UserManagement';
import KubeconfigManagement from '../components/admin/KubeconfigManagement';
import ActivityLogs from '../components/admin/ActivityLogs';
import ApiKeyManagement from '../components/admin/ApiKeyManagement';

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState('');

  const handleError = (errorMessage) => {
    setError(errorMessage);
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(''), 5000);
  };

  const handleHealthUpdate = () => {
    // Force overview tab to refresh health data
    if (activeTab === 'overview') {
      setActiveTab('overview');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Cpu },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'kubeconfigs', label: 'Kubeconfigs', icon: FolderOpen },
    { id: 'logs', label: 'Logs', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Key }
  ];

  return (
    <div className="k8s-container min-h-screen">
      {/* Header */}
      <div className="k8s-glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Cpu className="w-8 h-8 text-k8s-blue" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-k8s-gray text-sm">Welcome back, {user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/topology"
                className="k8s-button-secondary flex items-center gap-2"
              >
                <Network className="w-4 h-4" />
                Topology
              </a>
              <button
                onClick={onLogout}
                className="k8s-button-secondary flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="k8s-card p-4 border-red-500/30 bg-red-500/10 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-8 bg-k8s-dark/30 p-1 rounded-lg w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-k8s-blue text-white'
                    : 'text-k8s-gray hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content - Lazy loaded components */}
        {activeTab === 'overview' && (
          <AdminOverview 
            user={user} 
            onError={handleError}
          />
        )}
        {activeTab === 'users' && (
          <UserManagement 
            user={user}
            onError={handleError}
          />
        )}
        {activeTab === 'kubeconfigs' && (
          <KubeconfigManagement 
            user={user}
            onError={handleError}
            onHealthUpdate={handleHealthUpdate}
          />
        )}
        {activeTab === 'logs' && (
          <ActivityLogs 
            onError={handleError}
          />
        )}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-6">Settings</h2>
            
            {/* API Keys Section */}
            <ApiKeyManagement 
              user={user}
              onError={handleError}
            />

            {/* Quick Kubeconfig Overview */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-k8s-cyan" />
                  Quick Kubeconfig Access
                </h3>
                <button
                  onClick={() => setActiveTab('kubeconfigs')}
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  Manage Kubeconfigs
                </button>
              </div>
              <div className="k8s-card p-6 text-center">
                <p className="text-k8s-gray">
                  For full kubeconfig management, switch to the Kubeconfigs tab above.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;