package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"mayhamapi/email"
	"mayhamapi/middleware"
	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	repo   *repository.Repository
	mailer *email.Mailer
}

func NewAuthHandler(repo *repository.Repository, mailer *email.Mailer) *AuthHandler {
	return &AuthHandler{repo: repo, mailer: mailer}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Email    string   `json:"email" binding:"required,email"`
	Name     string   `json:"name" binding:"required"`
	Password string   `json:"password" binding:"required,min=6"`
	Handicap *float64 `json:"handicap,omitempty"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user by email — always fetches the stored bcrypt hash
	user, err := h.repo.GetUserByEmail(req.Email)
	if err != nil {
		// Return the same generic message whether the email is unknown or the
		// password is wrong, to prevent user-enumeration attacks.
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Reject login if no password has been set yet (e.g. seeded rows).
	if user.PasswordHash == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Constant-time bcrypt comparison — rejects wrong passwords and timing attacks.
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateToken(user.ID, user.Email, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  *user,
	})
}

// POST /api/v1/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Log the incoming registration attempt (do NOT log the password).
	log.Printf("Register: incoming request email=%s name=%s", req.Email, req.Name)

	// Check if user already exists
	existingUser, _ := h.repo.GetUserByEmail(req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Hash the password with bcrypt (cost 12 — good balance of security vs latency).
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	// Create user with the hashed password; the plaintext is never stored.
	user, err := h.repo.CreateUser(req.Email, req.Name, string(hashedBytes), req.Handicap)
	if err != nil {
		// Surface repository error in logs to aid debugging of 500s while
		// avoiding exposing internal errors to clients.
		log.Printf("Register: failed to create user email=%s: %v", req.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	log.Printf("Register: created user id=%s email=%s", user.ID, user.Email)

	// Send verification email (best-effort — don't block registration if SMTP is down).
	if h.mailer != nil {
		plainToken, tokenErr := h.repo.CreateEmailVerificationToken(user.ID)
		if tokenErr != nil {
			log.Printf("Register: failed to create verification token for user %s: %v", user.ID, tokenErr)
		} else {
			baseURL := os.Getenv("APP_BASE_URL")
			if baseURL == "" {
				baseURL = "http://localhost:5173"
			}
			verifyURL := fmt.Sprintf("%s/verify-email?token=%s", baseURL, plainToken)
			if mailErr := h.mailer.SendEmailVerificationEmail(user.Email, user.Name, verifyURL); mailErr != nil {
				log.Printf("Register: failed to send verification email to %s: %v", user.Email, mailErr)
			}
		}
	}

	// Generate JWT token
	token, err := middleware.GenerateToken(user.ID, user.Email, user.IsAdmin)
	if err != nil {
		log.Printf("Register: failed to generate token for user %s: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  *user,
	})
}

// GET /api/v1/auth/me
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Fetch fresh user data from the database
	user, err := h.repo.GetUserByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	email := c.GetString("user_email")
	isAdmin := c.GetBool("is_admin")

	// Generate new token
	token, err := middleware.GenerateToken(userID.(string), email, isAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
	})
}

// GET /api/v1/users
func (h *AuthHandler) GetUsers(c *gin.Context) {
	users, err := h.repo.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// POST /api/v1/auth/forgot-password
// Always responds 200 OK regardless of whether the email exists, to prevent
// user-enumeration. Any internal errors are logged but not surfaced to the client.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Always return the same response so callers cannot enumerate registered emails.
	ok := gin.H{"message": "If that email is registered you will receive a reset link shortly"}

	if h.mailer == nil {
		log.Println("ForgotPassword: SMTP not configured — cannot send reset email")
		c.JSON(http.StatusOK, ok)
		return
	}

	user, err := h.repo.GetUserByEmail(req.Email)
	if err != nil {
		// Unknown email — still return 200.
		c.JSON(http.StatusOK, ok)
		return
	}

	plainToken, err := h.repo.CreatePasswordResetToken(user.ID)
	if err != nil {
		log.Printf("ForgotPassword: failed to create reset token for user %s: %v", user.ID, err)
		c.JSON(http.StatusOK, ok)
		return
	}

	baseURL := os.Getenv("APP_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", baseURL, plainToken)

	if err := h.mailer.SendPasswordResetEmail(user.Email, user.Name, resetURL); err != nil {
		log.Printf("ForgotPassword: failed to send reset email to %s: %v", user.Email, err)
	}

	c.JSON(http.StatusOK, ok)
}

// POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Look up the token by its hash.
	token, err := h.repo.GetPasswordResetToken(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	// Validate: not already used.
	if token.UsedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token has already been used"})
		return
	}

	// Validate: not expired.
	if time.Now().After(token.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token has expired"})
		return
	}

	// Hash the new password.
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	// Atomically mark token as used and update the password.
	if err := h.repo.ConsumePasswordResetToken(token.ID, token.UserID, string(hashedBytes)); err != nil {
		log.Printf("ResetPassword: failed to consume token %s: %v", token.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

// GET /api/v1/auth/verify-email?token=<plaintext>
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	plainToken := c.Query("token")
	if plainToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing token"})
		return
	}

	token, err := h.repo.GetEmailVerificationToken(plainToken)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification token"})
		return
	}

	if token.UsedAt != nil {
		// The token was already consumed. This can happen if the verification
		// endpoint is called more than once (for example React StrictMode in
		// development can cause effects to run twice) or the user clicks the
		// link multiple times. If the user's email is already marked verified
		// treat this as success to make the operation idempotent for clients.
		user, uerr := h.repo.GetUserByID(token.UserID)
		if uerr == nil && user.EmailVerified {
			c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token has already been used"})
		return
	}

	if time.Now().After(token.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token has expired"})
		return
	}

	if err := h.repo.ConsumeEmailVerificationToken(token.ID, token.UserID); err != nil {
		log.Printf("VerifyEmail: failed to consume token %s: %v", token.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// POST /api/v1/auth/resend-verification
// Protected — requires a valid JWT (user must be logged in).
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	user, err := h.repo.GetUserByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.EmailVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is already verified"})
		return
	}

	if h.mailer == nil {
		log.Println("ResendVerification: SMTP not configured — cannot send verification email")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Email service is not configured"})
		return
	}

	plainToken, tokenErr := h.repo.CreateEmailVerificationToken(user.ID)
	if tokenErr != nil {
		log.Printf("ResendVerification: failed to create token for user %s: %v", user.ID, tokenErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification token"})
		return
	}

	baseURL := os.Getenv("APP_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", baseURL, plainToken)

	if mailErr := h.mailer.SendEmailVerificationEmail(user.Email, user.Name, verifyURL); mailErr != nil {
		log.Printf("ResendVerification: failed to send email to %s: %v", user.Email, mailErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verification email sent"})
}
