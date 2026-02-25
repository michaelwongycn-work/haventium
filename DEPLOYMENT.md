# Haventium Deployment Guide

Deployment approach: **build Docker image locally → upload to server via SCP → run with Docker Compose**

No git access required on the server. No registry needed.

## File Overview

```
Dockerfile                  — multi-stage production image
docker-compose.yml          — app + nginx + certbot services (uses pre-loaded image)
nginx/
  nginx.conf                — base nginx config
  conf.d/app.conf           — written automatically by setup-server.sh
deploy.sh                   — run LOCALLY to build, upload, and restart the app
setup-server.sh             — run ONCE on the server to install Docker, SSL, etc.
```

---

## How It Works

```
Your machine                          Server
────────────────                      ──────────────────────────────
docker build                          (no build needed)
docker save | gzip  ──── scp ──────►  docker load
                                      docker compose up
```

---

## Step 1 — Prepare the server (one time only)

### 1.1 SSH into your server

```bash
ssh root@your-server-ip
```

### 1.2 Run the setup script on the server

Copy and paste the contents of `setup-server.sh` into the server, or upload it first:

```bash
# From your LOCAL machine:
scp setup-server.sh root@your-server-ip:/root/setup-server.sh

# Then on the server:
bash /root/setup-server.sh
```

The script will:
- Install Docker and Docker Compose
- Configure UFW firewall (ports 22, 80, 443)
- Create the deploy directory (default `/opt/haventium`)
- Prompt you to paste your `.env`
- Start Nginx temporarily on HTTP for Certbot verification
- Issue your SSL certificate via Let's Encrypt
- Write the final Nginx config with your domain and SSL paths

### 1.3 Upload docker-compose.yml and nginx config (when prompted by the script)

From your **local machine**, in a second terminal:

```bash
scp docker-compose.yml root@your-server-ip:/opt/haventium/docker-compose.yml
scp -r nginx root@your-server-ip:/opt/haventium/nginx
```

Then press Enter in the setup script to continue.

---

## Step 2 — Deploy the app (first time and every update)

From your **local machine**, in the project root:

### 2.1 Set your server IP in deploy.sh

Open `deploy.sh` and fill in:
```bash
SERVER_IP="your-server-ip"
SERVER_USER="root"         # or your sudo user
SERVER_DIR="/opt/haventium"
```

### 2.2 Run deploy

```bash
./deploy.sh
```

This will:
1. Build the Docker image locally
2. Save and compress it to `/tmp/haventium_app.tar.gz`
3. Upload it to the server via SCP
4. Load the image on the server
5. Restart the app container
6. Clean up old images

Your app will be live at `https://yourdomain.com`.

---

## Updating the App

Every time you make changes, just run from your local machine:

```bash
./deploy.sh
```

Nginx stays up the entire time — only the app container restarts.

---

## SSL Certificate Renewal

Certbot auto-renews every 12 hours inside its container. No manual action needed.

To manually force a renewal on the server:
```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

---

## Useful Server Commands

```bash
# View live logs
docker compose logs -f app

# Restart a service
docker compose restart app
docker compose restart nginx

# Check running containers
docker compose ps

# Open a shell in the app container
docker compose exec app sh

# Full restart from scratch
docker compose down
docker compose up -d
```

---

## Troubleshooting

**App won't start**
```bash
docker compose logs app
```
Usually a missing env var or DB connection issue.

**502 Bad Gateway**
The app container isn't running or the image hasn't been loaded yet. Check:
```bash
docker compose ps
docker images | grep haventium
```
If no image, re-run `./deploy.sh` from your local machine.

**SSL certificate not found**
Make sure `setup-server.sh` completed the Certbot step successfully before starting the HTTPS block.

**Port 80/443 already in use**
```bash
ss -tlnp | grep -E ':80|:443'
```
