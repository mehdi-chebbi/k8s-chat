import React, { useState, useEffect } from 'react';
import { Key, Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/apiService';

const ApiKeyManagement = ({ user, onError }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(null);
  const [createApiKeyForm, setCreateApiKeyForm] = useState({
    name: '',
    api_key: '',
    provider: 'openrouter',
    description: ''
  });
  const [loading, setLoading] = useState({
    apiKeys: false,
    apiKeyAction: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoading(prev => ({ ...prev, apiKeys: true }));
    try {
      const result = await apiService.getApiKeys();
      if (result.success) {
        setApiKeys(result.apiKeys);
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error loading API keys');
    } finally {
      setLoading(prev => ({ ...prev, apiKeys: false }));
    }
  };

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
        loadApiKeys();
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
        loadApiKeys();
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
        loadApiKeys();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error deleting API key');
    } finally {
      setLoading(prev => ({ ...prev, apiKeyAction: false }));
    }
  };

  const handleActivateApiKey = async (apiKeyId) => {
    setLoading(prev => ({ ...prev, apiKeyAction: true }));
    try {
      const result = await apiService.activateApiKey(apiKeyId);
      if (result.success) {
        loadApiKeys();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error activating API key');
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
                    disabled={loading.apiKeyAction}
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
                    editingApiKey ? 'Update API Key' : 'Create API Key'
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

      {!loading.apiKeys && apiKeys.length === 0 && (
        <div className="k8s-card p-8 text-center">
          <Key className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray mb-4">No API keys configured yet</p>
          <button 
            onClick={() => setShowCreateApiKey(true)}
            className="k8s-button-primary"
          >
            Add Your First API Key
          </button>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;