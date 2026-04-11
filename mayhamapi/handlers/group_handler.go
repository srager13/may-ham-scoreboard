package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
)

type GroupHandler struct {
	repo *repository.Repository
}

func NewGroupHandler(repo *repository.Repository) *GroupHandler {
	return &GroupHandler{repo: repo}
}

// CreateGroup creates a new group
func (gh *GroupHandler) CreateGroup(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req models.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group name is required"})
		return
	}

	group, err := gh.repo.CreateGroup(&req, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group"})
		return
	}

	c.JSON(http.StatusCreated, group)
}

// GetUserGroups returns all groups the authenticated user is a member of
func (gh *GroupHandler) GetUserGroups(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	groups, err := gh.repo.GetUserGroups(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user groups"})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// GetGroupMembers returns all members of a specific group
func (gh *GroupHandler) GetGroupMembers(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is a member of the group
	isAdmin, err := gh.repo.IsGroupAdmin(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	// For now, allow any group member to see other members
	// In the future, you might want to restrict this to admins only
	members, err := gh.repo.GetGroupMembers(groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get group members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members, "is_admin": isAdmin})
}

// AddGroupMember adds a new member to a group
func (gh *GroupHandler) AddGroupMember(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is an admin of the group
	isAdmin, err := gh.repo.IsGroupAdmin(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group admins can add members"})
		return
	}

	var req models.AddGroupMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.UserID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Default to member role if not specified
	if req.Role == "" {
		req.Role = "member"
	}

	// Validate role
	if req.Role != "admin" && req.Role != "member" && req.Role != "owner" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be 'admin', 'member', or 'owner'"})
		return
	}

	member, err := gh.repo.AddGroupMember(groupID, req.UserID, req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this group"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add group member"})
		return
	}

	c.JSON(http.StatusCreated, member)
}

