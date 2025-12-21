import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, RefreshCw, Server, Activity, AlertCircle, CheckCircle, FileText, X, Copy, Download, Info, Folder, FolderOpen, File, ArrowLeft, ArrowRight } from 'lucide-react';
import { apiService } from '../services/apiService';

const PodBrowser = ({ user, onLogout }) => {
  const [podsData, setPodsData] = useState({ namespaces: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNamespaces, setExpandedNamespaces] = useState(new Set());
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Logs modal state
  const [logsModal, setLogsModal] = useState({ isOpen: false, podName: '', namespace: '', logs: '', loading: false, error: '' });
  
  // Describe modal state
  const [describeModal, setDescribeModal] = useState({ isOpen: false, podName: '', namespace: '', description: '', loading: false, error: '' });
  
  // File browser modal state
  const [fileBrowserModal, setFileBrowserModal] = useState({ 
    isOpen: false, 
    podName: '', 
    namespace: '', 
    files: [], 
    currentPath: '/', 
    loading: false, 
    error: '',
    selectedFile: null,
    fileContent: '',
    viewingFile: false
  });

  useEffect(() => {
    fetchPods();
  }, []);

  const fetchPods = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Use real API call
      const response = await apiService.getPods();
      
      if (response.success) {
        setPodsData({ namespaces: response.namespaces });
        setLastRefresh(new Date());
        
        // Auto-expand first namespace
        if (response.namespaces.length > 0) {
          setExpandedNamespaces(new Set([response.namespaces[0].name]));
        }
      } else {
        setError(response.error || 'Failed to load pod data');
      }
      
    } catch (error) {
      console.error('Failed to fetch pods:', error);
      setError('Failed to load pod data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPodLogs = async (namespace, podName) => {
    setLogsModal({ isOpen: true, podName, namespace, logs: '', loading: true, error: '' });
    
    try {
      const response = await apiService.getPodLogs(namespace, podName);
      
      if (response.success) {
        setLogsModal({ 
          isOpen: true, 
          podName: response.podName, 
          namespace: response.namespace, 
          logs: response.logs, 
          loading: false, 
          error: '' 
        });
      } else {
        setLogsModal({ 
          isOpen: true, 
          podName, 
          namespace, 
          logs: '', 
          loading: false, 
          error: response.error || 'Failed to fetch pod logs' 
        });
      }
      
    } catch (error) {
      console.error('Failed to fetch pod logs:', error);
      setLogsModal({ 
        isOpen: true, 
        podName, 
        namespace, 
        logs: '', 
        loading: false, 
        error: 'Failed to fetch pod logs. Please try again.' 
      });
    }
  };

  const closeLogsModal = () => {
    setLogsModal({ isOpen: false, podName: '', namespace: '', logs: '', loading: false, error: '' });
  };

  const copyLogsToClipboard = () => {
    navigator.clipboard.writeText(logsModal.logs);
    // You could add a toast notification here
  };

  const downloadLogs = () => {
    const blob = new Blob([logsModal.logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logsModal.podName}-${logsModal.namespace}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const fetchPodDescription = async (namespace, podName) => {
    setDescribeModal({ isOpen: true, podName, namespace, description: '', loading: true, error: '' });
    
    try {
      const response = await apiService.describePod(namespace, podName);
      
      if (response.success) {
        setDescribeModal({ 
          isOpen: true, 
          podName: response.podName, 
          namespace: response.namespace, 
          description: response.description, 
          loading: false, 
          error: '' 
        });
      } else {
        setDescribeModal({ 
          isOpen: true, 
          podName, 
          namespace, 
          description: '', 
          loading: false, 
          error: response.error || 'Failed to fetch pod description' 
        });
      }
      
    } catch (error) {
      console.error('Failed to fetch pod description:', error);
      setDescribeModal({ 
        isOpen: true, 
        podName, 
        namespace, 
        description: '', 
        loading: false, 
        error: 'Failed to fetch pod description. Please try again.' 
      });
    }
  };

  const closeDescribeModal = () => {
    setDescribeModal({ isOpen: false, podName: '', namespace: '', description: '', loading: false, error: '' });
  };

  const copyDescriptionToClipboard = () => {
    navigator.clipboard.writeText(describeModal.description);
    // You could add a toast notification here
  };

  const downloadDescription = () => {
    const blob = new Blob([describeModal.description], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${describeModal.podName}-${describeModal.namespace}-describe.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const openFileBrowser = async (namespace, podName) => {
    setFileBrowserModal({ 
      isOpen: true, 
      podName, 
      namespace, 
      files: [], 
      currentPath: '/', 
      loading: true, 
      error: '',
      selectedFile: null,
      fileContent: '',
      viewingFile: false
    });
    
    try {
      const response = await apiService.browsePodFiles(namespace, podName, '/');
      
      if (response.success) {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          files: response.files, 
          currentPath: response.currentPath, 
          loading: false, 
          error: '' 
        }));
      } else {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error || 'Failed to browse pod files' 
        }));
      }
      
    } catch (error) {
      console.error('Failed to browse pod files:', error);
      setFileBrowserModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to browse pod files. Please try again.' 
      }));
    }
  };

  const navigateToDirectory = async (path) => {
    setFileBrowserModal(prev => ({ ...prev, loading: true, error: '' }));
    
    try {
      const response = await apiService.browsePodFiles(fileBrowserModal.namespace, fileBrowserModal.podName, path);
      
      if (response.success) {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          files: response.files, 
          currentPath: response.currentPath, 
          loading: false, 
          error: '',
          viewingFile: false,
          selectedFile: null,
          fileContent: ''
        }));
      } else {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error || 'Failed to navigate to directory' 
        }));
      }
      
    } catch (error) {
      console.error('Failed to navigate:', error);
      setFileBrowserModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to navigate to directory. Please try again.' 
      }));
    }
  };

  const openFile = async (file) => {
    if (file.type === 'directory') {
      navigateToDirectory(`${fileBrowserModal.currentPath}/${file.name}`.replace('//', '/'));
      return;
    }
    
    // It's a file, read its content
    setFileBrowserModal(prev => ({ ...prev, loading: true, error: '', selectedFile: file }));
    
    try {
      const filePath = `${fileBrowserModal.currentPath}/${file.name}`.replace('//', '/');
      const response = await apiService.readPodFile(fileBrowserModal.namespace, fileBrowserModal.podName, filePath);
      
      if (response.success) {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          fileContent: response.content, 
          loading: false, 
          error: '',
          viewingFile: true
        }));
      } else {
        setFileBrowserModal(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error || 'Failed to read file' 
        }));
      }
      
    } catch (error) {
      console.error('Failed to read file:', error);
      setFileBrowserModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to read file. Please try again.' 
      }));
    }
  };

  const closeFileBrowser = () => {
    setFileBrowserModal({ 
      isOpen: false, 
      podName: '', 
      namespace: '', 
      files: [], 
      currentPath: '/', 
      loading: false, 
      error: '',
      selectedFile: null,
      fileContent: '',
      viewingFile: false
    });
  };

  const navigateUp = () => {
    const parentPath = fileBrowserModal.currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateToDirectory(parentPath);
  };

  const getFileIcon = (file) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-blue-400" />;
    } else if (file.type === 'symlink') {
      return <File className="w-4 h-4 text-yellow-400" />;
    } else {
      return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatFileSize = (size) => {
    if (size === '0' || !size) return '-';
    const num = parseInt(size);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const copyFileContent = () => {
    navigator.clipboard.writeText(fileBrowserModal.fileContent);
  };

  const downloadFileContent = () => {
    const blob = new Blob([fileBrowserModal.fileContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBrowserModal.selectedFile?.name || 'file'}-content.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const toggleNamespace = (namespaceName) => {
    setExpandedNamespaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(namespaceName)) {
        newSet.delete(namespaceName);
      } else {
        newSet.add(namespaceName);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending':
        return <Activity className="w-4 h-4 text-yellow-400" />;
      case 'crashloopbackoff':
      case 'error':
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Server className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'crashloopbackoff':
      case 'error':
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const filterPods = (data) => {
    if (!searchTerm) return data;
    
    const filtered = { namespaces: [] };
    
    data.namespaces.forEach(namespace => {
      const filteredPods = namespace.pods.filter(pod =>
        pod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        namespace.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filteredPods.length > 0) {
        filtered.namespaces.push({
          ...namespace,
          pods: filteredPods,
          pod_count: filteredPods.length
        });
      }
    });
    
    return filtered;
  };

  const filteredData = filterPods(podsData);

  return (
    <div className="k8s-container min-h-screen flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="k8s-glass border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Server className="w-8 h-8 text-k8s-blue" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Pod Browser</h1>
                  <p className="text-k8s-gray text-sm">
                    Browse and manage Kubernetes pods across all namespaces
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchPods}
                  disabled={loading}
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <a
                  href="/user/dashboard"
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  Back to Chat
                </a>
                <button
                  onClick={onLogout}
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
          {/* Search and Controls */}
          <div className="k8s-card p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-k8s-gray w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search pods or namespaces..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="k8s-input pl-10 w-full"
                />
              </div>
              {lastRefresh && (
                <div className="text-k8s-gray text-sm">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* Pods List */}
          <div className="k8s-card">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-k8s-blue animate-spin mr-3" />
                <span className="text-k8s-gray">Loading pods...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={fetchPods} className="k8s-button-primary">
                  Try Again
                </button>
              </div>
            ) : filteredData.namespaces.length === 0 ? (
              <div className="text-center py-12">
                <Server className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
                <p className="text-k8s-gray">
                  {searchTerm ? 'No pods found matching your search.' : 'No pods found.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-k8s-dark/30">
                {filteredData.namespaces.map((namespace) => (
                  <div key={namespace.name} className="p-4">
                    {/* Namespace Header */}
                    <button
                      onClick={() => toggleNamespace(namespace.name)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-k8s-dark/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expandedNamespaces.has(namespace.name) ? (
                          <ChevronDown className="w-5 h-5 text-k8s-blue" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-k8s-blue" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {namespace.name}
                          </h3>
                          <p className="text-k8s-gray text-sm">
                            {namespace.pod_count} pod{namespace.pod_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Pods List */}
                    {expandedNamespaces.has(namespace.name) && (
                      <div className="ml-8 mt-2 space-y-2">
                        {namespace.pods.map((pod) => (
                          <div
                            key={pod.name}
                            className="flex items-center justify-between p-4 bg-k8s-dark/20 rounded-lg hover:bg-k8s-dark/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(pod.status)}
                              <div>
                                <h4 className="text-white font-medium">
                                  {pod.name}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-k8s-gray mt-1">
                                  <span>Ready: {pod.ready}</span>
                                  <span>Restarts: {pod.restarts}</span>
                                  <span>Age: {pod.age}</span>
                                  <span>Node: {pod.node}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`text-sm font-medium ${getStatusColor(pod.status)}`}>
                                {pod.status}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchPodLogs(namespace.name, pod.name);
                                }}
                                className="k8s-button-secondary flex items-center gap-2 p-2"
                                title="View pod logs"
                              >
                                <FileText className="w-4 h-4" />
                                Logs
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchPodDescription(namespace.name, pod.name);
                                }}
                                className="k8s-button-secondary flex items-center gap-2 p-2"
                                title="Describe pod"
                              >
                                <Info className="w-4 h-4" />
                                Describe
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openFileBrowser(namespace.name, pod.name);
                                }}
                                className="k8s-button-secondary flex items-center gap-2 p-2"
                                title="Browse pod files"
                              >
                                <Folder className="w-4 h-4" />
                                Browse
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Logs Modal */}
        {logsModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="k8s-card max-w-5xl w-full h-[85vh] max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-k8s-blue" />
                    Pod Logs
                  </h2>
                  <p className="text-k8s-gray text-sm mt-1">
                    {logsModal.podName} in namespace: {logsModal.namespace}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyLogsToClipboard}
                    disabled={!logsModal.logs || logsModal.loading}
                    className="k8s-button-secondary flex items-center gap-2"
                    title="Copy logs to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={downloadLogs}
                    disabled={!logsModal.logs || logsModal.loading}
                    className="k8s-button-secondary flex items-center gap-2"
                    title="Download logs"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={closeLogsModal}
                    className="k8s-button-secondary p-2"
                    title="Close logs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 p-6 overflow-hidden min-h-0">
                {logsModal.loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-k8s-blue animate-spin mr-3" />
                    <span className="text-k8s-gray">Loading pod logs...</span>
                  </div>
                ) : logsModal.error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <p className="text-red-400 mb-4">{logsModal.error}</p>
                      <button onClick={closeLogsModal} className="k8s-button-primary">
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <span className="text-k8s-gray text-sm">
                        Showing last {logsModal.logs.split('\n').length} lines
                      </span>
                      <span className="text-k8s-gray text-sm">
                        {logsModal.timestamp && new Date(logsModal.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex-1 bg-black/50 rounded-lg p-4 overflow-y-auto font-mono text-sm text-gray-300 border border-white/10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                      <pre className="whitespace-pre-wrap">{logsModal.logs || 'No logs available'}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Describe Modal */}
        {describeModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="k8s-card max-w-6xl w-full h-[85vh] max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-k8s-blue" />
                    Pod Description
                  </h2>
                  <p className="text-k8s-gray text-sm mt-1">
                    {describeModal.podName} in namespace: {describeModal.namespace}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyDescriptionToClipboard}
                    disabled={!describeModal.description || describeModal.loading}
                    className="k8s-button-secondary flex items-center gap-2"
                    title="Copy description to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={downloadDescription}
                    disabled={!describeModal.description || describeModal.loading}
                    className="k8s-button-secondary flex items-center gap-2"
                    title="Download description"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={closeDescribeModal}
                    className="k8s-button-secondary p-2"
                    title="Close description"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 p-6 overflow-hidden min-h-0">
                {describeModal.loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-k8s-blue animate-spin mr-3" />
                    <span className="text-k8s-gray">Loading pod description...</span>
                  </div>
                ) : describeModal.error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <p className="text-red-400 mb-4">{describeModal.error}</p>
                      <button onClick={closeDescribeModal} className="k8s-button-primary">
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <span className="text-k8s-gray text-sm">
                        Detailed pod information from kubectl describe
                      </span>
                      <span className="text-k8s-gray text-sm">
                        {describeModal.timestamp && new Date(describeModal.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex-1 bg-black/50 rounded-lg p-4 overflow-y-auto font-mono text-sm text-gray-300 border border-white/10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                      <pre className="whitespace-pre-wrap">{describeModal.description || 'No description available'}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* File Browser Modal */}
        {fileBrowserModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="k8s-card max-w-6xl w-full h-[85vh] max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Folder className="w-5 h-5 text-k8s-blue" />
                    File Browser
                  </h2>
                  <p className="text-k8s-gray text-sm mt-1">
                    {fileBrowserModal.podName} in namespace: {fileBrowserModal.namespace}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fileBrowserModal.viewingFile && (
                    <>
                      <button
                        onClick={copyFileContent}
                        disabled={!fileBrowserModal.fileContent}
                        className="k8s-button-secondary flex items-center gap-2"
                        title="Copy file content"
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={downloadFileContent}
                        disabled={!fileBrowserModal.fileContent}
                        className="k8s-button-secondary flex items-center gap-2"
                        title="Download file content"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </>
                  )}
                  <button
                    onClick={fileBrowserModal.viewingFile ? () => navigateToDirectory(fileBrowserModal.currentPath) : closeFileBrowser}
                    className="k8s-button-secondary p-2"
                    title={fileBrowserModal.viewingFile ? "Back to files" : "Close file browser"}
                  >
                    {fileBrowserModal.viewingFile ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 p-6 overflow-hidden min-h-0">
                {fileBrowserModal.loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-k8s-blue animate-spin mr-3" />
                    <span className="text-k8s-gray">
                      {fileBrowserModal.viewingFile ? 'Reading file...' : 'Loading files...'}
                    </span>
                  </div>
                ) : fileBrowserModal.error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <p className="text-red-400 mb-4">{fileBrowserModal.error}</p>
                      <button onClick={closeFileBrowser} className="k8s-button-primary">
                        Close
                      </button>
                    </div>
                  </div>
                ) : fileBrowserModal.viewingFile ? (
                  /* File Content View */
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <div className="flex items-center gap-4">
                        <span className="text-k8s-gray text-sm">
                          Viewing: {fileBrowserModal.selectedFile?.name}
                        </span>
                        <span className="text-k8s-gray text-sm">
                          Path: {fileBrowserModal.currentPath}
                        </span>
                      </div>
                      <span className="text-k8s-gray text-sm">
                        {fileBrowserModal.selectedFile?.size && `Size: ${formatFileSize(fileBrowserModal.selectedFile.size)}`}
                      </span>
                    </div>
                    <div className="flex-1 bg-black/50 rounded-lg p-4 overflow-y-auto font-mono text-sm text-gray-300 border border-white/10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                      <pre className="whitespace-pre-wrap">{fileBrowserModal.fileContent || 'No content available'}</pre>
                    </div>
                  </div>
                ) : (
                  /* File Browser View */
                  <div className="h-full flex flex-col min-h-0">
                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={navigateUp}
                          disabled={fileBrowserModal.currentPath === '/'}
                          className="k8s-button-secondary flex items-center gap-2"
                          title="Go up one directory"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Up
                        </button>
                        <span className="text-k8s-gray text-sm">
                          Current: {fileBrowserModal.currentPath}
                        </span>
                      </div>
                      <span className="text-k8s-gray text-sm">
                        {fileBrowserModal.files.length} items
                      </span>
                    </div>
                    
                    {/* Files List */}
                    <div className="flex-1 bg-black/50 rounded-lg p-4 overflow-y-auto border border-white/10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                      {fileBrowserModal.files.length === 0 ? (
                        <div className="text-center text-k8s-gray py-8">
                          <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>This directory is empty</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {fileBrowserModal.files.map((file, index) => (
                            <div
                              key={index}
                              onClick={() => openFile(file)}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                            >
                              {getFileIcon(file)}
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">
                                  {file.name}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-k8s-gray">
                                  <span>{file.permissions}</span>
                                  <span>{file.owner}</span>
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>{file.modified}</span>
                                </div>
                              </div>
                              <div className="text-k8s-gray text-sm">
                                {file.type}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PodBrowser;