import React, { useState, useEffect } from 'react';
import { Users, UserPlus, AlertCircle, Loader2, Trash2, Edit2, Shield, Mail, Calendar, UserCheck, Ban, RefreshCw, MoreVertical, Search, Filter } from 'lucide-react';
import { apiService } from '../../services/apiService';

const UserManagement = ({ user, onError }) => {
  const [users, setUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    id: null,
    username: '',
    email: '',
    role: 'user'
  });
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState({
    users: false,
    create: false,
    update: false,
    delete: false,
    ban: false
  });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
    setLoading(prev => ({ ...prev, ban: true }));
    try {
      const result = await apiService.banUser(userId);
      if (result.success) {
        loadUsers();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error banning user');
    } finally {
      setLoading(prev => ({ ...prev, ban: false }));
    }
  };

  const handleUnbanUser = async (userId) => {
    setLoading(prev => ({ ...prev, ban: true }));
    try {
      const result = await apiService.unbanUser(userId);
      if (result.success) {
        loadUsers();
      } else {
        onError(result.error);
      }
    } catch (error) {
      onError('Error unbanning user');
    } finally {
      setLoading(prev => ({ ...prev, ban: false }));
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
        loadUsers();
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
    if (error) setError('');
  };

  const handleEditUser = (userItem) => {
    setEditUserForm({
      id: userItem.id,
      username: userItem.username,
      email: userItem.email,
      role: userItem.role
    });
    setShowEditUser(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    if (!editUserForm.username || !editUserForm.email) {
      setError('Username and email are required');
      return;
    }

    setLoading(prev => ({ ...prev, update: true }));
    setError('');

    try {
      const result = await apiService.updateUser(
        editUserForm.id,
        {
          username: editUserForm.username,
          email: editUserForm.email,
          role: editUserForm.role
        }
      );

      if (result.success) {
        setShowEditUser(false);
        setEditUserForm({ id: null, username: '', email: '', role: 'user' });
        loadUsers();
        onError('User updated successfully', 'success');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error updating user');
    } finally {
      setLoading(prev => ({ ...prev, update: false }));
    }
  };

  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserForm(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleDeleteUser = async (userId, username, e) => {
    e.stopPropagation();

    if (userId === user.id) {
      setError('Cannot delete your own account');
      return;
    }

    if (!window.confirm(
      `Are you sure you want to delete user "${username}"? This action cannot be undone.`
    )) {
      return;
    }

    setLoading(prev => ({ ...prev, delete: true }));
    setError('');

    try {
      const result = await apiService.deleteUser(userId);
      if (result.success) {
        loadUsers();
        onError(`User "${username}" deleted successfully`, 'success');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error deleting user');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredUsers = users.filter(userItem =>
    userItem.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    userItem.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = users.filter(u => !u.is_banned).length;
  const bannedUsers = users.filter(u => u.is_banned).length;
  const adminUsers = users.filter(u => u.role === 'admin').length;

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
                  <Users className="w-5 h-5 text-k8s-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">User Management</h2>
                  <p className="text-xs text-k8s-gray mt-0.5">Manage system users and permissions</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateUser(true)}
              className="k8s-button-primary flex items-center gap-2 px-4 py-2 text-sm shadow-lg shadow-k8s-blue/20 hover:shadow-k8s-blue/30 transition-all duration-300 hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-k8s-blue/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-green/10 rounded-lg">
                <UserCheck className="w-4 h-4 text-k8s-green" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{activeUsers}</p>
                <p className="text-xs text-k8s-gray">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-cyan/10 rounded-lg">
                <Users className="w-4 h-4 text-k8s-cyan" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{users.length}</p>
                <p className="text-xs text-k8s-gray">Total Users</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-k8s-purple/10 rounded-lg">
                <Shield className="w-4 h-4 text-k8s-purple" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{adminUsers}</p>
                <p className="text-xs text-k8s-gray">Admins</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="k8s-card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-2 border-k8s-blue/30 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-k8s-blue/20 rounded-lg">
                  <UserPlus className="w-4 h-4 text-k8s-cyan" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create New User</h3>
                  <p className="text-xs text-k8s-gray">Add a new user to the system</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateUser(false)}
                className="p-1.5 hover:bg-k8s-gray/10 rounded-lg transition-colors text-k8s-gray hover:text-white"
              >
                <AlertCircle className="w-5 h-5" />
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

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label htmlFor="create-username" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-k8s-cyan" />
                  Username
                </label>
                <input
                  type="text"
                  id="create-username"
                  name="username"
                  value={createUserForm.username}
                  onChange={handleCreateUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="e.g., johndoe"
                  disabled={loading.create}
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="create-email" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-k8s-cyan" />
                  Email Address
                </label>
                <input
                  type="email"
                  id="create-email"
                  name="email"
                  value={createUserForm.email}
                  onChange={handleCreateUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="e.g., john@example.com"
                  disabled={loading.create}
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="create-password" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-k8s-cyan" />
                  Password
                </label>
                <input
                  type="password"
                  id="create-password"
                  name="password"
                  value={createUserForm.password}
                  onChange={handleCreateUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="•••••••••"
                  disabled={loading.create}
                />
              </div>

              {/* Role Field */}
              <div className="space-y-1.5">
                <label htmlFor="create-role" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-k8s-cyan" />
                  User Role
                </label>
                <select
                  id="create-role"
                  name="role"
                  value={createUserForm.role}
                  onChange={handleCreateUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
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

      {/* Edit User Modal */}
      {showEditUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="k8s-card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-2 border-k8s-blue/30 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-k8s-blue/20 rounded-lg">
                  <Edit2 className="w-4 h-4 text-k8s-cyan" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit User</h3>
                  <p className="text-xs text-k8s-gray">Update user information and role</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditUser(false);
                  setEditUserForm({ id: null, username: '', email: '', role: 'user' });
                }}
                className="p-1.5 hover:bg-k8s-gray/10 rounded-lg transition-colors text-k8s-gray hover:text-white"
              >
                <AlertCircle className="w-5 h-5" />
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

            <form onSubmit={handleUpdateUser} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label htmlFor="edit-username" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-k8s-cyan" />
                  Username
                </label>
                <input
                  type="text"
                  id="edit-username"
                  name="username"
                  value={editUserForm.username}
                  onChange={handleEditUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="Username"
                  disabled={loading.update}
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="edit-email" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-k8s-cyan" />
                  Email Address
                </label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={editUserForm.email}
                  onChange={handleEditUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  placeholder="Email address"
                  disabled={loading.update}
                />
              </div>

              {/* Role Field */}
              <div className="space-y-1.5">
                <label htmlFor="edit-role" className="block text-xs font-semibold text-white flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-k8s-cyan" />
                  User Role
                </label>
                <select
                  id="edit-role"
                  name="role"
                  value={editUserForm.role}
                  onChange={handleEditUserChange}
                  className="k8s-input w-full transition-all duration-200 focus:scale-[1.01] text-sm py-2"
                  disabled={loading.update}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUser(false);
                    setEditUserForm({ id: null, username: '', email: '', role: 'user' });
                  }}
                  className="k8s-button-secondary flex-1"
                  disabled={loading.update}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading.update}
                  className="k8s-button-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading.update ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Update User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users List Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-k8s-cyan/5 via-k8s-blue/5 to-transparent rounded-2xl blur-xl"></div>
        <div className="relative k8s-card p-4">
          {/* Search Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-k8s-gray" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="k8s-input w-full pl-10 pr-4 py-2 text-sm"
              />
            </div>
            <button
              onClick={loadUsers}
              className="k8s-button-secondary flex items-center gap-2 px-4 py-2 text-sm transition-all duration-300 hover:scale-105"
              disabled={loading.users}
            >
              {loading.users ? (
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

          {/* Loading State */}
          {loading.users ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-k8s-blue animate-spin" />
              <p className="text-k8s-gray text-sm">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Users className="w-12 h-12 text-k8s-gray" />
              <div className="text-center">
                <p className="text-white font-medium">No users found</p>
                <p className="text-k8s-gray text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Create your first user to get started'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredUsers.map((userItem) => (
                <div
                  key={userItem.id}
                  className="relative hover:scale-[1.01] transition-all duration-300 p-4 bg-k8s-dark/30 rounded-xl border border-k8s-blue/20 hover:border-k8s-cyan/40"
                >
                  {/* Role Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      userItem.role === 'admin'
                        ? 'bg-k8s-purple/20 text-k8s-purple border border-k8s-purple/30'
                        : 'bg-k8s-blue/20 text-k8s-blue border border-k8s-blue/30'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {userItem.role}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      userItem.is_banned
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-k8s-green/20 text-k8s-green border border-k8s-green/30'
                    }`}>
                      {userItem.is_banned ? (
                        <>
                          <Ban className="w-3 h-3" />
                          Banned
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3" />
                          Active
                        </>
                      )}
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="space-y-3 mt-10">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        userItem.is_banned
                          ? 'bg-red-500/10'
                          : 'bg-k8s-blue/10'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          userItem.is_banned ? 'text-red-400' : 'text-k8s-blue'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-white truncate">{userItem.username}</h4>
                        <p className="text-xs text-k8s-gray truncate">{userItem.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-k8s-gray">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created {formatDate(userItem.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-k8s-blue/10">
                      <button
                        onClick={() => handleEditUser(userItem)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-k8s-blue/20 text-k8s-blue hover:bg-k8s-blue/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      {userItem.id !== user.id && (
                        <button
                          onClick={(e) => handleDeleteUser(userItem.id, userItem.username, e)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          disabled={loading.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}

                      {userItem.is_banned ? (
                        <button
                          onClick={() => handleUnbanUser(userItem.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-k8s-green/20 text-k8s-green hover:bg-k8s-green/30 transition-colors"
                          disabled={loading.ban}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Unban
                        </button>
                      ) : userItem.id !== user.id && (
                        <button
                          onClick={() => handleBanUser(userItem.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          disabled={loading.ban}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Ban
                        </button>
                      )}
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

export default UserManagement;
