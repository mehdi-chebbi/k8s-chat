import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Edit2, Trash2, PlayCircle, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/apiService';

const KubeconfigManagement = ({ user, onError, onHealthUpdate }) => {
  const [kubeconfigs, setKubeconfigs] = useState([]);
  const [showCreateKubeconfig, setShowCreateKubeconfig] = useState(false);
  const [editingKubeconfig, setEditingKubeconfig] = useState(null);
  const [createKubeconfigForm, setCreateKubeconfigForm] = useState({
    name: '',
    path: '',
    description: '',
    is_default: false
  });
  const [loading, setLoading] = useState({
    kubeconfigs: false,
    kubeconfigAction: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadKubeconfigs();
  }, []);

  const loadKubeconfigs = async () => {
    setLoading(prev => ({ ...prev, kubeconfigs: true }));
    try {
      const result = await apiService.getKubeconfigs();
      if (result.success) {
        setKubeconfigs(result.kubeconfigs);
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error loading kubeconfigs');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigs: false }));
    }
  };

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
        loadKubeconfigs();
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
        loadKubeconfigs();
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
        loadKubeconfigs();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error deleting kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const handleActivateKubeconfig = async (kubeconfigId) => {
    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    try {
      const result = await apiService.activateKubeconfig(kubeconfigId);
      if (result.success) {
        loadKubeconfigs();
        // Notify parent to refresh health data
        if (onHealthUpdate) {
          onHealthUpdate();
        }
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error activating kubeconfig');
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
        loadKubeconfigs(); // Refresh to show updated test status
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error testing kubeconfig');
    } finally {
      setLoading(prev => ({ ...prev, kubeconfigAction: false }));
    }
  };

  const resetKubeconfigForm = () => {
    setCreateKubeconfigForm({ name: '', path: '', description: '', is_default: false });
    setEditingKubeconfig(null);
    setShowCreateKubeconfig(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
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
                      <Loader2 className="w-4 h-4 animate-spin" />
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
                              <Loader2 className="w-4 h-4 animate-spin" />
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

      {!loading.kubeconfigs && kubeconfigs.length === 0 && (
        <div className="k8s-card p-8 text-center">
          <FolderOpen className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray mb-4">No kubeconfigs configured yet</p>
          <button 
            onClick={() => setShowCreateKubeconfig(true)}
            className="k8s-button-primary"
          >
            Add Your First Kubeconfig
          </button>
        </div>
      )}
    </div>
  );
};

export default KubeconfigManagement;