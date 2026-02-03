import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, PlayCircle, CheckCircle, XCircle, AlertCircle, Loader2, Lock, Server, Shield, Calendar, Activity, HelpCircle } from 'lucide-react';
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
    is_default: false
  });
  const [loading, setLoading] = useState({
    kubeconfigs: false,
    kubeconfigAction: false
  });
  const [error, setError] = useState('');
  const [showTooltip, setShowTooltip] = useState({
    name: false,
    cluster_url: false,
    sa_token: false,
    ca_certificate: false
  });

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

    if (!createKubeconfigForm.name) {
      setError('Please fill in configuration name');
      return;
    }

    if (!createKubeconfigForm.cluster_url || !createKubeconfigForm.sa_token || !createKubeconfigForm.ca_certificate) {
      setError('Please fill in cluster URL, service account token, and CA certificate');
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
      sa_token: '',
      ca_certificate: kubeconfig.ca_certificate || '',
      is_default: kubeconfig.is_default
    });
    setShowCreateKubeconfig(true);
  };

  const handleUpdateKubeconfig = async (e) => {
    e.preventDefault();

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
      if (result.success || result.data?.test_status) {
        const testStatus = result.data?.test_status || (result.success ? 'passed' : 'failed');
        const message = result.data?.message || result.message || 'Test completed';

        alert(message + (result.data?.details?.output ? '\n\n' + result.data.details.output : ''));

        // Update local state immediately with the test status from response
        setKubeconfigs(prev => prev.map(config =>
          config.id === kubeconfigId
            ? {
                ...config,
                test_status: testStatus,
                last_tested: result.data?.test_timestamp || new Date().toISOString(),
                test_message: result.data?.message || message
              }
            : config
        ));
      } else {
        onError(result.error || 'Test failed');
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
      is_default: false
    });
    setEditingKubeconfig(null);
    setShowCreateKubeconfig(false);
    setError('');
    setShowTooltip({
      name: false,
      cluster_url: false,
      sa_token: false,
      ca_certificate: false
    });
  };

  const toggleTooltip = (field) => {
    setShowTooltip(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-blue/10 via-k8s-cyan/10 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-k8s-blue/20 rounded-lg border border-k8s-blue/30">
                  <Server className="w-5 h-5 text-k8s-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Kubernetes Configurations</h2>
                  <p className="text-xs text-k8s-gray mt-0.5">Manage your cluster connections and credentials</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateKubeconfig(true)}
              className="k8s-button-primary flex items-center gap-2 px-4 py-2 text-sm shadow-lg shadow-k8s-blue/20 hover:shadow-k8s-blue/30 transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Add Configuration
            </button>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-k8s-blue/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-green/10 rounded-lg">
                <CheckCircle className="w-4 h-4 text-k8s-green" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{kubeconfigs.filter(k => k.is_active).length}</p>
                <p className="text-xs text-k8s-gray">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-cyan/10 rounded-lg">
                <Shield className="w-4 h-4 text-k8s-cyan" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{kubeconfigs.length}</p>
                <p className="text-xs text-k8s-gray">Total Configs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-blue/10 rounded-lg">
                <Activity className="w-4 h-4 text-k8s-blue" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{kubeconfigs.filter(k => k.test_status === 'passed').length}</p>
                <p className="text-xs text-k8s-gray">Tested</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateKubeconfig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="k8s-card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-2 border-k8s-blue/30 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-k8s-blue/20 rounded-lg">
                  {editingKubeconfig ? <Edit2 className="w-4 h-4 text-k8s-cyan" /> : <Plus className="w-4 h-4 text-k8s-cyan" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingKubeconfig ? 'Edit Configuration' : 'New Configuration'}
                  </h3>
                  <p className="text-xs text-k8s-gray">
                    {editingKubeconfig ? 'Update your cluster configuration' : 'Add a new Kubernetes cluster'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetForm}
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

            <form onSubmit={editingKubeconfig ? handleUpdateKubeconfig : handleCreateKubeconfig} className="space-y-4">
              {/* Name Field */}
              <div className="space-y-1.5">
                <label htmlFor="kubeconfig-name" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-k8s-cyan" />
                  Configuration Name
                  <button
                    type="button"
                    onClick={() => toggleTooltip('name')}
                    className="ml-1 p-0.5 hover:bg-k8s-blue/20 rounded-full transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-k8s-gray hover:text-k8s-cyan" />
                  </button>
                </label>
                {showTooltip.name && (
                  <div className="p-2 bg-k8s-blue/10 border border-k8s-blue/30 rounded-lg text-xs text-k8s-gray animate-slideDown">
                    Put the name you want for this kubeconfig. This is just a label to help you identify this cluster configuration.
                  </div>
                )}
                <input
                  type="text"
                  id="kubeconfig-name"
                  name="name"
                  value={createKubeconfigForm.name}
                  onChange={handleCreateKubeconfigChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="e.g., Production Cluster"
                  disabled={loading.kubeconfigAction}
                />
              </div>

              {/* Cluster Details Section */}
              <div className="space-y-3 p-4 bg-k8s-dark/30 rounded-xl border border-k8s-blue/20">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-k8s-cyan" />
                  Authentication Details
                </h4>

                <div className="space-y-1.5">
                  <label htmlFor="kubeconfig-cluster-url" className="block text-xs font-semibold text-white">
                    Cluster URL <span className="text-red-400">*</span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('cluster_url')}
                      className="ml-1 p-0.5 hover:bg-k8s-blue/20 rounded-full transition-colors inline-flex"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-k8s-gray hover:text-k8s-cyan" />
                    </button>
                  </label>
                  {showTooltip.cluster_url && (
                    <div className="p-2 bg-k8s-blue/10 border border-k8s-blue/30 rounded-lg text-xs text-k8s-gray animate-slideDown">
                      The API server endpoint URL of your Kubernetes cluster. You can get this by running:<br />
                      <code className="block mt-1 p-1.5 bg-k8s-dark/50 rounded font-mono text-xs text-k8s-cyan">kubectl config view --minify -o jsonpath='&#123;.clusters[0].cluster.server&#125;'</code>
                    </div>
                  )}
                  <input
                    type="text"
                    id="kubeconfig-cluster-url"
                    name="cluster_url"
                    value={createKubeconfigForm.cluster_url}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full font-mono text-xs transition-all duration-200 focus:scale-[1.01] py-2"
                    placeholder="https://k8s.example.com:6443"
                    disabled={loading.kubeconfigAction}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="kubeconfig-sa-token" className="block text-xs font-semibold text-white">
                    Service Account Token <span className="text-red-400">*</span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('sa_token')}
                      className="ml-1 p-0.5 hover:bg-k8s-blue/20 rounded-full transition-colors inline-flex"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-k8s-gray hover:text-k8s-cyan" />
                    </button>
                  </label>
                  {showTooltip.sa_token && (
                    <div className="p-2 bg-k8s-blue/10 border border-k8s-blue/30 rounded-lg text-xs text-k8s-gray animate-slideDown">
                      To get a service account token, run these commands:<br />
                      <pre><code>kubectl create token &lt;service-account-name&gt; -n &lt;namespace&gt;</code></pre>

                      <p className="mt-1 text-xs">Or for long-lived tokens, create a secret with the token manually.</p>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="password"
                      id="kubeconfig-sa-token"
                      name="sa_token"
                      value={createKubeconfigForm.sa_token}
                      onChange={handleCreateKubeconfigChange}
                      className="k8s-input w-full font-mono text-xs pr-10 transition-all duration-200 focus:scale-[1.01] py-2"
                      placeholder={editingKubeconfig ? "••••••••••••••••" : "Enter SA token"}
                      disabled={loading.kubeconfigAction}
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-k8s-gray" />
                  </div>
                  {editingKubeconfig && (
                    <p className="text-xs text-k8s-gray flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      Leave blank to keep existing token
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="kubeconfig-ca-cert" className="block text-xs font-semibold text-white">
                    CA Certificate <span className="text-red-400">*</span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('ca_certificate')}
                      className="ml-1 p-0.5 hover:bg-k8s-blue/20 rounded-full transition-colors inline-flex"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-k8s-gray hover:text-k8s-cyan" />
                    </button>
                  </label>
                  {showTooltip.ca_certificate && (
                    <div className="p-2 bg-k8s-blue/10 border border-k8s-blue/30 rounded-lg text-xs text-k8s-gray animate-slideDown">
                      The Certificate Authority certificate for your cluster. Get it by running:<br />
                      <code className="block mt-1 p-1.5 bg-k8s-dark/50 rounded font-mono text-xs text-k8s-cyan">
                        kubectl config view --raw -o jsonpath="&#123;.clusters[0].cluster.certificate-authority-data&#125;"
                      </code>
                    </div>
                  )}
                  <textarea
                    id="kubeconfig-ca-cert"
                    name="ca_certificate"
                    value={createKubeconfigForm.ca_certificate}
                    onChange={handleCreateKubeconfigChange}
                    className="k8s-input w-full h-20 resize-none font-mono text-xs transition-all duration-200 focus:scale-[1.01] py-2"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;Paste base64 CA certificate here&#10;-----END CERTIFICATE-----"
                    disabled={loading.kubeconfigAction}
                  />
                </div>
              </div>

              {/* Default Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-k8s-blue/5 rounded-lg border border-k8s-blue/20">
                <input
                  type="checkbox"
                  id="kubeconfig-default"
                  name="is_default"
                  checked={createKubeconfigForm.is_default}
                  onChange={handleCreateKubeconfigChange}
                  className="w-4 h-4 text-k8s-blue bg-k8s-dark border-k8s-gray rounded focus:ring-k8s-blue transition-all"
                  disabled={loading.kubeconfigAction}
                />
                <label htmlFor="kubeconfig-default" className="text-xs text-white font-medium cursor-pointer flex-1">
                  Set as default configuration
                </label>
                <CheckCircle className="w-4 h-4 text-k8s-cyan" />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3 border-t border-k8s-blue/20">
                <button
                  type="button"
                  onClick={resetForm}
                  className="k8s-button-secondary flex-1 py-2 text-sm transition-all duration-300 hover:scale-105"
                  disabled={loading.kubeconfigAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading.kubeconfigAction}
                  className="k8s-button-primary flex-1 py-2 text-sm flex items-center justify-center gap-2 shadow-lg shadow-k8s-blue/20 transition-all duration-300 hover:scale-105"
                >
                  {loading.kubeconfigAction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingKubeconfig ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      {editingKubeconfig ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      <span>{editingKubeconfig ? 'Update Configuration' : 'Create Configuration'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configurations List */}
      {loading.kubeconfigs ? (
        <div className="k8s-card p-12 text-center">
          <div className="k8s-loader mx-auto"></div>
          <p className="text-k8s-gray mt-4 text-sm">Loading configurations...</p>
        </div>
      ) : kubeconfigs.length === 0 ? (
        <div className="k8s-card p-12 text-center">
          <div className="inline-flex p-4 bg-k8s-blue/10 rounded-2xl mb-4">
            <Server className="w-12 h-12 text-k8s-cyan" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Configurations Yet</h3>
          <p className="text-sm text-k8s-gray mb-6 max-w-md mx-auto">
            Get started by adding your first Kubernetes cluster configuration. Connect to your clusters securely with service account tokens.
          </p>
          <button
            onClick={() => setShowCreateKubeconfig(true)}
            className="k8s-button-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm shadow-lg shadow-k8s-blue/20"
          >
            <Plus className="w-4 h-4" />
            Add Your First Configuration
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {kubeconfigs.map((config, index) => (
            <div
              key={config.id}
              className="k8s-card p-4 hover:shadow-xl hover:shadow-k8s-blue/10 transition-all duration-300 hover:scale-[1.01] border border-k8s-blue/20 hover:border-k8s-cyan/40 animate-slideUp"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left Section - Main Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-k8s-cyan/10 rounded-lg border border-k8s-cyan/30">
                      <Server className="w-5 h-5 text-k8s-cyan" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-white">{config.name}</h3>
                        {config.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-k8s-blue/20 text-k8s-blue border border-k8s-blue/30">
                            <CheckCircle className="w-3 h-3" />
                            Default
                          </span>
                        )}
                        {config.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-k8s-green/20 text-k8s-green border border-k8s-green/30">
                            <Activity className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Shield className="w-3.5 h-3.5 text-k8s-cyan" />
                          <span className="text-k8s-gray">Type:</span>
                          <span className="text-white font-medium">Service Account</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-k8s-cyan" />
                          <span className="text-k8s-gray">Created:</span>
                          <span className="text-white font-medium">{formatDate(config.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs col-span-2">
                          <Activity className="w-3.5 h-3.5 text-k8s-cyan" />
                          <span className="text-k8s-gray">Status:</span>
                          {config.test_status === 'passed' ? (
                            <span className="inline-flex items-center gap-1 text-k8s-green font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Passed
                            </span>
                          ) : config.test_status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-k8s-red font-medium">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="text-k8s-gray font-medium">Untested</span>
                          )}
                        </div>
                      </div>

                      {/* Cluster URL */}
                      <div className="mt-2 p-2 bg-k8s-dark/50 rounded-lg border border-k8s-blue/20">
                        <p className="text-xs text-k8s-gray mb-0.5">Cluster Endpoint</p>
                        <p className="text-xs text-white font-mono">{config.cluster_url}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Section - Actions */}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleTestKubeconfig(config.id)}
                    disabled={loading.kubeconfigAction}
                    className="p-2 rounded-lg bg-k8s-blue/10 hover:bg-k8s-blue/20 text-k8s-cyan hover:text-white transition-all duration-200 hover:scale-110 border border-k8s-blue/20 hover:border-k8s-cyan/40"
                    title="Test connection"
                  >
                    <PlayCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditKubeconfig(config)}
                    disabled={loading.kubeconfigAction}
                    className="p-2 rounded-lg bg-k8s-blue/10 hover:bg-k8s-blue/20 text-k8s-gray hover:text-white transition-all duration-200 hover:scale-110 border border-k8s-blue/20 hover:border-k8s-blue/40"
                    title="Edit configuration"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!config.is_active && (
                    <button
                      onClick={() => handleActivateKubeconfig(config.id)}
                      disabled={loading.kubeconfigAction}
                      className="p-2 rounded-lg bg-k8s-green/10 hover:bg-k8s-green/20 text-k8s-green hover:text-white transition-all duration-200 hover:scale-110 border border-k8s-green/20 hover:border-k8s-green/40"
                      title="Activate configuration"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteKubeconfig(config.id)}
                    disabled={loading.kubeconfigAction}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-k8s-gray hover:text-red-400 transition-all duration-200 hover:scale-110 border border-red-500/20 hover:border-red-500/40"
                    title="Delete configuration"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out forwards;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default KubeconfigManagement;