// GetGroupUsers returns all users in a group (for team selection)
func (gh *GroupHandler) GetGroupUsers(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is a member of the group
	userGroups, err := gh.repo.GetUserGroups(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group membership"})
		return
	}

	isMember := false
	for _, group := range userGroups {
		if group.ID == groupID {
			isMember = true
			break
		}
	}

	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You must be a member of this group to view its users"})
		return
	}

	users, err := gh.repo.GetGroupUsers(groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get group users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// SearchGroups allows users to search for public groups
func (gh *GroupHandler) SearchGroups(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	groups, err := gh.repo.SearchGroups(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search groups"})
		return
	}

	currentUserGroups, err := gh.repo.GetUserGroups(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user groups"})
		return
	}

	userGroupIDs := make(map[string]bool)
	for _, g := range currentUserGroups {
		userGroupIDs[g.ID] = true
	}

	type SearchResult struct {
		models.Group
		IsMember bool `json:"is_member"`
	}

	results := make([]SearchResult, len(groups))
	for i, g := range groups {
		results[i] = SearchResult{
			Group:    g,
			IsMember: userGroupIDs[g.ID],
		}
	}

	c.JSON(http.StatusOK, results)
}

// GetGroupByID returns a single group by ID
func (gh *GroupHandler) GetGroupByID(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	group, err := gh.repo.GetGroupByID(groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	role, err := gh.repo.GetGroupMemberRole(groupID, userID.(string))
	isMember := role != ""
	isAdmin, _ := gh.repo.IsGroupAdmin(groupID, userID.(string))

	c.JSON(http.StatusOK, gin.H{
		"group":     group,
		"is_member": isMember,
		"is_admin":  isAdmin,
	})
}

// UpdateGroup updates group settings
func (gh *GroupHandler) UpdateGroup(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	isOwner, err := gh.repo.IsGroupOwner(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group owners can update group settings"})
		return
	}

	var req models.UpdateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	group, err := gh.repo.UpdateGroup(groupID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update group"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// JoinGroup allows a user to join a group
func (gh *GroupHandler) JoinGroup(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	group, err := gh.repo.GetGroupByID(groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	role, err := gh.repo.GetGroupMemberRole(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check membership"})
		return
	}
	if role != "" {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this group"})
		return
	}

	if group.IsPublic && group.PasswordHash == "" {
		err = gh.repo.JoinGroup(groupID, userID.(string), nil)
	} else {
		var req models.JoinGroupRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}
		err = gh.repo.JoinGroup(groupID, userID.(string), req.Password)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined group"})
}

// RequestToJoin allows a user to request to join a private group
func (gh *GroupHandler) RequestToJoin(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	_, err := gh.repo.GetGroupByID(groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	role, err := gh.repo.GetGroupMemberRole(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check membership"})
		return
	}
	if role != "" {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this group"})
		return
	}

	existingRequest, err := gh.repo.GetUserJoinRequest(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing request"})
		return
	}
	if existingRequest != nil && existingRequest.Status == "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "Join request already pending"})
		return
	}

	request, err := gh.repo.CreateGroupJoinRequest(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create join request"})
		return
	}

	c.JSON(http.StatusCreated, request)
}

// GetJoinRequests returns pending join requests for a group
func (gh *GroupHandler) GetJoinRequests(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	isAdmin, err := gh.repo.IsGroupAdmin(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group admins can view join requests"})
		return
	}

	requests, err := gh.repo.GetGroupJoinRequests(groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get join requests"})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// ApproveJoinRequest approves a join request
func (gh *GroupHandler) ApproveJoinRequest(c *gin.Context) {
	requestID := c.Param("requestId")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	err := gh.repo.ApproveJoinRequest(requestID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve join request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Join request approved"})
}

// RejectJoinRequest rejects a join request
func (gh *GroupHandler) RejectJoinRequest(c *gin.Context) {
	requestID := c.Param("requestId")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	err := gh.repo.RejectJoinRequest(requestID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject join request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Join request rejected"})
}

// CreateInvitation creates an invitation link for a group
func (gh *GroupHandler) CreateInvitation(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	isAdmin, err := gh.repo.IsGroupAdmin(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group admins can create invitations"})
		return
	}

	var req models.CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	invitation, err := gh.repo.CreateGroupInvitation(groupID, userID.(string), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
		return
	}

	baseURL := c.Request.Host
	inviteLink := fmt.Sprintf("https://%s/api/v1/groups/join?token=%s", baseURL, invitation.Token)

	c.JSON(http.StatusCreated, gin.H{
		"invitation":  invitation,
		"invite_link": inviteLink,
	})
}

// AcceptInvitation accepts an invitation to join a group
func (gh *GroupHandler) AcceptInvitation(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation token is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	invitation, err := gh.repo.GetGroupInvitationByToken(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = gh.repo.AcceptGroupInvitation(invitation.ID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined group"})
}

// RemoveGroupMember removes a member from a group
func (gh *GroupHandler) RemoveGroupMember(c *gin.Context) {
	groupID := c.Param("groupId")
	memberUserID := c.Param("userId")
	if groupID == "" || memberUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID and User ID are required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	isAdmin, err := gh.repo.IsGroupAdmin(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group admins can remove members"})
		return
	}

	role, err := gh.repo.GetGroupMemberRole(groupID, memberUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check member role"})
		return
	}

	if role == "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove group owner"})
		return
	}

	if role == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "User is not a member of this group"})
		return
	}

	err = gh.repo.RemoveGroupMember(groupID, memberUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// UpdateMemberRole updates a member's role
func (gh *GroupHandler) UpdateMemberRole(c *gin.Context) {
	groupID := c.Param("groupId")
	memberUserID := c.Param("userId")
	if groupID == "" || memberUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID and User ID are required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	isOwner, err := gh.repo.IsGroupOwner(groupID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check group permissions"})
		return
	}

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only group owners can update member roles"})
		return
	}

	var req models.UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	if req.Role != "admin" && req.Role != "member" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be 'admin' or 'member'"})
		return
	}

	member, err := gh.repo.UpdateGroupMemberRole(groupID, memberUserID, req.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member role"})
		return
	}

	c.JSON(http.StatusOK, member)
}
