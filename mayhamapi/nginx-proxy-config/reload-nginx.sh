
# ============================================
# CERTBOT AUTO-RENEWAL SETUP
# ============================================

# File: /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

#!/bin/bash
systemctl reload nginx

# Make executable:
# chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh