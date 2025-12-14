import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class ApiService {
  constructor() {
    // Create base API instance with credentials support
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // This sends HttpOnly cookies automatically
    });

    // Add response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Session expired or invalid - clear user data and redirect to login
          localStorage.removeItem('userData');
          window.location.href = '/login';
        } else if (error.response?.status === 403) {
          // Access denied - show error
          console.error('Access denied:', error.response.data.error);
        }
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async getHealth() {
    try {
      const response = await this.api.get('/health');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Health check error:', error);
      return { success: false, error: error.message };
    }
  }

  // Admin endpoints
  async getUsers() {
    try {
      const response = await this.api.get('/admin/users');
      return { success: true, users: response.data.users };
    } catch (error) {
      console.error('Get users error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get users' };
    }
  }

  async createUser(userData) {
    try {
      const response = await this.api.post('/admin/users', userData);
      return { success: true, user: response.data };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to create user' };
    }
  }

  async banUser(userId) {
    try {
      await this.api.post(`/admin/users/${userId}/ban`);
      return { success: true };
    } catch (error) {
      console.error('Ban user error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to ban user' };
    }
  }

  async unbanUser(userId) {
    try {
      await this.api.post(`/admin/users/${userId}/unban`);
      return { success: true };
    } catch (error) {
      console.error('Unban user error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to unban user' };
    }
  }

  async getActivityLogs(userId = null, limit = 100) {
    try {
      const params = userId ? { user_id: userId, limit } : { limit };
      const response = await this.api.get('/admin/logs', { params });
      return { success: true, logs: response.data.logs };
    } catch (error) {
      console.error('Get activity logs error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get activity logs' };
    }
  }

  // Kubeconfig endpoints
  async getKubeconfigs() {
    try {
      const response = await this.api.get('/admin/kubeconfigs');
      return { success: true, kubeconfigs: response.data.kubeconfigs };
    } catch (error) {
      console.error('Get kubeconfigs error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get kubeconfigs' };
    }
  }

  async createKubeconfig(kubeconfigData) {
    try {
      const response = await this.api.post('/admin/kubeconfigs', kubeconfigData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to create kubeconfig' };
    }
  }

  async updateKubeconfig(kubeconfigId, kubeconfigData) {
    try {
      const response = await this.api.put(`/admin/kubeconfigs/${kubeconfigId}`, kubeconfigData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to update kubeconfig' };
    }
  }

  async deleteKubeconfig(kubeconfigId) {
    try {
      const response = await this.api.delete(`/admin/kubeconfigs/${kubeconfigId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to delete kubeconfig' };
    }
  }

  async activateKubeconfig(kubeconfigId) {
    try {
      const response = await this.api.post(`/admin/kubeconfigs/${kubeconfigId}/activate`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Activate kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to activate kubeconfig' };
    }
  }

  async testKubeconfig(kubeconfigId) {
    try {
      const response = await this.api.post(`/admin/kubeconfigs/${kubeconfigId}/test`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Test kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to test kubeconfig' };
    }
  }

  async getActiveKubeconfig() {
    try {
      const response = await this.api.get('/admin/kubeconfigs/active');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get active kubeconfig error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get active kubeconfig' };
    }
  }

  // API Keys endpoints
  async getApiKeys() {
    try {
      const response = await this.api.get('/admin/api-keys');
      return { success: true, apiKeys: response.data.api_keys };
    } catch (error) {
      console.error('Get API keys error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get API keys' };
    }
  }

  async createApiKey(apiKeyData) {
    try {
      const response = await this.api.post('/admin/api-keys', apiKeyData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create API key error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to create API key' };
    }
  }

  async updateApiKey(apiKeyId, apiKeyData) {
    try {
      const response = await this.api.put(`/admin/api-keys/${apiKeyId}`, apiKeyData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update API key error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to update API key' };
    }
  }

  async deleteApiKey(apiKeyId) {
    try {
      const response = await this.api.delete(`/admin/api-keys/${apiKeyId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete API key error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to delete API key' };
    }
  }

  async activateApiKey(apiKeyId) {
    try {
      const response = await this.api.post(`/admin/api-keys/${apiKeyId}/activate`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Activate API key error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to activate API key' };
    }
  }

  async getActiveApiKey(provider = 'openrouter') {
    try {
      const response = await this.api.get('/admin/api-keys/active', { 
        params: { provider } 
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get active API key error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get active API key' };
    }
  }

  // Chat endpoint
  async chat(message, userId, sessionId = null) {
    try {
      const response = await this.api.post('/chat', {
        message: message,
        user_id: userId,
        session_id: sessionId
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Chat error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to send message' };
    }
  }

  // Session management
  async createSession(userId, title = 'New Chat') {
    try {
      const response = await this.api.post('/user/sessions', {
        user_id: userId,
        title: title
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create session error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to create session' };
    }
  }

  async updateSession(userId, sessionId, title) {
    try {
      const response = await this.api.put(`/user/sessions/${sessionId}`, {
        user_id: userId,
        title: title
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update session error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to update session' };
    }
  }

  async deleteSession(userId, sessionId) {
    try {
      const response = await this.api.delete(`/user/sessions/${sessionId}`, {
        data: { user_id: userId }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete session error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to delete session' };
    }
  }

  // User endpoints
  async getUserPreferences(userId) {
    try {
      const response = await this.api.get('/user/preferences', {
        params: { user_id: userId }
      });
      return { success: true, preferences: response.data.preferences };
    } catch (error) {
      console.error('Get preferences error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get preferences' };
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      await this.api.put('/user/preferences', {
        user_id: userId,
        ...preferences
      });
      return { success: true };
    } catch (error) {
      console.error('Update preferences error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to update preferences' };
    }
  }

  async getUserSessions(userId) {
    try {
      const response = await this.api.get('/user/sessions', {
        params: { user_id: userId }
      });
      return { success: true, sessions: response.data.sessions };
    } catch (error) {
      console.error('Get sessions error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get sessions' };
    }
  }

  async getUserHistory(userId, sessionId = null, limit = 50) {
    try {
      const params = sessionId ? { user_id: userId, session_id: sessionId, limit } : { user_id: userId, limit };
      const response = await this.api.get('/user/history', { params });
      return { success: true, history: response.data.history };
    } catch (error) {
      console.error('Get history error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get history' };
    }
  }

  // Topology endpoints
  async getTopologyNodes() {
    try {
      const response = await this.api.get('/topology/nodes');
      return { success: true, nodes: response.data.nodes, timestamp: response.data.timestamp };
    } catch (error) {
      console.error('Get topology nodes error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get topology nodes' };
    }
  }

  async getNamespaces() {
    try {
      const response = await this.api.get('/topology/namespaces');
      return { success: true, namespaces: response.data.namespaces };
    } catch (error) {
      console.error('Get namespaces error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get namespaces' };
    }
  }

  async getTopologyPods(namespace = 'all') {
    try {
      const params = namespace !== 'all' ? { namespace } : {};
      const response = await this.api.get('/topology/pods', { params });
      return { success: true, pods: response.data.pods, timestamp: response.data.timestamp };
    } catch (error) {
      console.error('Get topology pods error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get topology pods' };
    }
  }

  // LLM Configuration endpoints
  async getSupportedLLMProviders() {
    try {
      const response = await this.api.get('/admin/llm/providers');
      return { success: true, providers: response.data.providers };
    } catch (error) {
      console.error('Get supported LLM providers error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get supported LLM providers' };
    }
  }

  async getLLMConfigs() {
    try {
      const response = await this.api.get('/admin/llm/configs');
      return { success: true, configs: response.data.configs };
    } catch (error) {
      console.error('Get LLM configs error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get LLM configurations' };
    }
  }

  async createLLMConfig(configData) {
    try {
      const response = await this.api.post('/admin/llm/configs', configData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to create LLM configuration' };
    }
  }

  async updateLLMConfig(configId, configData) {
    try {
      const response = await this.api.put(`/admin/llm/configs/${configId}`, configData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to update LLM configuration' };
    }
  }

  async deleteLLMConfig(configId) {
    try {
      const response = await this.api.delete(`/admin/llm/configs/${configId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to delete LLM configuration' };
    }
  }

  async activateLLMConfig(configId) {
    try {
      const response = await this.api.post(`/admin/llm/configs/${configId}/activate`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Activate LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to activate LLM configuration' };
    }
  }

  async testLLMConfig(configId) {
    try {
      const response = await this.api.post(`/admin/llm/configs/${configId}/test`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Test LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to test LLM configuration' };
    }
  }

  async getActiveLLMConfig() {
    try {
      const response = await this.api.get('/admin/llm/configs/active');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get active LLM config error:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to get active LLM configuration' };
    }
  }
}

export const apiService = new ApiService();