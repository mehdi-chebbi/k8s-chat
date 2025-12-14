import React, { useState, useEffect } from 'react';
import { Database, Shield, Cpu, Activity, Loader2 } from 'lucide-react';
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
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white mb-6">System Overview</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-k8s-blue animate-spin" />
          <span className="ml-3 text-k8s-gray">Loading system overview...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">System Overview</h2>
      
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="k8s-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Database</h3>
              <Database className="w-6 h-6 text-k8s-blue" />
            </div>
            <p className={`text-sm font-medium ${
              health.database?.status === 'healthy' ? 'text-k8s-green' : 'text-k8s-orange'
            }`}>
              {health.database?.status || 'Unknown'}
            </p>
            {health.database?.stats && (
              <div className="mt-2 text-k8s-gray text-sm">
                <p>Users: {health.database.stats.users}</p>
                <p>Sessions: {health.database.stats.sessions}</p>
                <p>Messages: {health.database.stats.messages}</p>
              </div>
            )}
          </div>

          <div className="k8s-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Kubernetes</h3>
              <Shield className="w-6 h-6 text-k8s-cyan" />
            </div>
            <p className={`text-sm font-medium ${
              health.kubernetes?.status === 'connected' ? 'text-k8s-green' : 
              health.kubernetes?.status === 'cluster_error' ? 'text-k8s-orange' :
              health.kubernetes?.status === 'no_active_kubeconfig' ? 'text-k8s-gray' :
              'text-k8s-orange'
            }`}>
              {health.kubernetes?.status === 'connected' ? 'Connected' :
               health.kubernetes?.status === 'cluster_error' ? 'Connection Error' :
               health.kubernetes?.status === 'no_active_kubeconfig' ? 'No Active Config' :
               health.kubernetes?.status || 'Unknown'}
            </p>
            {health.kubernetes?.kubeconfig && health.kubernetes.kubeconfig !== 'none' ? (
              <div className="mt-2 text-k8s-gray text-sm">
                <p>Config: {health.kubernetes.kubeconfig}</p>
                <p className="text-xs truncate">{health.kubernetes.kubeconfig_path}</p>
              </div>
            ) : health.kubernetes?.status === 'no_active_kubeconfig' ? (
              <div className="mt-2 text-k8s-gray text-sm">
                <p>Please add and activate a kubeconfig first</p>
              </div>
            ) : null}
          </div>

          <div className="k8s-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">AI Classifier</h3>
              <Cpu className="w-6 h-6 text-k8s-purple" />
            </div>
            <p className={`text-sm font-medium ${
              health.classifier?.status === 'healthy' ? 'text-k8s-green' : 'text-k8s-orange'
            }`}>
              {health.classifier?.status || 'Unknown'}
            </p>
          </div>

          <div className="k8s-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">System Status</h3>
              <Activity className="w-6 h-6 text-k8s-green" />
            </div>
            <p className={`text-sm font-medium ${
              health.status === 'healthy' ? 'text-k8s-green' : 'text-k8s-orange'
            }`}>
              {health.status || 'Unknown'}
            </p>
            {health.timestamp && (
              <div className="mt-2 text-k8s-gray text-xs">
                Last updated: {formatDate(health.timestamp)}
              </div>
            )}
          </div>
        </div>
      )}

      {!health && !loading && (
        <div className="k8s-card p-8 text-center">
          <Activity className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray">Unable to load system health information</p>
          <button 
            onClick={loadHealth}
            className="k8s-button-primary mt-4"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;