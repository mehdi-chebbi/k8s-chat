import React, { useState, useEffect } from 'react';
import { Activity, Loader2, RefreshCw, Search, Filter, CheckCircle, XCircle, Clock, Terminal, User, AlertTriangle, FileText, Shield, Calendar, MoreVertical, Database, Globe, Code } from 'lucide-react';
import { apiService } from '../../services/apiService';

const ActivityLogs = ({ onError }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSuccess, setFilterSuccess] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await apiService.getActivityLogs(null, 200);
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
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getActionIcon = (actionType) => {
    const iconClass = "w-4 h-4";

    switch (actionType) {
      case 'login':
        return <User className={iconClass} />;
      case 'signup':
        return <User className={iconClass} />;
      case 'logout':
        return <Shield className={iconClass} />;
      case 'create_user':
      case 'delete_user':
      case 'update_user':
      case 'ban_user':
      case 'unban_user':
        return <User className={iconClass} />;
      case 'create_kubeconfig':
      case 'delete_kubeconfig':
      case 'update_kubeconfig':
      case 'activate_kubeconfig':
        return <Globe className={iconClass} />;
      case 'chat':
        return <Terminal className={iconClass} />;
      case 'kubectl_command':
        return <Code className={iconClass} />;
      case 'test_kubeconfig':
        return <CheckCircle className={iconClass} />;
      default:
        return <Activity className={iconClass} />;
    }
  };

  const getActionColor = (actionType) => {
    if (actionType.includes('delete') || actionType.includes('ban')) {
      return 'text-red-400';
    }
    if (actionType.includes('create') || actionType.includes('activate')) {
      return 'text-k8s-green';
    }
    return 'text-k8s-blue';
  };

  const getFilteredLogs = () => {
    return logs.filter(log => {
      const matchesSearch = !searchQuery ||
        (log.username && log.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.action_type && log.action_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.command && log.command.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = filterType === 'all' || log.action_type === filterType;
      const matchesSuccess = filterSuccess === 'all' ||
        (filterSuccess === 'success' && log.success) ||
        (filterSuccess === 'failed' && !log.success);

      return matchesSearch && matchesType && matchesSuccess;
    });
  };

  const uniqueActionTypes = [...new Set(logs.map(log => log.action_type))];

  const successCount = logs.filter(l => l.success).length;
  const failedCount = logs.filter(l => !l.success).length;

  const filteredLogs = getFilteredLogs();

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-orange/10 via-k8s-yellow/10 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-k8s-orange/20 rounded-lg border border-k8s-orange/30">
                  <Activity className="w-5 h-5 text-k8s-yellow" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Activity Logs</h2>
                  <p className="text-xs text-k8s-gray mt-0.5">Track system events and user actions</p>
                </div>
              </div>
            </div>
            <button
              onClick={loadLogs}
              className="k8s-button-secondary flex items-center gap-2 px-4 py-2 text-sm transition-all duration-300 hover:scale-105"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
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
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-k8s-orange/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-green/10 rounded-lg">
                <CheckCircle className="w-4 h-4 text-k8s-green" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{successCount}</p>
                <p className="text-xs text-k8s-gray">Successful</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-red/10 rounded-lg">
                <XCircle className="w-4 h-4 text-k8s-red" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{failedCount}</p>
                <p className="text-xs text-k8s-gray">Failed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-blue/10 rounded-lg">
                <FileText className="w-4 h-4 text-k8s-blue" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{logs.length}</p>
                <p className="text-xs text-k8s-gray">Total Events</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-yellow/5 via-k8s-orange/5 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-k8s-gray" />
              <input
                type="text"
                placeholder="Search logs by user, action, or command..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="k8s-input w-full pl-10 pr-4 py-2 text-sm"
              />
            </div>

            {/* Action Type Filter */}
            <div className="relative min-w-[180px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-k8s-gray" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="k8s-input w-full pl-10 pr-4 py-2 text-sm appearance-none"
              >
                <option value="all">All Actions</option>
                {uniqueActionTypes.map(action => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Success Filter */}
            <div className="relative min-w-[150px]">
              <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-k8s-gray" />
              <select
                value={filterSuccess}
                onChange={(e) => setFilterSuccess(e.target.value)}
                className="k8s-input w-full pl-10 pr-4 py-2 text-sm appearance-none"
              >
                <option value="all">All Status</option>
                <option value="success">Success Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-orange/5 via-k8s-yellow/5 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-k8s-orange animate-spin" />
              <p className="text-k8s-gray text-sm">Loading activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Activity className="w-12 h-12 text-k8s-gray" />
              <div className="text-center">
                <p className="text-white font-medium">No logs found</p>
                <p className="text-k8s-gray text-sm mt-1">
                  {searchQuery || filterType !== 'all' || filterSuccess !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Activity will appear here as users interact with the system'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.id}-${index}`}
                  className="relative hover:scale-[1.01] transition-all duration-300 p-4 bg-k8s-dark/30 rounded-xl border border-k8s-orange/20 hover:border-k8s-yellow/40"
                >
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      log.success
                        ? 'bg-k8s-green/20 text-k8s-green border border-k8s-green/30'
                        : 'bg-k8s-red/20 text-k8s-red border border-k8s-red/30'
                    }`}>
                      {log.success ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Success
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </>
                      )}
                    </div>
                  </div>

                  {/* Log Content */}
                  <div className="space-y-3 mt-6">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        log.success
                          ? 'bg-k8s-green/10'
                          : 'bg-k8s-red/10'
                      }`}>
                        <div className={`${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-base font-bold text-white truncate">
                            {log.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </h4>
                          {log.username && (
                            <span className="px-2 py-0.5 bg-k8s-blue/20 text-k8s-blue rounded-full text-xs font-medium">
                              @{log.username}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-k8s-gray">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Command Display */}
                    {log.command && (
                      <div className="p-3 bg-k8s-dark/50 rounded-lg border border-k8s-orange/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Terminal className="w-3.5 h-3.5 text-k8s-yellow" />
                          <p className="text-xs font-semibold text-white">Command Executed</p>
                        </div>
                        <code className="text-sm text-k8s-cyan font-mono break-all">
                          {log.command}
                        </code>
                      </div>
                    )}

                    {/* Classification Display */}
                    {log.classification_type && (
                      <div className="flex items-center gap-2 text-xs text-k8s-gray">
                        <Shield className="w-3.5 h-3.5 text-k8s-purple" />
                        <span>
                          Classified as: <span className="text-k8s-purple font-medium ml-1">{log.classification_type}</span>
                        </span>
                      </div>
                    )}

                    {/* Error Message */}
                    {log.error_message && (
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-red-300 font-medium text-xs mb-1">Error Details</p>
                            <p className="text-red-300/80 text-sm">{log.error_message}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
