import React, { useState, useEffect } from 'react';
import { Users, Activity, LogOut, Database, Shield, Cpu, AlertCircle, UserPlus, Loader2, Plus, Edit2, Trash2, PlayCircle, CheckCircle, XCircle, FolderOpen, Key, Network } from 'lucide-react';
import { apiService } from '../services/apiService';

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [kubeconfigs, setKubeconfigs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateKubeconfig, setShowCreateKubeconfig] = useState(false);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [editingKubeconfig, setEditingKubeconfig] = useState(null);
  const [editingApiKey, setEditingApiKey] = useState(null);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [createKubeconfigForm, setCreateKubeconfigForm] = useState({
    name: '',
    path: '',
    description: '',
    is_default: false
  });
  const [createApiKeyForm, setCreateApiKeyForm] = useState({
    name: '',
    api_key: '',
    provider: 'openrouter',
    description: ''
  });
  const [loading, setLoading] = useState({
    users: false,
    logs: false,
    health: false,
    create: false,
    kubeconfigs: false,
    kubeconfigAction: false,
    apiKeys: false,
    apiKeyAction: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    // Only load data for the active tab
    if (activeTab === 'overview') {
      loadHealth();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'logs') {
      loadLogs();
    } else if (activeTab === 'kubeconfigs') {
      loadKubeconfigs();
    } else if (activeTab === 'settings') {
      loadApiKeys();
    }
  }, [activeTab]);

  const loadKubeconfigs = async () => {
    setLoading(prev => ({ ...prev, kubeconfigs: true }));
    try {
      const result = await apiService.getKubeconfigs();
      if (result.success) {
        setKubeconfigs(result.kubeconfigs);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error loading kubeconfigs');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigs: false }));
    }
  };

  const loadApiKeys = async () => {
    setLoading(prev => ({ ...prev, apiKeys: true }));
    try {
      const result = await apiService.getApiKeys();
      if (result.success) {
        setApiKeys(result.apiKeys);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error loading API keys');
    } finally {
      setLoading(prev => ({ ...prev, apiKeys: false }));
    }
  };

  const loadHealth = async () => {
    setLoading(prev => ({ ...prev, health: true }));
    try {
      const result = await apiService.getHealth();
      if (result.success) {
        setHealth(result.data);
      } else {
        setError('Failed to load health data');
      }
    } catch (error) {
      setError('Error loading health data');
    } finally {
      setLoading(prev => ({ ...prev, health: false }));
    }
  };

  const loadUsers = async () => {
    setLoading(prev => ({ ...prev, users: true }));
    try {
      const result = await apiService.getUsers();
      if (result.success) {
        setUsers(result.users);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error loading users');
    } finally {
      setLoading(prev => ({ ...prev, users: false }));
    }
  };

  const loadLogs = async () => {
    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const result = await apiService.getActivityLogs(null, 50);
      if (result.success) {
        setLogs(result.logs);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error loading logs');
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

  const handleBanUser = async (userId) => {
    try {
      const result = await apiService.banUser(userId);
      if (result.success) {
        if (activeTab === 'users') {
          loadUsers(); // Refresh users list
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error banning user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      const result = await apiService.unbanUser(userId);
      if (result.success) {
        if (activeTab === 'users') {
          loadUsers(); // Refresh users list
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error unbanning user');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!createUserForm.username || !createUserForm.email || !createUserForm.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(prev => ({ ...prev, create: true }));
    setError('');

    try {
      const result = await apiService.createUser(createUserForm);
      
      if (result.success) {
        setShowCreateUser(false);
        setCreateUserForm({ username: '', email: '', password: '', role: 'user' });
        if (activeTab === 'users') {
          loadUsers(); // Refresh users list
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error creating user');
    } finally {
      setLoading(prev => ({ ...prev, create: false }));
    }
  };

  const handleCreateUserChange = (e) => {
    const { name, value } = e.target;
    setCreateUserForm(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  // Kubeconfig management functions
  const handleCreateKubeconfig = async (e) => {
    e.preventDefault();
    
    if (!createKubeconfigForm.name || !createKubeconfigForm.path) {
      setError('Please fill in name and path');
      return;
    }

    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    setError('');

    try {
      const result = await apiService.createKubeconfig({
        ...createKubeconfigForm,
        created_by: user.id
      });
      
      if (result.success) {
        setShowCreateKubeconfig(false);
        setCreateKubeconfigForm({ name: '', path: '', description: '', is_default: false });
        if (activeTab === 'kubeconfigs') {
          loadKubeconfigs();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error creating kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const handleCreateKubeconfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateKubeconfigForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
  };

  const handleEditKubeconfig = (kubeconfig) => {
    setEditingKubeconfig(kubeconfig);
    setCreateKubeconfigForm({
      name: kubeconfig.name,
      path: kubeconfig.path,
      description: kubeconfig.description || '',
      is_default: kubeconfig.is_default
    });
    setShowCreateKubeconfig(true);
  };

  const handleUpdateKubeconfig = async (e) => {
    e.preventDefault();
    
    if (!createKubeconfigForm.name || !createKubeconfigForm.path) {
      setError('Please fill in name and path');
      return;
    }

    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    setError('');

    try {
      const result = await apiService.updateKubeconfig(editingKubeconfig.id, createKubeconfigForm);
      
      if (result.success) {
        setShowCreateKubeconfig(false);
        setEditingKubeconfig(null);
        setCreateKubeconfigForm({ name: '', path: '', description: '', is_default: false });
        if (activeTab === 'kubeconfigs') {
          loadKubeconfigs();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error updating kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const handleDeleteKubeconfig = async (kubeconfigId) => {
    if (!window.confirm('Are you sure you want to delete this kubeconfig?')) {
      return;
    }

    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    try {
      const result = await apiService.deleteKubeconfig(kubeconfigId);
      if (result.success) {
        if (activeTab === 'kubeconfigs') {
          loadKubeconfigs();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error deleting kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const handleActivateKubeconfig = async (kubeconfigId) => {
    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    try {
      const result = await apiService.activateKubeconfig(kubeconfigId);
      if (result.success) {
        if (activeTab === 'kubeconfigs') {
          loadKubeconfigs();
        }
        if (activeTab === 'overview') {
          loadHealth(); // Refresh health to show new active config
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error activating kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const handleTestKubeconfig = async (kubeconfigId) => {
    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    try {
      const result = await apiService.testKubeconfig(kubeconfigId);
      if (result.success) {
        alert(result.data.message + (result.data.details?.output ? '\n\n' + result.data.details.output : ''));
        if (activeTab === 'kubeconfigs') {
          loadKubeconfigs(); // Refresh to show updated test status
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error testing kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const resetKubeconfigForm = () => {
    setCreateKubeconfigForm({ name: '', path: '', description: '', is_default: false });
    setEditingKubeconfig(null);
    setShowCreateKubeconfig(false);
  };

  // API Key management functions
  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    
    if (!createApiKeyForm.name || !createApiKeyForm.api_key) {
      setError('Please fill in name and API key');
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    setError('');

    try {
      const result = await apiService.createApiKey({
        ...createApiKeyForm,
        created_by: user.id
      });
      
      if (result.success) {
        setShowCreateApiKey(false);
        setCreateApiKeyForm({ name: '', api_key: '', provider: 'openrouter', description: '' });
        if (activeTab === 'settings') {
          loadApiKeys();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error creating API key');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleCreateApiKeyChange = (e) => {
    const { name, value } = e.target;
    setCreateApiKeyForm(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleEditApiKey = (apiKey) => {
    setEditingApiKey(apiKey);
    setCreateApiKeyForm({
      name: apiKey.name,
      api_key: apiKey.api_key,
      provider: apiKey.provider,
      description: apiKey.description || ''
    });
    setShowCreateApiKey(true);
  };

  const handleUpdateApiKey = async (e) => {
    e.preventDefault();
    
    if (!createApiKeyForm.name || !createApiKeyForm.api_key) {
      setError('Please fill in name and API key');
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    setError('');

    try {
      const result = await apiService.updateApiKey(editingApiKey.id, createApiKeyForm);
      
      if (result.success) {
        setShowCreateApiKey(false);
        setEditingApiKey(null);
        setCreateApiKeyForm({ name: '', api_key: '', provider: 'openrouter', description: '' });
        if (activeTab === 'settings') {
          loadApiKeys();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error updating API key');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleDeleteApiKey = async (apiKeyId) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    try {
      const result = await apiService.deleteApiKey(apiKeyId);
      if (result.success) {
        if (activeTab === 'settings') {
          loadApiKeys();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error deleting API key');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleActivateApiKey = async (apiKeyId) => {
    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    try {
      const result = await apiService.activateApiKey(apiKeyId);
      if (result.success) {
        if (activeTab === 'settings') {
          loadApiKeys();
        }
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error activating API key');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const resetApiKeyForm = () => {
    setCreateApiKeyForm({ name: '', api_key: '', provider: 'openrouter', description: '' });
    setEditingApiKey(null);
    setShowCreateApiKey(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

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
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-8 bg-k8s-dark/30 p-1 rounded-lg w-fit">
          {['overview', 'users', 'kubeconfigs', 'logs', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-k8s-blue text-white shadow-lg'
                  : 'text-k8s-gray hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">User Management</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="k8s-button-primary flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create User
                </button>
                <Users className="w-6 h-6 text-k8s-blue" />
              </div>
            </div>

            {/* Create User Modal */}
            {showCreateUser && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="k8s-card p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Create New User</h3>
                    <button
                      onClick={() => setShowCreateUser(false)}
                      className="text-k8s-gray hover:text-white transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-red-300 text-sm">{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    {/* Username Field */}
                    <div>
                      <label htmlFor="create-username" className="block text-sm font-medium text-k8s-gray mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        id="create-username"
                        name="username"
                        value={createUserForm.username}
                        onChange={handleCreateUserChange}
                        className="k8s-input w-full"
                        placeholder="Enter username"
                        disabled={loading.create}
                      />
                    </div>

                    {/* Email Field */}
                    <div>
                      <label htmlFor="create-email" className="block text-sm font-medium text-k8s-gray mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        id="create-email"
                        name="email"
                        value={createUserForm.email}
                        onChange={handleCreateUserChange}
                        className="k8s-input w-full"
                        placeholder="Enter email"
                        disabled={loading.create}
                      />
                    </div>

                    {/* Password Field */}
                    <div>
                      <label htmlFor="create-password" className="block text-sm font-medium text-k8s-gray mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        id="create-password"
                        name="password"
                        value={createUserForm.password}
                        onChange={handleCreateUserChange}
                        className="k8s-input w-full"
                        placeholder="Enter password"
                        disabled={loading.create}
                      />
                    </div>

                    {/* Role Field */}
                    <div>
                      <label htmlFor="create-role" className="block text-sm font-medium text-k8s-gray mb-2">
                        Role
                      </label>
                      <select
                        id="create-role"
                        name="role"
                        value={createUserForm.role}
                        onChange={handleCreateUserChange}
                        className="k8s-input w-full"
                        disabled={loading.create}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateUser(false)}
                        className="k8s-button-secondary flex-1"
                        disabled={loading.create}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading.create}
                        className="k8s-button-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {loading.create ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-k8s-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Create User
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {loading.users ? (
              <div className="text-center py-12">
                <div className="k8s-loader mx-auto"></div>
                <p className="text-k8s-gray mt-4">Loading users...</p>
              </div>
            ) : (
              <div className="k8s-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-k8s-dark/50 border-b border-k8s-blue/20">
                      <tr>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">User</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Role</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Status</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Created</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-k8s-blue/10 hover:bg-k8s-blue/5 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="text-white font-medium">{user.username}</p>
                              <p className="text-k8s-gray text-sm">{user.email}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-k8s-purple/20 text-k8s-purple' 
                                : 'bg-k8s-blue/20 text-k8s-blue'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_banned 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-k8s-green/20 text-k8s-green'
                            }`}>
                              {user.is_banned ? 'Banned' : 'Active'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-k8s-gray text-sm">
                            {formatDate(user.created_at)}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex gap-2">
                              {user.is_banned ? (
                                <button
                                  onClick={() => handleUnbanUser(user.id)}
                                  className="px-3 py-1 bg-k8s-green/20 text-k8s-green rounded text-sm hover:bg-k8s-green/30 transition-colors"
                                >
                                  Unban
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBanUser(user.id)}
                                  className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
                                >
                                  Ban
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Kubeconfigs Tab */}
        {activeTab === 'kubeconfigs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">Kubernetes Configurations</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowCreateKubeconfig(true)}
                  className="k8s-button-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Kubeconfig
                </button>
                <FolderOpen className="w-6 h-6 text-k8s-cyan" />
              </div>
            </div>

            {/* Create/Edit Kubeconfig Modal */}
            {showCreateKubeconfig && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="k8s-card p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                      {editingKubeconfig ? 'Edit Kubeconfig' : 'Add New Kubeconfig'}
                    </h3>
                    <button
                      onClick={resetKubeconfigForm}
                      className="text-k8s-gray hover:text-white transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-red-300 text-sm">{error}</span>
                    </div>
                  )}

                  <form onSubmit={editingKubeconfig ? handleUpdateKubeconfig : handleCreateKubeconfig} className="space-y-4">
                    {/* Name Field */}
                    <div>
                      <label htmlFor="kubeconfig-name" className="block text-sm font-medium text-k8s-gray mb-2">
                        Configuration Name
                      </label>
                      <input
                        type="text"
                        id="kubeconfig-name"
                        name="name"
                        value={createKubeconfigForm.name}
                        onChange={handleCreateKubeconfigChange}
                        className="k8s-input w-full"
                        placeholder="e.g., Production Cluster"
                        disabled={loading.kubeconfigAction}
                      />
                    </div>

                    {/* Path Field */}
                    <div>
                      <label htmlFor="kubeconfig-path" className="block text-sm font-medium text-k8s-gray mb-2">
                        Kubeconfig Path
                      </label>
                      <input
                        type="text"
                        id="kubeconfig-path"
                        name="path"
                        value={createKubeconfigForm.path}
                        onChange={handleCreateKubeconfigChange}
                        className="k8s-input w-full"
                        placeholder="/path/to/kubeconfig"
                        disabled={loading.kubeconfigAction}
                      />
                    </div>

                    {/* Description Field */}
                    <div>
                      <label htmlFor="kubeconfig-description" className="block text-sm font-medium text-k8s-gray mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        id="kubeconfig-description"
                        name="description"
                        value={createKubeconfigForm.description}
                        onChange={handleCreateKubeconfigChange}
                        className="k8s-input w-full h-20 resize-none"
                        placeholder="Brief description of this kubeconfig..."
                        disabled={loading.kubeconfigAction}
                      />
                    </div>

                    {/* Default Checkbox */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="kubeconfig-default"
                        name="is_default"
                        checked={createKubeconfigForm.is_default}
                        onChange={handleCreateKubeconfigChange}
                        className="w-4 h-4 text-k8s-blue bg-k8s-dark border-k8s-gray rounded focus:ring-k8s-blue"
                        disabled={loading.kubeconfigAction}
                      />
                      <label htmlFor="kubeconfig-default" className="text-sm text-k8s-gray">
                        Set as default configuration
                      </label>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={resetKubeconfigForm}
                        className="k8s-button-secondary flex-1"
                        disabled={loading.kubeconfigAction}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading.kubeconfigAction}
                        className="k8s-button-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {loading.kubeconfigAction ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-k8s-spin" />
                            {editingKubeconfig ? 'Updating...' : 'Creating...'}
                          </>
                        ) : (
                          <>
                            {editingKubeconfig ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {editingKubeconfig ? 'Update Config' : 'Create Config'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {loading.kubeconfigs ? (
              <div className="text-center py-12">
                <div className="k8s-loader mx-auto"></div>
                <p className="text-k8s-gray mt-4">Loading kubeconfigs...</p>
              </div>
            ) : (
              <div className="k8s-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-k8s-dark/50 border-b border-k8s-blue/20">
                      <tr>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Configuration</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Path</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Status</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Test Result</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Created</th>
                        <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kubeconfigs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-k8s-gray">
                            No kubeconfigs configured yet. Add your first kubeconfig to get started.
                          </td>
                        </tr>
                      ) : (
                        kubeconfigs.map((config) => (
                          <tr key={config.id} className="border-b border-k8s-gray/20 hover:bg-k8s-dark/30 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-white font-medium">{config.name}</p>
                                  {config.is_default && (
                                    <span className="inline-block px-2 py-1 text-xs bg-k8s-blue/20 text-k8s-blue rounded-full">
                                      Default
                                    </span>
                                  )}
                                  {config.is_active && (
                                    <span className="inline-block px-2 py-1 text-xs bg-k8s-green/20 text-k8s-green rounded-full ml-2">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </div>
                              {config.description && (
                                <p className="text-k8s-gray text-sm mt-1">{config.description}</p>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <code className="text-k8s-cyan text-sm bg-k8s-dark/30 px-2 py-1 rounded">
                                {config.path}
                              </code>
                            </td>
                            <td className="py-4 px-6">
                              {config.is_active ? (
                                <div className="flex items-center gap-2 text-k8s-green">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm">Active</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-k8s-gray">
                                  <XCircle className="w-4 h-4" />
                                  <span className="text-sm">Inactive</span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {config.test_status === 'success' ? (
                                <div className="flex items-center gap-2 text-k8s-green">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm">Connected</span>
                                </div>
                              ) : config.test_status === 'failed' ? (
                                <div className="flex items-center gap-2 text-k8s-red">
                                  <XCircle className="w-4 h-4" />
                                  <span className="text-sm">Failed</span>
                                </div>
                              ) : config.test_status === 'error' ? (
                                <div className="flex items-center gap-2 text-k8s-orange">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-sm">Error</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-k8s-gray">
                                  <span className="text-sm">Untested</span>
                                </div>
                              )}
                              {config.last_tested && (
                                <p className="text-k8s-gray text-xs mt-1">
                                  Last: {formatDate(config.last_tested)}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-6 text-k8s-gray text-sm">
                              {formatDate(config.created_at)}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleTestKubeconfig(config.id)}
                                  className="p-2 text-k8s-cyan hover:bg-k8s-cyan/10 rounded transition-colors"
                                  title="Test connection"
                                  disabled={loading.kubeconfigAction}
                                >
                                  {loading.kubeconfigAction ? (
                                    <Loader2 className="w-4 h-4 animate-k8s-spin" />
                                  ) : (
                                    <PlayCircle className="w-4 h-4" />
                                  )}
                                </button>
                                {!config.is_active && (
                                  <button
                                    onClick={() => handleActivateKubeconfig(config.id)}
                                    className="p-2 text-k8s-green hover:bg-k8s-green/10 rounded transition-colors"
                                    title="Activate"
                                    disabled={loading.kubeconfigAction}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditKubeconfig(config)}
                                  className="p-2 text-k8s-blue hover:bg-k8s-blue/10 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteKubeconfig(config.id)}
                                  className="p-2 text-k8s-red hover:bg-k8s-red/10 rounded transition-colors"
                                  title="Delete"
                                  disabled={loading.kubeconfigAction}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
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
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-6">Settings</h2>
            
            {/* API Keys Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <Key className="w-6 h-6 text-k8s-purple" />
                  API Keys
                </h3>
                <button
                  onClick={() => setShowCreateApiKey(true)}
                  className="k8s-button-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add API Key
                </button>
              </div>

              {/* Create/Edit API Key Modal */}
              {showCreateApiKey && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="k8s-card w-full max-w-lg mx-4">
                    <h4 className="text-xl font-semibold text-white mb-6">
                      {editingApiKey ? 'Edit API Key' : 'Add New API Key'}
                    </h4>
                    
                    <form onSubmit={editingApiKey ? handleUpdateApiKey : handleCreateApiKey}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-k8s-gray text-sm font-medium mb-2">
                            Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={createApiKeyForm.name}
                            onChange={handleCreateApiKeyChange}
                            className="k8s-input w-full"
                            placeholder="e.g., OpenRouter Production"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-k8s-gray text-sm font-medium mb-2">
                            API Key
                          </label>
                          <input
                            type="password"
                            name="api_key"
                            value={createApiKeyForm.api_key}
                            onChange={handleCreateApiKeyChange}
                            className="k8s-input w-full"
                            placeholder="sk-or-v1-..."
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-k8s-gray text-sm font-medium mb-2">
                            Provider
                          </label>
                          <select
                            name="provider"
                            value={createApiKeyForm.provider}
                            onChange={handleCreateApiKeyChange}
                            className="k8s-input w-full"
                          >
                            <option value="openrouter">OpenRouter</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-k8s-gray text-sm font-medium mb-2">
                            Description
                          </label>
                          <textarea
                            name="description"
                            value={createApiKeyForm.description}
                            onChange={handleCreateApiKeyChange}
                            className="k8s-input w-full h-20 resize-none"
                            placeholder="Optional description..."
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-3 mt-6">
                        <button
                          type="submit"
                          className="k8s-button-primary flex-1"
                          disabled={loading.apiKeyAction}
                        >
                          {loading.apiKeyAction ? (
                            <Loader2 className="w-4 h-4 animate-k8s-spin mx-auto" />
                          ) : (
                            editingApiKey ? 'Update API Key' : 'Create API Key'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={resetApiKeyForm}
                          className="k8s-button-secondary flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              
              {loading.apiKeys ? (
                <div className="text-center py-12">
                  <div className="k8s-loader mx-auto"></div>
                  <p className="text-k8s-gray mt-4">Loading API keys...</p>
                </div>
              ) : (
                <div className="k8s-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-k8s-dark/50 border-b border-k8s-purple/20">
                        <tr>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">API Key</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Provider</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Status</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Usage</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Created</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-8 text-k8s-gray">
                              No API keys configured yet. Add your first API key to enable AI features.
                            </td>
                          </tr>
                        ) : (
                          apiKeys.map((apiKey) => (
                            <tr key={apiKey.id} className="border-b border-k8s-gray/20 hover:bg-k8s-dark/30 transition-colors">
                              <td className="py-4 px-6">
                                <div>
                                  <p className="text-white font-medium">{apiKey.name}</p>
                                  {apiKey.description && (
                                    <p className="text-k8s-gray text-sm mt-1">{apiKey.description}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-2 py-1 text-xs bg-k8s-purple/20 text-k8s-purple rounded-full capitalize">
                                  {apiKey.provider}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                {apiKey.is_active ? (
                                  <div className="flex items-center gap-2 text-k8s-green">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm">Active</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-k8s-gray">
                                    <XCircle className="w-4 h-4" />
                                    <span className="text-sm">Inactive</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <div className="text-k8s-gray text-sm">
                                  <p>Used: {apiKey.usage_count || 0}</p>
                                  {apiKey.last_used && (
                                    <p className="text-xs">Last: {formatDate(apiKey.last_used)}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-k8s-gray text-sm">
                                {formatDate(apiKey.created_at)}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  {!apiKey.is_active && (
                                    <button
                                      onClick={() => handleActivateApiKey(apiKey.id)}
                                      className="p-2 text-k8s-green hover:bg-k8s-green/10 rounded transition-colors"
                                      title="Activate"
                                      disabled={loading.apiKeyAction}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditApiKey(apiKey)}
                                    className="p-2 text-k8s-blue hover:bg-k8s-blue/10 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteApiKey(apiKey.id)}
                                    className="p-2 text-k8s-red hover:bg-k8s-red/10 rounded transition-colors"
                                    title="Delete"
                                    disabled={loading.apiKeyAction}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Kubeconfigs Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-k8s-cyan" />
                  Kubernetes Configurations
                </h3>
                <button
                  onClick={() => setShowCreateKubeconfig(true)}
                  className="k8s-button-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Kubeconfig
                </button>
              </div>

              {/* Brief Kubeconfig List */}
              {loading.kubeconfigs ? (
                <div className="text-center py-8">
                  <div className="k8s-loader mx-auto"></div>
                  <p className="text-k8s-gray mt-4">Loading kubeconfigs...</p>
                </div>
              ) : (
                <div className="k8s-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-k8s-dark/50 border-b border-k8s-cyan/20">
                        <tr>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Configuration</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Path</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Status</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Created</th>
                          <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kubeconfigs.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center py-8 text-k8s-gray">
                              No kubeconfigs configured yet. Add your first kubeconfig to connect to your cluster.
                            </td>
                          </tr>
                        ) : (
                          kubeconfigs.map((config) => (
                            <tr key={config.id} className="border-b border-k8s-gray/20 hover:bg-k8s-dark/30 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="text-white font-medium">{config.name}</p>
                                    {config.is_default && (
                                      <span className="inline-block px-2 py-1 text-xs bg-k8s-blue/20 text-k8s-blue rounded-full">
                                        Default
                                      </span>
                                    )}
                                    {config.is_active && (
                                      <span className="inline-block px-2 py-1 text-xs bg-k8s-green/20 text-k8s-green rounded-full ml-2">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {config.description && (
                                  <p className="text-k8s-gray text-sm mt-1">{config.description}</p>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <code className="text-k8s-cyan text-sm bg-k8s-dark/30 px-2 py-1 rounded">
                                  {config.path}
                                </code>
                              </td>
                              <td className="py-4 px-6">
                                {config.is_active ? (
                                  <div className="flex items-center gap-2 text-k8s-green">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm">Active</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-k8s-gray">
                                    <XCircle className="w-4 h-4" />
                                    <span className="text-sm">Inactive</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-k8s-gray text-sm">
                                {formatDate(config.created_at)}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  {!config.is_active && (
                                    <button
                                      onClick={() => handleActivateKubeconfig(config.id)}
                                      className="p-2 text-k8s-green hover:bg-k8s-green/10 rounded transition-colors"
                                      title="Activate"
                                      disabled={loading.kubeconfigAction}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditKubeconfig(config)}
                                    className="p-2 text-k8s-blue hover:bg-k8s-blue/10 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKubeconfig(config.id)}
                                    className="p-2 text-k8s-red hover:bg-k8s-red/10 rounded transition-colors"
                                    title="Delete"
                                    disabled={loading.kubeconfigAction}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;