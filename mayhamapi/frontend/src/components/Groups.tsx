import React, { useState, useEffect } from 'react';
import { Group, GroupMember, GroupJoinRequest, User, apiClient } from '../services/api';

interface GroupsProps {
  user: User | null;
}

export const Groups: React.FC<GroupsProps> = ({ user }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Group & { is_member: boolean })[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Join group state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedGroupToJoin, setSelectedGroupToJoin] = useState<Group | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // New group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);
  const [newGroupPassword, setNewGroupPassword] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit group form state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupIsPublic, setEditGroupIsPublic] = useState(true);
  const [editGroupPassword, setEditGroupPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);

  // Add member form state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUserRole, setSelectedUserRole] = useState('member');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);

  // Invitation form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [showJoinRequests, setShowJoinRequests] = useState(false);

  useEffect(() => {
    loadGroups();
    loadAllUsers();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers(selectedGroup.id);
      loadJoinRequests(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadGroupDetails = async (groupId: string) => {
    try {
      const result = await apiClient.getGroupById(groupId);
      setSelectedGroup(result.group);
      setIsGroupAdmin(result.is_admin);
      // A user is the owner only if they created the group. Previous logic treated
      // private groups as owned by everyone which caused incorrect UI/permission
      // gating and runtime mismatches. Keep ownership strictly to the creator.
      setIsGroupOwner(result.group.created_by === user?.id);
    } catch (err) {
      console.error('Failed to load group details:', err);
    }
  };

  const loadJoinRequests = async (groupId: string) => {
    try {
      const requests = await apiClient.getGroupJoinRequests(groupId);
      // Ensure we always have an array (API may return null/undefined)
      setJoinRequests(Array.isArray(requests) ? requests : []);
    } catch (err) {
      console.error('Failed to load join requests:', err);
      setJoinRequests([]);
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const groupsList = await apiClient.getUserGroups();
      // Ensure we always have an array, even if the API returns null/undefined
      setGroups(Array.isArray(groupsList) ? groupsList : []);
    } catch (err) {
      setError('Failed to load groups');
      console.error(err);
      // Set empty array on error to prevent null reference
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const usersList = await apiClient.getUsers();
      // Ensure we always have an array
      setAllUsers(Array.isArray(usersList) ? usersList : []);
    } catch (err) {
      console.error('Failed to load users:', err);
      // Set empty array on error
      setAllUsers([]);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const result = await apiClient.getGroupMembers(groupId);
      // Ensure we always have an array for members and joinRequests
      setGroupMembers(Array.isArray(result.members) ? result.members : []);
      setIsGroupAdmin(result.is_admin || false);
    } catch (err) {
      setError('Failed to load group members');
      console.error(err);
      // Set empty array on error
      setGroupMembers([]);
      setIsGroupAdmin(false);
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
        is_public: newGroupIsPublic,
        password: newGroupPassword || undefined,
      });
      
      // Ensure groups is an array before spreading
      const currentGroups = Array.isArray(groups) ? groups : [];
      setGroups([...currentGroups, newGroup]);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupIsPublic(true);
      setNewGroupPassword('');
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
    if (selectedUserIds.length === 0 || !selectedGroup) return;

    try {
      setLoading(true);
      // Loop through all selected users and add them to the group
      for (const userId of selectedUserIds) {
        try {
          await apiClient.addGroupMember(selectedGroup.id, {
            user_id: userId,
            role: selectedUserRole,
          });
        } catch (err) {
          console.error(`Failed to add user ${userId}:`, err);
          // Continue with other users even if one fails
        }
      }
      
      // Reload group members
      await loadGroupMembers(selectedGroup.id);
      setSelectedUserIds([]);
      setSelectedUserRole('member');
      setShowAddMemberForm(false);
      setError(null);
    } catch (err) {
      setError('Failed to add group members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const results = await apiClient.searchGroups(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      setError('Failed to search groups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClick = (group: Group) => {
    setSelectedGroupToJoin(group);
    setShowJoinModal(true);
    setJoinPassword('');
  };

  const handleJoinGroup = async () => {
    if (!selectedGroupToJoin) return;

    try {
      setIsJoining(true);
      if (selectedGroupToJoin.is_public) {
        await apiClient.joinGroup(selectedGroupToJoin.id);
      } else {
        await apiClient.joinGroup(selectedGroupToJoin.id, { password: joinPassword });
      }
      setSuccessMessage(`Successfully joined ${selectedGroupToJoin.name}`);
      setShowJoinModal(false);
      setShowSearchResults(false);
      await loadGroups();
      if (selectedGroupToJoin) {
        setSelectedGroup(selectedGroupToJoin);
        await loadGroupDetails(selectedGroupToJoin.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleRequestJoin = async (group: Group) => {
    try {
      await apiClient.requestToJoinGroup(group.id);
      setSuccessMessage(`Join request sent to ${group.name}`);
      setShowSearchResults(false);
      setSearchResults(prev => prev.map(g => 
        g.id === group.id ? { ...g, is_member: true } : g
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to send join request');
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    try {
      setLoading(true);
      const data: any = {
        name: editGroupName || undefined,
        description: editGroupDescription || undefined,
        is_public: editGroupIsPublic,
      };
      
      if (clearPassword) {
        data.password = '';
      } else if (editGroupPassword) {
        data.password = editGroupPassword;
      }

      const updated = await apiClient.updateGroup(selectedGroup.id, data);
      setSelectedGroup(updated);
      setShowEditForm(false);
      setSuccessMessage('Group updated successfully');
      await loadGroups();
    } catch (err) {
      setError('Failed to update group');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!selectedGroup || !confirm('Are you sure you want to remove this member?')) return;

    try {
      await apiClient.removeGroupMember(selectedGroup.id, memberUserId);
      await loadGroupMembers(selectedGroup.id);
      setSuccessMessage('Member removed successfully');
    } catch (err) {
      setError('Failed to remove member');
      console.error(err);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!selectedGroup) return;

    try {
      await apiClient.approveJoinRequest(selectedGroup.id, requestId);
      await loadJoinRequests(selectedGroup.id);
      await loadGroupMembers(selectedGroup.id);
      setSuccessMessage('Join request approved');
    } catch (err) {
      setError('Failed to approve request');
      console.error(err);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!selectedGroup) return;

    try {
      await apiClient.rejectJoinRequest(selectedGroup.id, requestId);
      await loadJoinRequests(selectedGroup.id);
      setSuccessMessage('Join request rejected');
    } catch (err) {
      setError('Failed to reject request');
      console.error(err);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !inviteEmail.trim()) return;

    try {
      setLoading(true);
      const result = await apiClient.createGroupInvitation(selectedGroup.id, { email: inviteEmail });
      setInviteLink(result.invite_link);
      setSuccessMessage('Invitation created');
    } catch (err) {
      setError('Failed to create invitation');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUserIds(availableUsers.map(u => u.id));
  };

  const deselectAllUsers = () => {
    setSelectedUserIds([]);
  };

  const availableUsers = allUsers.filter(user => 
    !groupMembers.some(member => member.user_id === user.id)
  );

  if (loading && (!groups || groups.length === 0)) {
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

      {/* Search Groups */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Find Groups</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for public groups..."
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Search
          </button>
        </form>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Search Results</h4>
            {searchResults.map((group) => (
              <div
                key={group.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <h5 className="font-medium">{group.name}</h5>
                  {group.description && (
                    <p className="text-sm text-gray-600">{group.description}</p>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${group.is_public ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {group.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
                {group.is_member ? (
                  <span className="text-green-600 font-medium">Joined</span>
                ) : group.is_public ? (
                  <button
                    onClick={() => handleJoinClick(group)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Join
                  </button>
                ) : (
                  <button
                    onClick={() => handleRequestJoin(group)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Request Join
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
          <button
            onClick={() => setSuccessMessage(null)}
            className="float-right font-bold text-green-700 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && selectedGroupToJoin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Join {selectedGroupToJoin.name}</h3>
            {!selectedGroupToJoin.is_public && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password (required for private groups)
                </label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleJoinGroup}
                disabled={isJoining || (!selectedGroupToJoin.is_public && !joinPassword)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join Group'}
              </button>
              <button
                onClick={() => setShowJoinModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
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
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newGroupIsPublic}
                  onChange={(e) => setNewGroupIsPublic(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Public Group</span>
              </label>
            </div>
            {!newGroupIsPublic && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Password (optional - for private groups)
                </label>
                <input
                  type="password"
                  value={newGroupPassword}
                  onChange={(e) => setNewGroupPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank for no password"
                />
              </div>
            )}
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
          {!groups || groups.length === 0 ? (
            <p className="text-gray-500">You are not a member of any groups yet.</p>
          ) : (
            <div className="space-y-2">
              {(groups || []).map((group) => (
                <div
                  key={group.id}
                  onClick={async () => {
                    setSelectedGroup(group);
                    await loadGroupDetails(group.id);
                  }}
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
                    Created {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Unknown'}
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
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${selectedGroup.is_public ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {selectedGroup.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
                {(isGroupAdmin || isGroupOwner) && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditGroupName(selectedGroup.name);
                        setEditGroupDescription(selectedGroup.description || '');
                        setEditGroupIsPublic(selectedGroup.is_public);
                        setEditGroupPassword('');
                        setClearPassword(false);
                        setShowEditForm(true);
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowAddMemberForm(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Add Members
                    </button>
                  </div>
                )}
              </div>

               {/* Edit Group Form */}
               {/* Allow the edit form for owners or admins (visibility controlled by the
                   button above). This aligns the button visibility with the form
                   rendering and avoids cases where a button is clickable but
                   the form is hidden causing confusing state. */}
               {showEditForm && (isGroupOwner || isGroupAdmin) && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium mb-3">Edit Group</h4>
                  <form onSubmit={handleUpdateGroup} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editGroupDescription}
                        onChange={(e) => setEditGroupDescription(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editGroupIsPublic}
                        onChange={(e) => setEditGroupIsPublic(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Public Group</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        value={editGroupPassword}
                        onChange={(e) => setEditGroupPassword(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="New password (leave blank to keep current)"
                      />
                      <label className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          checked={clearPassword}
                          onChange={(e) => setClearPassword(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Remove password</span>
                      </label>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditForm(false)}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Admin Actions */}
              {isGroupAdmin && (
                <div className="mb-4 space-y-2">
                  <button
                    onClick={() => {
                      setInviteEmail('');
                      setInviteLink('');
                      setShowInviteForm(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Create Invite
                  </button>
                  {joinRequests.length > 0 && (
                    <button
                      onClick={() => setShowJoinRequests(!showJoinRequests)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      View Requests ({joinRequests.length})
                    </button>
                  )}
                </div>
              )}

              {/* Invite Form */}
              {showInviteForm && isGroupAdmin && (
                <div className="mb-4 p-4 bg-purple-50 rounded-md">
                  <h4 className="font-medium mb-3">Create Invitation</h4>
                  <form onSubmit={handleCreateInvitation} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Generate Invite Link
                    </button>
                    {inviteLink && (
                      <div className="mt-3 p-2 bg-white border rounded">
                        <p className="text-xs text-gray-500 mb-1">Invite Link:</p>
                        <code className="text-xs break-all">{inviteLink}</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(inviteLink)}
                          className="ml-2 text-blue-600 text-xs hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Join Requests */}
              {showJoinRequests && isGroupAdmin && joinRequests.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-md">
                  <h4 className="font-medium mb-3">Join Requests</h4>
                  <div className="space-y-2">
                    {joinRequests.map((request) => (
                      <div key={request.id} className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="font-medium">{request.user?.name || 'Unknown'}</span>
                          <span className="text-gray-500 text-sm ml-2">({request.user?.email})</span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproveRequest(request.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Member Form */}
              {showAddMemberForm && isGroupAdmin && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium mb-3">Add Members</h4>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Select Users ({selectedUserIds.length} selected)
                        </label>
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={selectAllUsers}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={deselectAllUsers}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                        {availableUsers.length === 0 ? (
                          <p className="text-sm text-gray-500 p-2">All users are already members</p>
                        ) : (
                          availableUsers.map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={() => toggleUserSelection(user.id)}
                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm">
                                {user.name} <span className="text-gray-500">({user.email})</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role for Selected Users
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
                        disabled={selectedUserIds.length === 0 || loading}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Adding...' : `Add ${selectedUserIds.length} Member${selectedUserIds.length !== 1 ? 's' : ''}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMemberForm(false);
                          setSelectedUserIds([]);
                        }}
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
                  Members ({(groupMembers || []).length})
                </h4>
                {!groupMembers || groupMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(groupMembers || []).map((member) => (
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
                              member.role === 'owner'
                                ? 'bg-red-100 text-red-800'
                                : member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {member.role}
                          </span>
                          {isGroupAdmin && member.role !== 'owner' && member.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              Remove
                            </button>
                          )}
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
