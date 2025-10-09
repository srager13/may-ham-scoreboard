
# TESTING AND VALIDATION
# ============================================

#!/bin/bash
# File: test-nginx.sh

echo "🏌️  Testing Nginx Configuration"
echo "==============================="

# Test configuration syntax
echo "Testing configuration syntax..."
nginx -t

# Test SSL configuration
echo ""
echo "Testing SSL configuration..."
echo | openssl s_client -servername golf.example.com -connect localhost:443

# Test API endpoint
echo ""
echo "Testing API endpoint..."
curl -H "Host: golf.example.com" https://localhost/api/v1/

# Test WebSocket endpoint
echo ""
echo "Testing WebSocket endpoint..."
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://localhost/ws/tournaments/test

# Check nginx process
echo ""
echo "Checking nginx process..."
ps aux | grep nginx | grep -v grep

# Check open ports
echo ""
echo "Checking open ports..."
ss -tlnp | grep nginx

echo ""
echo "✅ All tests complete!"
