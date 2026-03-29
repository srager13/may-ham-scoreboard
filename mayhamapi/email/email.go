package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

// Mailer sends transactional emails via SMTP.
// Configuration is read from environment variables:
//
//	SMTP_HOST     - e.g. smtp.gmail.com
//	SMTP_PORT     - 587 (STARTTLS, default) or 465 (implicit TLS)
//	SMTP_USER     - SMTP login username
//	SMTP_PASSWORD - SMTP login password
//	SMTP_FROM     - "From" address, e.g. noreply@yourdomain.com
type Mailer struct {
	host     string
	port     string
	username string
	password string
	from     string
}

// NewMailer reads SMTP settings from the environment and returns a Mailer.
// Returns nil (with a warning) if any required variable is missing so the
// app can still start without email configured.
func NewMailer() *Mailer {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || user == "" || pass == "" || from == "" {
		log.Println("WARNING: SMTP not fully configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM required). Password-reset emails will not be sent.")
		return nil
	}
	if port == "" {
		port = "587"
	}
	return &Mailer{host: host, port: port, username: user, password: pass, from: from}
}

// SendPasswordResetEmail sends a password-reset link to the given address.
func (m *Mailer) SendPasswordResetEmail(toEmail, toName, resetURL string) error {
	subject := "Mayham Golf – Password Reset"

	displayName := toName
	if displayName == "" {
		displayName = toEmail
	}

	body := buildResetEmailBody(displayName, resetURL)
	msg := buildMIMEMessage(m.from, toEmail, subject, body)

	return m.send(toEmail, msg)
}

// SendEmailVerificationEmail sends an email-verification link to the given address.
func (m *Mailer) SendEmailVerificationEmail(toEmail, toName, verifyURL string) error {
	subject := "Mayham Golf – Verify Your Email"

	displayName := toName
	if displayName == "" {
		displayName = toEmail
	}

	body := buildVerificationEmailBody(displayName, verifyURL)
	msg := buildMIMEMessage(m.from, toEmail, subject, body)

	return m.send(toEmail, msg)
}

// send delivers a raw MIME message.
// Port 465 uses implicit TLS; all other ports use STARTTLS via smtp.SendMail.
func (m *Mailer) send(to string, msg []byte) error {
	addr := m.host + ":" + m.port
	auth := smtp.PlainAuth("", m.username, m.password, m.host)

	if m.port == "465" {
		return m.sendImplicitTLS(addr, auth, to, msg)
	}
	// STARTTLS path (port 587 / 25)
	return smtp.SendMail(addr, auth, m.from, []string{to}, msg)
}

// sendImplicitTLS dials with TLS first (port 465 / SSL), then authenticates.
func (m *Mailer) sendImplicitTLS(addr string, auth smtp.Auth, to string, msg []byte) error {
	tlsCfg := &tls.Config{ServerName: m.host}
	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}

	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err = client.Mail(m.from); err != nil {
		return fmt.Errorf("smtp MAIL: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err = w.Write(msg); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	return w.Close()
}

// buildMIMEMessage constructs a plain-text MIME email.
func buildMIMEMessage(from, to, subject, body string) []byte {
	var sb strings.Builder
	sb.WriteString("From: " + from + "\r\n")
	sb.WriteString("To: " + to + "\r\n")
	sb.WriteString("Subject: " + subject + "\r\n")
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	sb.WriteString("\r\n")
	sb.WriteString(body)
	return []byte(sb.String())
}

func buildResetEmailBody(displayName, resetURL string) string {
	return fmt.Sprintf(`Hi %s,

We received a request to reset your Mayham Golf password.

Click the link below to choose a new password. This link expires in 1 hour and can only be used once.

  %s

If you did not request a password reset, you can safely ignore this email — your password will not change.

— The Mayham Golf Team
`, displayName, resetURL)
}

func buildVerificationEmailBody(displayName, verifyURL string) string {
	return fmt.Sprintf(`Hi %s,

Welcome to Mayham Golf! Please verify your email address by clicking the link below.

  %s

This link expires in 24 hours and can only be used once.

If you did not create this account, you can safely ignore this email.

— The Mayham Golf Team
`, displayName, verifyURL)
}
