import React, { useState, useEffect } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { apiService } from '../../services/apiService';

const ActivityLogs = ({ onError }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await apiService.getActivityLogs(null, 50);
      if (result.success) {
        setLogs(result.logs);
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error loading logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">System Logs</h2>
        <Activity className="w-6 h-6 text-k8s-orange" />
      </div>
      
      {loading.logs ? (
        <div className="text-center py-12">
          <div className="k8s-loader mx-auto"></div>
          <p className="text-k8s-gray mt-4">Loading logs...</p>
        </div>
      ) : (
        <div className="k8s-card">
          <div className="max-h-96 overflow-y-auto k8s-chat-scroll">
            {logs.map((log, index) => (
              <div key={index} className="border-b border-k8s-blue/10 pb-4 mb-4 last:border-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      log.success 
                        ? 'bg-k8s-green/20 text-k8s-green' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {log.action_type}
                    </span>
                    <span className="text-k8s-gray text-sm">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                </div>
                {log.command && (
                  <p className="text-k8s-gray font-mono text-sm bg-k8s-dark/30 p-2 rounded mb-2">
                    {log.command}
                  </p>
                )}
                {log.error_message && (
                  <p className="text-red-400 text-sm">{log.error_message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="k8s-card p-8 text-center">
          <Activity className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray mb-4">No activity logs found</p>
          <button 
            onClick={loadLogs}
            className="k8s-button-primary"
          >
            Refresh Logs
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;