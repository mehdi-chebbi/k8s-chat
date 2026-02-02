import React, { useState, useEffect } from 'react';
import { Key, Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2, Server, TestTube, Zap, Globe, Calendar, MoreVertical, AlertCircle, RefreshCw, Settings, Shield, Lock } from 'lucide-react';
import { apiService } from '../../services/apiService';

const ApiKeyManagement = ({ user, onError }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(null);
  const [supportedProviders, setSupportedProviders] = useState([]);
  const [createApiKeyForm, setCreateApiKeyForm] = useState({
    name: '',
    api_key: '',
    provider: 'openrouter',
    endpoint_url: '',
    model: '',
    description: ''
  });
  const [loading, setLoading] = useState({
    apiKeys: false,
    apiKeyAction: false,
    testConnection: false,
    supportedProviders: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadApiKeys();
    loadSupportedProviders();
  }, []);

  const loadSupportedProviders = async () => {
    setLoading(prev => ({ ...prev, supportedProviders: true }));
    try {
      const result = await apiService.getSupportedLLMProviders();
      if (result.success) {
        setSupportedProviders(result.providers);
      } else {
        console.error('Failed to load supported providers:', result.error);
      }
    } catch (error) {
      console.error('Error loading supported providers:', error);
    } finally {
      setLoading(prev => ({ ...prev, supportedProviders: false }));
    }
  };

  const loadApiKeys = async () => {
    setLoading(prev => ({ ...prev, apiKeys: true }));
    try {
      const result = await apiService.getLLMConfigs();
      if (result.success) {
        setApiKeys(result.configs);
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error loading LLM configurations');
    } finally {
      setLoading(prev => ({ ...prev, apiKeys: false }));
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();

    if (!createApiKeyForm.name) {
      setError('Please fill in configuration name');
      return;
    }

    if (createApiKeyForm.provider === 'openrouter' && !createApiKeyForm.api_key) {
      setError('API key is required for OpenRouter provider');
      return;
    }

    if (createApiKeyForm.provider === 'local' && !createApiKeyForm.endpoint_url) {
      setError('Endpoint URL is required for Local LLM provider');
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    setError('');

    try {
      const configData = {
        name: createApiKeyForm.name,
        provider: createApiKeyForm.provider,
        description: createApiKeyForm.description,
        created_by: user.id
      };

      if (createApiKeyForm.provider === 'openrouter') {
        configData.api_key = createApiKeyForm.api_key;
        configData.model = createApiKeyForm.model || 'minimax/minimax-01';
      } else if (createApiKeyForm.provider === 'local') {
        configData.endpoint_url = createApiKeyForm.endpoint_url;
        configData.model = createApiKeyForm.model || 'default';
      }

      const result = await apiService.createLLMConfig(configData);

      if (result.success) {
        setShowCreateApiKey(false);
        resetApiKeyForm();
        loadApiKeys();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error creating LLM configuration');
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

    if (name === 'provider') {
      setCreateApiKeyForm(prev => ({
        ...prev,
        api_key: value === 'openrouter' ? prev.api_key : '',
        endpoint_url: value === 'local' ? (prev.endpoint_url || 'http://localhost:8080') : '',
        model: value === 'openrouter' ? (prev.model || 'minimax/minimax-01') : (prev.model || 'default')
      }));
    }

    if (error) setError('');
  };

  const handleEditApiKey = (apiKey) => {
    setEditingApiKey(apiKey);
    setCreateApiKeyForm({
      name: apiKey.name,
      api_key: apiKey.api_key || '',
      provider: apiKey.provider,
      endpoint_url: apiKey.endpoint_url || '',
      model: apiKey.model || '',
      description: apiKey.description || ''
    });
    setShowCreateApiKey(true);
  };

  const handleUpdateApiKey = async (e) => {
    e.preventDefault();

    if (!createApiKeyForm.name) {
      setError('Please fill in configuration name');
      return;
    }

    if (createApiKeyForm.provider === 'openrouter' && !createApiKeyForm.api_key) {
      setError('API key is required for OpenRouter provider');
      return;
    }

    if (createApiKeyForm.provider === 'local' && !createApiKeyForm.endpoint_url) {
      setError('Endpoint URL is required for Local LLM provider');
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    setError('');

    try {
      const configData = {
        name: createApiKeyForm.name,
        provider: createApiKeyForm.provider,
        description: createApiKeyForm.description
      };

      if (createApiKeyForm.provider === 'openrouter') {
        configData.api_key = createApiKeyForm.api_key;
        configData.model = createApiKeyForm.model || 'minimax/minimax-01';
      } else if (createApiKeyForm.provider === 'local') {
        configData.endpoint_url = createApiKeyForm.endpoint_url;
        configData.model = createApiKeyForm.model || 'default';
      }

      const result = await apiService.updateLLMConfig(editingApiKey.id, configData);

      if (result.success) {
        setShowCreateApiKey(false);
        setEditingApiKey(null);
        resetApiKeyForm();
        loadApiKeys();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error updating LLM configuration');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleTestConnection = async (configId) => {
    setLoading(prev => ({ ...prev, testConnection: true }));
    try {
      const result = await apiService.testLLMConfig(configId);
      if (result.success) {
        if (result.data.message) {
          const successMsg = result.data.message + (result.data.details?.output ? '\n\n' + result.data.details.output : '');
          onError(successMsg, 'success');
        }
        loadApiKeys();
      } else {
        onError(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      onError('Error testing connection');
    } finally {
      setLoading(prev => ({ ...prev, testConnection: false }));
    }
  };

  const handleDeleteApiKey = async (apiKeyId) => {
    const apiKey = apiKeys.find(key => key.id === apiKeyId);
    const isActive = apiKey?.is_active;

    let confirmMessage = 'Are you sure you want to delete this LLM configuration?';
    if (isActive) {
      confirmMessage += '\n\n⚠️ This is currently active configuration. Deleting it will deactivate it first.';
    }
    confirmMessage += '\n\nThis action cannot be undone.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    try {
      const result = await apiService.deleteLLMConfig(apiKeyId);
      if (result.success) {
        loadApiKeys();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error deleting LLM configuration');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleActivateApiKey = async (apiKeyId) => {
    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    try {
      const result = await apiService.activateLLMConfig(apiKeyId);
      if (result.success) {
        loadApiKeys();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error activating LLM configuration');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const resetApiKeyForm = () => {
    setCreateApiKeyForm({
      name: '',
      api_key: '',
      provider: 'openrouter',
      endpoint_url: '',
      model: '',
      description: ''
    });
    setEditingApiKey(null);
    setShowCreateApiKey(false);
    setError('');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getProviderConfig = (providerType) => {
    return supportedProviders.find(p => p.provider === providerType);
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'openrouter':
        return <Globe className="w-4 h-4" />;
      case 'local':
        return <Server className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const activeConfigs = apiKeys.filter(k => k.is_active).length;
  const testedConfigs = apiKeys.filter(k => k.test_status === 'success').length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-purple/10 via-indigo-500/10 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-k8s-purple/20 rounded-lg border border-k8s-purple/30">
                  <Key className="w-5 h-5 text-k8s-purple" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">LLM Configurations</h2>
                  <p className="text-xs text-k8s-gray mt-0.5">Manage AI model providers and API keys</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateApiKey(true)}
              className="k8s-button-primary flex items-center gap-2 px-4 py-2 text-sm shadow-lg shadow-k8s-purple/20 hover:shadow-k8s-purple/30 transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Add Configuration
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-k8s-purple/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-green/10 rounded-lg">
                <Zap className="w-4 h-4 text-k8s-green" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{activeConfigs}</p>
                <p className="text-xs text-k8s-gray">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-purple/10 rounded-lg">
                <Key className="w-4 h-4 text-k8s-purple" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{apiKeys.length}</p>
                <p className="text-xs text-k8s-gray">Total Configs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-blue/10 rounded-lg">
                <CheckCircle className="w-4 h-4 text-k8s-blue" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{testedConfigs}</p>
                <p className="text-xs text-k8s-gray">Tested</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateApiKey && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="k8s-card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-2 border-k8s-purple/30 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-k8s-purple/20 rounded-lg">
                  {editingApiKey ? <Edit2 className="w-4 h-4 text-k8s-purple" /> : <Plus className="w-4 h-4 text-k8s-purple" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingApiKey ? 'Edit Configuration' : 'New Configuration'}
                  </h3>
                  <p className="text-xs text-k8s-gray">
                    {editingApiKey ? 'Update your AI provider settings' : 'Add a new LLM provider'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetApiKeyForm}
                className="p-1.5 hover:bg-k8s-gray/10 rounded-lg transition-colors text-k8s-gray hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 rounded-lg flex items-start gap-2 animate-slideDown">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-xs mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={editingApiKey ? handleUpdateApiKey : handleCreateApiKey} className="space-y-4">
              {/* Name Field */}
              <div className="space-y-1.5">
                <label htmlFor="config-name" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-k8s-purple" />
                  Configuration Name
                </label>
                <input
                  type="text"
                  id="config-name"
                  name="name"
                  value={createApiKeyForm.name}
                  onChange={handleCreateApiKeyChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="e.g., OpenRouter Production"
                  disabled={loading.apiKeyAction}
                />
              </div>

              {/* Provider Field */}
              <div className="space-y-1.5">
                <label htmlFor="provider" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-k8s-purple" />
                  Provider
                </label>
                <select
                  id="provider"
                  name="provider"
                  value={createApiKeyForm.provider}
                  onChange={handleCreateApiKeyChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  disabled={loading.apiKeyAction}
                >
                  {supportedProviders.map((provider) => (
                    <option key={provider.provider} value={provider.provider}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                {getProviderConfig(createApiKeyForm.provider) && (
                  <p className="text-xs text-k8s-gray mt-1">
                    {getProviderConfig(createApiKeyForm.provider).description}
                  </p>
                )}
              </div>

              {/* Provider-specific Fields */}
              {createApiKeyForm.provider === 'openrouter' && (
                <>
                  {/* API Key Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="api-key" className="block text-xs font-semibold text-white flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-k8s-purple" />
                      API Key <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      id="api-key"
                      name="api_key"
                      value={createApiKeyForm.api_key}
                      onChange={handleCreateApiKeyChange}
                      className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2 font-mono"
                      placeholder="•••••••••••••••••••••"
                      disabled={loading.apiKeyAction}
                    />
                  </div>

                  {/* Model Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="model" className="block text-xs font-semibold text-white flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-k8s-purple" />
                      Model
                    </label>
                    <input
                      type="text"
                      id="model"
                      name="model"
                      value={createApiKeyForm.model}
                      onChange={handleCreateApiKeyChange}
                      className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2 font-mono"
                      placeholder="e.g., minimax/minimax-01"
                      disabled={loading.apiKeyAction}
                    />
                  </div>
                </>
              )}

              {createApiKeyForm.provider === 'local' && (
                <>
                  {/* Endpoint URL Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="endpoint-url" className="block text-xs font-semibold text-white flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-k8s-purple" />
                      Endpoint URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="endpoint-url"
                      name="endpoint_url"
                      value={createApiKeyForm.endpoint_url}
                      onChange={handleCreateApiKeyChange}
                      className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2 font-mono"
                      placeholder="http://localhost:8080"
                      disabled={loading.apiKeyAction}
                    />
                  </div>

                  {/* Model Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="local-model" className="block text-xs font-semibold text-white flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-k8s-purple" />
                      Model
                    </label>
                    <input
                      type="text"
                      id="local-model"
                      name="model"
                      value={createApiKeyForm.model}
                      onChange={handleCreateApiKeyChange}
                      className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2 font-mono"
                      placeholder="e.g., default"
                      disabled={loading.apiKeyAction}
                    />
                  </div>
                </>
              )}

              {/* Description Field */}
              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-k8s-purple" />
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={createApiKeyForm.description}
                  onChange={handleCreateApiKeyChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="Optional notes about this configuration..."
                  rows={3}
                  disabled={loading.apiKeyAction}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetApiKeyForm}
                  className="k8s-button-secondary flex-1"
                  disabled={loading.apiKeyAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading.apiKeyAction}
                  className="k8s-button-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading.apiKeyAction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingApiKey ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingApiKey ? 'Update' : 'Create'} Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configurations List */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-purple/5 via-indigo-500/5 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-k8s-purple" />
              <h3 className="text-base font-bold text-white">Saved Configurations</h3>
            </div>
            <button
              onClick={loadApiKeys}
              className="k8s-button-secondary flex items-center gap-2 px-4 py-2 text-sm transition-all duration-300 hover:scale-105"
              disabled={loading.apiKeys}
            >
              {loading.apiKeys ? (
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

          {loading.apiKeys ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-k8s-purple animate-spin" />
              <p className="text-k8s-gray text-sm">Loading configurations...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Key className="w-12 h-12 text-k8s-gray" />
              <div className="text-center">
                <p className="text-white font-medium">No LLM configurations found</p>
                <p className="text-k8s-gray text-sm mt-1">Add your first configuration to enable AI features</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="relative hover:scale-[1.01] transition-all duration-300 p-4 bg-k8s-dark/30 rounded-xl border border-k8s-purple/20 hover:border-k8s-purple/40"
                >
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      apiKey.is_active
                        ? 'bg-k8s-green/20 text-k8s-green border border-k8s-green/30'
                        : 'bg-k8s-gray/20 text-k8s-gray border border-k8s-gray/30'
                    }`}>
                      <Shield className="w-3.5 h-3.5" />
                      {apiKey.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3 mt-10">
                    {/* Provider Info */}
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        apiKey.is_active
                          ? 'bg-k8s-purple/10'
                          : 'bg-k8s-gray/10'
                      }`}>
                        <div className="text-k8s-purple">
                          {getProviderIcon(apiKey.provider)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-base font-bold text-white truncate">{apiKey.name}</h4>
                          <span className="px-2 py-0.5 bg-k8s-purple/20 text-k8s-purple rounded-full text-xs font-medium capitalize">
                            {apiKey.provider}
                          </span>
                        </div>
                        {apiKey.description && (
                          <p className="text-xs text-k8s-gray line-clamp-2">{apiKey.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Test Status */}
                    {apiKey.test_status && (
                      <div className={`flex items-center gap-2 text-xs ${
                        apiKey.test_status === 'success' ? 'text-k8s-green' :
                        apiKey.test_status === 'failed' ? 'text-k8s-red' :
                        'text-k8s-gray'
                      }`}>
                        {apiKey.test_status === 'success' ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Connection tested successfully
                            {apiKey.last_tested && <span className="ml-1">({formatDate(apiKey.last_tested)})</span>}
                          </>
                        ) : apiKey.test_status === 'failed' ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Connection test failed
                            {apiKey.last_tested && <span className="ml-1">({formatDate(apiKey.last_tested)})</span>}
                          </>
                        ) : (
                          <>
                            <TestTube className="w-3.5 h-3.5" />
                            Not tested yet
                          </>
                        )}
                      </div>
                    )}

                    {/* Usage Stats */}
                    <div className="flex items-center gap-2 text-xs text-k8s-gray">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Usage: {apiKey.usage_count || 0} times</span>
                      {apiKey.last_used && (
                        <span className="ml-2">Last used: {formatDate(apiKey.last_used)}</span>
                      )}
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-2 text-xs text-k8s-gray">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created: {formatDate(apiKey.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-k8s-purple/10">
                      <button
                        onClick={() => handleTestConnection(apiKey.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-k8s-blue/20 text-k8s-blue hover:bg-k8s-blue/30 transition-colors"
                        disabled={loading.testConnection}
                      >
                        {loading.testConnection ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <TestTube className="w-3.5 h-3.5" />
                            Test
                          </>
                        )}
                      </button>

                      {!apiKey.is_active && (
                        <button
                          onClick={() => handleActivateApiKey(apiKey.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-k8s-green/20 text-k8s-green hover:bg-k8s-green/30 transition-colors"
                          disabled={loading.apiKeyAction}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Activate
                        </button>
                      )}

                      <button
                        onClick={() => handleEditApiKey(apiKey)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-k8s-purple/20 text-k8s-purple hover:bg-k8s-purple/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        disabled={loading.apiKeyAction}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
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

export default ApiKeyManagement;
