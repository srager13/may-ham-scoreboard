package handlers

import (
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
	if req.Role != "admin" && req.Role != "member" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be 'admin' or 'member'"})
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
