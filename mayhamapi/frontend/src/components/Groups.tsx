import React, { useState, useEffect } from 'react';
import { Group, GroupMember, User, apiClient } from '../services/api';

interface GroupsProps {
  user: User | null;
}

export const Groups: React.FC<GroupsProps> = ({ user }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Add member form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState('member');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);

  useEffect(() => {
    loadGroups();
    loadAllUsers();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const groupsList = await apiClient.getUserGroups();
      setGroups(groupsList);
    } catch (err) {
      setError('Failed to load groups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const usersList = await apiClient.getUsers();
      setAllUsers(usersList);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const result = await apiClient.getGroupMembers(groupId);
      setGroupMembers(result.members);
      setIsGroupAdmin(result.is_admin);
    } catch (err) {
      setError('Failed to load group members');
      console.error(err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setLoading(true);
      const newGroup = await apiClient.createGroup({
        name: newGroupName,
        description: newGroupDescription,
      });
      
      setGroups([...groups, newGroup]);
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateForm(false);
      setSelectedGroup(newGroup);
    } catch (err) {
      setError('Failed to create group');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedGroup) return;

    try {
      const newMember = await apiClient.addGroupMember(selectedGroup.id, {
        user_id: selectedUserId,
        role: selectedUserRole,
      });
      
      // Reload group members
      await loadGroupMembers(selectedGroup.id);
      setSelectedUserId('');
      setSelectedUserRole('member');
      setShowAddMemberForm(false);
    } catch (err) {
      setError('Failed to add group member');
      console.error(err);
    }
  };

  const availableUsers = allUsers.filter(user => 
    !groupMembers.some(member => member.user_id === user.id)
  );

  if (loading && groups.length === 0) {
    return <div className="text-center py-8">Loading groups...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Groups</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Create Group
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Create Group Form */}
      {showCreateForm && (
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Create New Group</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name *
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Groups Sidebar */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">My Groups</h3>
          {groups.length === 0 ? (
            <p className="text-gray-500">You are not a member of any groups yet.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    selectedGroup?.id === group.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <h4 className="font-medium">{group.name}</h4>
                  {group.description && (
                    <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Details */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
          {selectedGroup ? (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedGroup.name}</h3>
                  {selectedGroup.description && (
                    <p className="text-gray-600 mt-1">{selectedGroup.description}</p>
                  )}
                </div>
                {isGroupAdmin && (
                  <button
                    onClick={() => setShowAddMemberForm(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Add Member
                  </button>
                )}
              </div>

              {/* Add Member Form */}
              {showAddMemberForm && isGroupAdmin && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium mb-3">Add Member</h4>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a user</option>
                        {availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        value={selectedUserRole}
                        onChange={(e) => setSelectedUserRole(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Add Member
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMemberForm(false)}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Members List */}
              <div>
                <h4 className="font-medium mb-3">
                  Members ({groupMembers.length})
                </h4>
                {groupMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                      >
                        <div>
                          <span className="font-medium">{member.user?.name || 'Unknown User'}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            ({member.user?.email})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500">Select a group to view details and manage members.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups;