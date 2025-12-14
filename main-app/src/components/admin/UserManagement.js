import React, { useState, useEffect } from 'react';
import { Users, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/apiService';

const UserManagement = ({ user, onError }) => {
  const [users, setUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState({
    users: false,
    create: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(prev => ({ ...prev, users: true }));
    try {
      const result = await apiService.getUsers();
      if (result.success) {
        setUsers(result.users);
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error loading users');
    } finally {
      setLoading(prev => ({ ...prev, users: false }));
    }
  };

  const handleBanUser = async (userId) => {
    try {
      const result = await apiService.banUser(userId);
      if (result.success) {
        loadUsers(); // Refresh users list
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error banning user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      const result = await apiService.unbanUser(userId);
      if (result.success) {
        loadUsers(); // Refresh users list
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error unbanning user');
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
        loadUsers(); // Refresh users list
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
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
                      <Loader2 className="w-4 h-4 animate-spin" />
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
                {users.map((userItem) => (
                  <tr key={userItem.id} className="border-b border-k8s-blue/10 hover:bg-k8s-blue/5 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-white font-medium">{userItem.username}</p>
                        <p className="text-k8s-gray text-sm">{userItem.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        userItem.role === 'admin' 
                          ? 'bg-k8s-purple/20 text-k8s-purple' 
                          : 'bg-k8s-blue/20 text-k8s-blue'
                      }`}>
                        {userItem.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        userItem.is_banned 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-k8s-green/20 text-k8s-green'
                      }`}>
                        {userItem.is_banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-k8s-gray text-sm">
                      {formatDate(userItem.created_at)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        {userItem.is_banned ? (
                          <button
                            onClick={() => handleUnbanUser(userItem.id)}
                            className="px-3 py-1 bg-k8s-green/20 text-k8s-green rounded text-sm hover:bg-k8s-green/30 transition-colors"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBanUser(userItem.id)}
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

      {!loading.users && users.length === 0 && (
        <div className="k8s-card p-8 text-center">
          <Users className="w-12 h-12 text-k8s-gray mx-auto mb-4" />
          <p className="text-k8s-gray mb-4">No users found</p>
          <button 
            onClick={() => setShowCreateUser(true)}
            className="k8s-button-primary"
          >
            Create First User
          </button>
        </div>
      )}
    </div>
  );
};

export default UserManagement;