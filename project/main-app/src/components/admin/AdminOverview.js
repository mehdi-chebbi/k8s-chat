import React, { useState, useEffect } from 'react';
import { Database, Shield, Cpu, Activity, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw, Zap, Globe, Clock, Server, Info } from 'lucide-react';
import { apiService } from '../../services/apiService';

const AdminOverview = ({ user, onError }) => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const result = await apiService.getHealth();
      if (result.success) {
        setHealth(result.data);
      } else {
        onError('Failed to load health data');
      }
    } catch (error) {
      onError('Error loading health data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getStatusIcon = (status, type = 'default') => {
    if (status === 'healthy' || status === 'connected') {
      return <CheckCircle className="w-5 h-5 text-k8s-green" />;
    } else if (status === 'no_active_kubeconfig') {
      return <AlertCircle className="w-5 h-5 text-k8s-gray" />;
    } else {
      return <XCircle className="w-5 h-5 text-k8s-red" />;
    }
  };

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'connected') return 'text-k8s-green';
    if (status === 'no_active_kubeconfig') return 'text-k8s-gray';
    if (status === 'degraded') return 'text-k8s-orange';
    return 'text-k8s-red';
  };

  if (loading && !health) {
    return (
      <div className="space-y-4">
        {/* Loading State */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-k8s-blue/10 via-k8s-cyan/10 to-transparent rounded-2xl blur-xl"></div>
          <div className="relative k8s-card p-6">
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 text-k8s-blue animate-spin" />
              <span className="text-k8s-gray text-sm">Loading system overview...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-blue/10 via-k8s-cyan/10 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-k8s-blue/20 rounded-lg border border-k8s-blue/30">
                  <Activity className="w-5 h-5 text-k8s-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">System Overview</h2>
                  <p className="text-xs text-k8s-gray mt-0.5">Real-time health status and system metrics</p>
                </div>
              </div>
            </div>
            <button
              onClick={loadHealth}
              className="k8s-button-secondary flex items-center gap-2 px-4 py-2 text-sm transition-all duration-300 hover:scale-105"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </>
              )}
            </button>
          </div>

          {/* Stats Bar */}
          {health && (
            <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-k8s-blue/20">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  health.status === 'healthy' ? 'bg-k8s-green/10' : 'bg-k8s-red/10'
                }`}>
                  {health.status === 'healthy' ? (
                    <CheckCircle className="w-4 h-4 text-k8s-green" />
                  ) : (
                    <XCircle className="w-4 h-4 text-k8s-red" />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${getStatusColor(health.status)}`}>
                    {health.status?.charAt(0).toUpperCase() + health.status?.slice(1)}
                  </p>
                  <p className="text-xs text-k8s-gray">System Status</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  health.database?.status === 'healthy' ? 'bg-k8s-green/10' : 'bg-k8s-red/10'
                }`}>
                  {health.database?.status === 'healthy' ? (
                    <Database className="w-4 h-4 text-k8s-green" />
                  ) : (
                    <Database className="w-4 h-4 text-k8s-red" />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${getStatusColor(health.database?.status)}`}>
                    {health.database?.status === 'healthy' ? 'OK' : 'Error'}
                  </p>
                  <p className="text-xs text-k8s-gray">Database</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  health.kubernetes?.status === 'connected' ? 'bg-k8s-green/10' :
                  health.kubernetes?.status === 'no_active_kubeconfig' ? 'bg-k8s-gray/10' :
                  'bg-k8s-red/10'
                }`}>
                  {health.kubernetes?.status === 'connected' ? (
                    <Globe className="w-4 h-4 text-k8s-green" />
                  ) : health.kubernetes?.status === 'no_active_kubeconfig' ? (
                    <Shield className="w-4 h-4 text-k8s-gray" />
                  ) : (
                    <XCircle className="w-4 h-4 text-k8s-red" />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${getStatusColor(health.kubernetes?.status)}`}>
                    {health.kubernetes?.status === 'connected' ? 'Connected' :
                     health.kubernetes?.status === 'no_active_kubeconfig' ? 'No Config' : 'Error'}
                  </p>
                  <p className="text-xs text-k8s-gray">Kubernetes</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  health.classifier?.status === 'healthy' ? 'bg-k8s-purple/10' : 'bg-k8s-red/10'
                }`}>
                  {health.classifier?.status === 'healthy' ? (
                    <Cpu className="w-4 h-4 text-k8s-purple" />
                  ) : (
                    <XCircle className="w-4 h-4 text-k8s-red" />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${getStatusColor(health.classifier?.status)}`}>
                    {health.classifier?.status === 'healthy' ? 'Ready' : 'Error'}
                  </p>
                  <p className="text-xs text-k8s-gray">AI Classifier</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {health ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Database Card */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              health.database?.status === 'healthy' 
                ? 'from-k8s-green/10 via-green-500/5 to-transparent' 
                : 'from-k8s-red/10 via-red-500/5 to-transparent'
            } rounded-2xl blur-xl`}></div>
            <div className="relative k8s-card p-5 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    health.database?.status === 'healthy'
                      ? 'bg-k8s-green/20 border-k8s-green/30'
                      : 'bg-k8s-red/20 border-k8s-red/30'
                  }`}>
                    <Database className="w-6 h-6 text-k8s-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Database</h3>
                    <p className={`text-xs font-medium ${getStatusColor(health.database?.status)}`}>
                      {health.database?.status === 'healthy' ? 'All systems operational' : 'Connection issues detected'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(health.database?.status)}
              </div>

              {health.database?.stats && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-k8s-dark/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{health.database.stats.users || 0}</p>
                    <p className="text-xs text-k8s-gray">Users</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{health.database.stats.sessions || 0}</p>
                    <p className="text-xs text-k8s-gray">Sessions</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kubernetes Card */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              health.kubernetes?.status === 'connected'
                ? 'from-k8s-cyan/10 via-cyan-500/5 to-transparent'
                : health.kubernetes?.status === 'no_active_kubeconfig'
                ? 'from-k8s-gray/10 via-gray-500/5 to-transparent'
                : 'from-k8s-red/10 via-red-500/5 to-transparent'
            } rounded-2xl blur-xl`}></div>
            <div className="relative k8s-card p-5 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    health.kubernetes?.status === 'connected'
                      ? 'bg-k8s-cyan/20 border-k8s-cyan/30'
                      : health.kubernetes?.status === 'no_active_kubeconfig'
                      ? 'bg-k8s-gray/20 border-k8s-gray/30'
                      : 'bg-k8s-red/20 border-k8s-red/30'
                  }`}>
                    <Globe className="w-6 h-6 text-k8s-cyan" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Kubernetes</h3>
                    <p className={`text-xs font-medium ${getStatusColor(health.kubernetes?.status)}`}>
                      {health.kubernetes?.status === 'connected' ? 'Cluster connection active' :
                       health.kubernetes?.status === 'no_active_kubeconfig' ? 'No active configuration' :
                       health.kubernetes?.status === 'cluster_error' ? 'Connection failed' :
                       'Connection unavailable'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(health.kubernetes?.status)}
              </div>

              {health.kubernetes?.kubeconfig && health.kubernetes.kubeconfig !== 'none' ? (
                <div className="p-3 bg-k8s-dark/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-k8s-cyan" />
                    <p className="text-xs font-semibold text-white">Active Configuration</p>
                  </div>
                  <p className="text-sm text-white font-medium truncate">{health.kubernetes.kubeconfig}</p>
                </div>
              ) : health.kubernetes?.status === 'no_active_kubeconfig' ? (
                <div className="p-3 bg-k8s-gray/10 border border-k8s-gray/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-k8s-gray flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">No Active Kubeconfig</p>
                      <p className="text-xs text-k8s-gray mt-1">Please add and activate a kubeconfig in the Kubeconfigs tab</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* AI Classifier Card */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              health.classifier?.status === 'healthy'
                ? 'from-k8s-purple/10 via-purple-500/5 to-transparent'
                : 'from-k8s-red/10 via-red-500/5 to-transparent'
            } rounded-2xl blur-xl`}></div>
            <div className="relative k8s-card p-5 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    health.classifier?.status === 'healthy'
                      ? 'bg-k8s-purple/20 border-k8s-purple/30'
                      : 'bg-k8s-red/20 border-k8s-red/30'
                  }`}>
                    <Cpu className="w-6 h-6 text-k8s-purple" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AI Classifier</h3>
                    <p className={`text-xs font-medium ${getStatusColor(health.classifier?.status)}`}>
                      {health.classifier?.status === 'healthy' ? 'Question classification ready' : 'Classifier unavailable'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(health.classifier?.status)}
              </div>

              {health.classifier?.status === 'healthy' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-k8s-gray">
                    <Zap className="w-3.5 h-3.5 text-k8s-purple" />
                    <span>Intent classification enabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-k8s-gray">
                    <Shield className="w-3.5 h-3.5 text-k8s-purple" />
                    <span>Security verification active</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Status Card */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              health.status === 'healthy'
                ? 'from-k8s-blue/10 via-blue-500/5 to-transparent'
                : 'from-k8s-red/10 via-red-500/5 to-transparent'
            } rounded-2xl blur-xl`}></div>
            <div className="relative k8s-card p-5 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    health.status === 'healthy'
                      ? 'bg-k8s-blue/20 border-k8s-blue/30'
                      : 'bg-k8s-red/20 border-k8s-red/30'
                  }`}>
                    <Activity className="w-6 h-6 text-k8s-blue" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">System Status</h3>
                    <p className={`text-xs font-medium ${getStatusColor(health.status)}`}>
                      {health.status === 'healthy' ? 'All services running normally' : 'Service degradation detected'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(health.status)}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-k8s-dark/30 rounded-lg">
                  <span className="text-xs text-k8s-gray">Version</span>
                  <span className="text-sm font-medium text-white">{health.version || 'v0.1'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="k8s-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-k8s-red/10 rounded-full border border-k8s-red/20">
              <AlertCircle className="w-12 h-12 text-k8s-red" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Unable to Load Health Data</h3>
              <p className="text-k8s-gray text-sm mt-1">There was an error fetching the system status</p>
            </div>
            <button
              onClick={loadHealth}
              className="k8s-button-primary flex items-center gap-2 px-6 py-2.5"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
