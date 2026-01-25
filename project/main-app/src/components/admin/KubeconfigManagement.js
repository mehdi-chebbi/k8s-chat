import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, PlayCircle, CheckCircle, XCircle, AlertCircle, Loader2, Lock } from 'lucide-react';
import { apiService } from '../../services/apiService';

const KubeconfigManagement = ({ user, onError, onHealthUpdate }) => {
  const [kubeconfigs, setKubeconfigs] = useState([]);
  const [showCreateKubeconfig, setShowCreateKubeconfig] = useState(false);
  const [editingKubeconfig, setEditingKubeconfig] = useState(null);
  const [createKubeconfigForm, setCreateKubeconfigForm] = useState({
    name: '',
    cluster_url: '',
    sa_token: '',
    ca_certificate: '',
    namespace: '',
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

    // Validation
    if (!createKubeconfigForm.name) {
      setError('Please fill in configuration name');
      return;
    }

    if (!createKubeconfigForm.cluster_url || !createKubeconfigForm.sa_token) {
      setError('Please fill in cluster URL and service account token');
      return;
    }

    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    setError('');

    try {
      const payload = {
        ...createKubeconfigForm,
        created_by: user.id
      };

      const result = await apiService.createKubeconfig(payload);

      if (result.success) {
        setShowCreateKubeconfig(false);
        resetForm();
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
      cluster_url: kubeconfig.cluster_url || '',
      sa_token: '', // Never show token for security
      ca_certificate: kubeconfig.ca_certificate || '',
      namespace: kubeconfig.namespace || '',
      description: kubeconfig.description || '',
      is_default: kubeconfig.is_default
    });
    setShowCreateKubeconfig(true);
  };

  const handleUpdateKubeconfig = async (e) => {
    e.preventDefault();

    // Validation
    if (!createKubeconfigForm.name) {
      setError('Please fill in configuration name');
      return;
    }

    setLoading(prev => ({ ...prev, kubeconfigAction: true }));
    setError('');

    try {
      const payload = {
        ...createKubeconfigForm
      };

      // Only include token if provided (user needs to re-enter it for security)
      if (!payload.sa_token) {
        delete payload.sa_token;
      }

      const result = await apiService.updateKubeconfig(editingKubeconfig.id, payload);

      if (result.success) {
        setShowCreateKubeconfig(false);
        setEditingKubeconfig(null);
        resetForm();
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

  const resetForm = () => {
    setCreateKubeconfigForm({
      name: '',
      cluster_url: '',
      sa_token: '',
      ca_certificate: '',
      namespace: '',
      description: '',
      is_default: false
    });
    setEditingKubeconfig(null);
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
          <Lock className="w-6 h-6 text-k8s-cyan" />
        </div>
      </div>

      {/* Create/Edit Kubeconfig Modal */}
      {showCreateKubeconfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="k8s-card p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingKubeconfig ? 'Edit Kubeconfig' : 'Add New Kubeconfig'}
              </h3>
              <button
                onClick={resetForm}
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

              {/* Service Account fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="kubeconfig-cluster-url" className="block text-sm font-medium text-k8s-gray mb-2">
                    Cluster URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="kubeconfig-cluster-url"
                    name="cluster_url"
                    value={createKubeconfigForm.cluster_url}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full font-mono text-sm"
                    placeholder="https://k8s.example.com:6443"
                    disabled={loading.kubeconfigAction}
                  />
                </div>

                <div>
                  <label htmlFor="kubeconfig-sa-token" className="block text-sm font-medium text-k8s-gray mb-2">
                    Service Account Token <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    id="kubeconfig-sa-token"
                    name="sa_token"
                    value={createKubeconfigForm.sa_token}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full font-mono text-sm"
                    placeholder={editingKubeconfig ? "••••••••••••••••" : "Enter SA token"}
                    disabled={loading.kubeconfigAction}
                  />
                  {editingKubeconfig && (
                    <p className="text-xs text-k8s-gray mt-1">
                      Leave blank to keep existing token (for security)
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="kubeconfig-ca-cert" className="block text-sm font-medium text-k8s-gray mb-2">
                    CA Certificate (Optional)
                  </label>
                  <textarea
                    id="kubeconfig-ca-cert"
                    name="ca_certificate"
                    value={createKubeconfigForm.ca_certificate}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full h-20 resize-none font-mono text-xs"
                    placeholder="Paste base64 CA certificate (optional)"
                    disabled={loading.kubeconfigAction}
                  />
                </div>

                <div>
                  <label htmlFor="kubeconfig-namespace" className="block text-sm font-medium text-k8s-gray mb-2">
                    Namespace (Optional)
                  </label>
                  <input
                    type="text"
                    id="kubeconfig-namespace"
                    name="namespace"
                    value={createKubeconfigForm.namespace}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full font-mono text-sm"
                    placeholder="default, production, etc."
                    disabled={loading.kubeconfigAction}
                  />
                </div>
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
                  onClick={resetForm}
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
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Type</th>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Path/URL</th>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Test Result</th>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Created</th>
                  <th className="text-left py-4 px-6 text-k8s-gray font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {kubeconfigs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-k8s-gray">
                      No kubeconfigs configured yet. Click "Add Kubeconfig" to get started.
                    </td>
                  </tr>
                ) : (
                  kubeconfigs.map((config) => (
                    <tr key={config.id} className="border-b border-k8s-blue/10 hover:bg-k8s-blue/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-white">{config.name}</div>
                        {config.description && (
                          <div className="text-sm text-k8s-gray">{config.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium bg-k8s-cyan/20 text-k8s-cyan">
                          <Lock className="w-3 h-3" />
                          Service Account
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-k8s-gray font-mono">
                          {config.cluster_url}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {config.is_active ? (
                          <span className="inline-flex items-center gap-1 text-k8s-green">
                            <CheckCircle className="w-4 h-4" />
                            Active
                          </span>
                        ) : (
                          <span className="text-k8s-gray">Inactive</span>
                        )}
                        {config.is_default && (
                          <span className="ml-2 inline-block px-2 py-1 rounded text-xs bg-k8s-blue/20 text-k8s-blue">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {config.test_status === 'passed' ? (
                          <span className="inline-flex items-center gap-1 text-k8s-green">
                            <CheckCircle className="w-4 h-4" />
                            Passed
                          </span>
                        ) : config.test_status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-k8s-red">
                            <XCircle className="w-4 h-4" />
                            Failed
                          </span>
                        ) : (
                          <span className="text-k8s-gray">Untested</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-k8s-gray">
                        {formatDate(config.created_at)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestKubeconfig(config.id)}
                            disabled={loading.kubeconfigAction}
                            className="p-2 rounded hover:bg-k8s-blue/20 text-k8s-gray hover:text-white transition-colors"
                            title="Test connection"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditKubeconfig(config)}
                            disabled={loading.kubeconfigAction}
                            className="p-2 rounded hover:bg-k8s-blue/20 text-k8s-gray hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteKubeconfig(config.id)}
                            disabled={loading.kubeconfigAction}
                            className="p-2 rounded hover:bg-red-500/20 text-k8s-gray hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {!config.is_active && (
                            <button
                              onClick={() => handleActivateKubeconfig(config.id)}
                              disabled={loading.kubeconfigAction}
                              className="p-2 rounded hover:bg-k8s-green/20 text-k8s-gray hover:text-k8s-green transition-colors"
                              title="Activate"
                            >
                              <PlayCircle className="w-4 h-4" />
                            </button>
                          )}
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
  );
};

export default KubeconfigManagement;
