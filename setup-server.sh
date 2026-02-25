#!/bin/bash
# One-time Ubuntu server setup for Haventium
# Run as root or with sudo on a fresh Ubuntu 22.04+ server
set -e

echo "==> Updating packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Enabling Docker on boot..."
systemctl enable docker
systemctl start docker

echo "==> Setting up firewall (UFW)..."
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Creating deploy directory..."
read -p "Deploy directory (default: /opt/haventium): " DEPLOY_DIR
DEPLOY_DIR=${DEPLOY_DIR:-/opt/haventium}
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

echo "==> Uploading docker-compose.yml and nginx config..."
echo "NOTE: Run the following from your LOCAL machine to upload the config files:"
echo ""
echo "  scp docker-compose.yml root@<server-ip>:${DEPLOY_DIR}/docker-compose.yml"
echo "  scp -r nginx root@<server-ip>:${DEPLOY_DIR}/nginx"
echo ""
read -p "Press Enter once you have uploaded those files..."

echo "==> Creating .env file..."
echo "Paste your .env contents below, then press Ctrl+D when done:"
cat > "$DEPLOY_DIR/.env"

echo "==> Starting Nginx (HTTP only for Certbot challenge)..."
cd "$DEPLOY_DIR"

# Temporarily use HTTP-only config until cert is issued
cat > nginx/conf.d/app.conf << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Server is up. SSL setup in progress.';
        add_header Content-Type text/plain;
    }
}
NGINXCONF

docker compose up -d nginx certbot

echo ""
echo "==> Issuing SSL certificate..."
read -p "Your domain (e.g. yourdomain.com): " DOMAIN
read -p "Your email for Let's Encrypt: " EMAIL

docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Updating Nginx config with your domain..."
cat > nginx/conf.d/app.conf << NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXCONF

docker compose restart nginx

echo ""
echo "Server is ready. Now run deploy.sh from your LOCAL machine to upload and start the app."
echo ""
echo "  SERVER_IP=${SERVER_IP:-<your-server-ip>} ./deploy.sh"
