import React, { useState, useEffect } from 'react';
import { Key, Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2, Server, TestTube } from 'lucide-react';
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
    
    // Validation based on provider
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

      // Add provider-specific fields
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
    
    // Reset provider-specific fields when provider changes
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
    
    // Validation based on provider
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

      // Add provider-specific fields
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
        // Show success message properly
        if (result.data.message) {
          // Use a proper success notification instead of alert
          const successMsg = result.data.message + (result.data.details?.output ? '\n\n' + result.data.details.output : '');
          // Call onError with success flag or create a success handler
          onError(successMsg, 'success');
        }
        loadApiKeys(); // Reload to show updated test status
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
    // Find the API key to check if it's active
    const apiKey = apiKeys.find(key => key.id === apiKeyId);
    const isActive = apiKey?.is_active;
    
    let confirmMessage = 'Are you sure you want to delete this LLM configuration?';
    if (isActive) {
      confirmMessage += '\n\n⚠️ This is currently the active configuration. Deleting it will deactivate it first.';
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
    return new Date(dateString).toLocaleString();
  };

  const getProviderConfig = (providerType) => {
    return supportedProviders.find(p => p.provider === providerType);
  };

  const renderProviderFields = () => {
    const providerConfig = getProviderConfig(createApiKeyForm.provider);
    
    if (!providerConfig) return null;

    return (
      <>
        {providerConfig.config_fields.map((field) => {
          if (field.name === 'api_key' && createApiKeyForm.provider !== 'openrouter') return null;
          if (field.name === 'endpoint_url' && createApiKeyForm.provider !== 'local') return null;
          
          return (
            <div key={field.name}>
              <label className="block text-k8s-gray text-sm font-medium mb-2">
                {field.name.replace('_', ' ').charAt(0).toUpperCase() + field.name.slice(1).replace('_', ' ')}
                {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.name === 'api_key' ? (
                <input
                  type="password"
                  name={field.name}
                  value={createApiKeyForm[field.name] || ''}
                  onChange={handleCreateApiKeyChange}
                  className="k8s-input w-full"
                  placeholder={field.description}
                  required={field.required}
                  disabled={loading.apiKeyAction}
                />
              ) : (
                <input
                  type="text"
                  name={field.name}
                  value={createApiKeyForm[field.name] || ''}
                  onChange={handleCreateApiKeyChange}
                  className="k8s-input w-full"
                  placeholder={field.description}
                  required={field.required}
                  disabled={loading.apiKeyAction}
                />
              )}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Key className="w-6 h-6 text-k8s-purple" />
          LLM Configurations
        </h3>
        <button
          onClick={() => setShowCreateApiKey(true)}
          className="k8s-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add LLM Config
        </button>
      </div>

      {/* Create/Edit LLM Config Modal */}
      {showCreateApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="k8s-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h4 className="text-xl font-semibold text-white mb-6">
              {editingApiKey ? 'Edit LLM Configuration' : 'Add New LLM Configuration'}
            </h4>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}
            
            <form onSubmit={editingApiKey ? handleUpdateApiKey : handleCreateApiKey}>
              <div className="space-y-4">
                <div>
                  <label className="block text-k8s-gray text-sm font-medium mb-2">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={createApiKeyForm.name}
                    onChange={handleCreateApiKeyChange}
                    className="k8s-input w-full"
                    placeholder="e.g., OpenRouter Production, Local LLM"
                    required
                    disabled={loading.apiKeyAction}
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
                    disabled={loading.apiKeyAction}
                  >
                    {supportedProviders.map((provider) => (
                      <option key={provider.provider} value={provider.provider}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  {getProviderConfig(createApiKeyForm.provider) && (
                    <p className="text-k8s-gray text-xs mt-1">
                      {getProviderConfig(createApiKeyForm.provider).description}
                    </p>
                  )}
                </div>
                
                {renderProviderFields()}
                
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
                    disabled={loading.apiKeyAction}
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
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    editingApiKey ? 'Update Configuration' : 'Create Configuration'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetApiKeyForm}
                  className="k8s-button-secondary flex-1"
                  disabled={loading.apiKeyAction}
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
          <p className="text-k8s-gray mt-4">Loading LLM configurations...</p>
        </div>
      ) : (
        <div className="k8s-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-k8s-dark/50 border-b border-k8s-purple/20">
                <tr>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Configuration</th>
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
                      No LLM configurations yet. Add your first configuration to enable AI features.
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
                          {apiKey.test_status && (
                            <div className="flex items-center gap-2 mt-2">
                              {apiKey.test_status === 'success' ? (
                                <div className="flex items-center gap-1 text-k8s-green text-xs">
                                  <CheckCircle className="w-3 h-3" />
                                  Tested successfully
                                </div>
                              ) : apiKey.test_status === 'failed' ? (
                                <div className="flex items-center gap-1 text-k8s-red text-xs">
                                  <XCircle className="w-3 h-3" />
                                  Test failed
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-k8s-gray text-xs">
                                  <TestTube className="w-3 h-3" />
                                  Not tested
                                </div>
                              )}
                              {apiKey.last_tested && (
                                <span className="text-k8s-gray text-xs">
                                  ({formatDate(apiKey.last_tested)})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs bg-k8s-purple/20 text-k8s-purple rounded-full capitalize">
                            {apiKey.provider}
                          </span>
                          {apiKey.provider === 'local' && (
                            <Server className="w-4 h-4 text-k8s-blue" title="Local LLM" />
                          )}
                        </div>
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
                          <button
                            onClick={() => handleTestConnection(apiKey.id)}
                            className="p-2 text-k8s-blue hover:bg-k8s-blue/10 rounded transition-colors"
                            title="Test Connection"
                            disabled={loading.testConnection}
                          >
                            {loading.testConnection ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </button>
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

      {!loading.apiKeys && apiKeys.length === 0 && (
        <div className="k8s-card p-8 text-center">
          <Key className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray mb-4">No LLM configurations yet</p>
          <button 
            onClick={() => setShowCreateApiKey(true)}
            className="k8s-button-primary"
          >
            Add Your First LLM Configuration
          </button>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;