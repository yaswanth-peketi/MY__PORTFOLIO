#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo "  AWS EC2 Automated Setup: Portfolio + PostgreSQL + ELK "
echo "========================================================"

# 1. Add 4GB swap file if not already configured (prevents Elasticsearch OOM)
if [ ! -f /swapfile ] && [ "$(swapon --show | wc -l)" -eq 0 ]; then
  echo ">>> Configuring 4GB swap file..."
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
else
  echo ">>> Swap already configured, skipping."
fi

# 2. Configure vm.max_map_count required by Elasticsearch 8
CURRENT_MAP_COUNT=$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)
if [ "$CURRENT_MAP_COUNT" -lt 262144 ]; then
  echo ">>> Setting vm.max_map_count=262144 for Elasticsearch..."
  sudo sysctl -w vm.max_map_count=262144
  if ! grep -q "vm.max_map_count" /etc/sysctl.conf; then
    echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf >/dev/null
  fi
fi

# 3. Install Docker Engine & Docker Compose plugin if missing
if ! command -v docker >/dev/null 2>&1; then
  echo ">>> Installing Docker & Docker Compose..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl openssl
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  sudo usermod -aG docker "$USER" || true
fi

# 4. Detect EC2 Public IPv4 address
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" --max-time 2 || true)
PUBLIC_IP=""
if [ -n "$TOKEN" ]; then
  PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/public-ipv4" --max-time 2 || true)
fi
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP=$(curl -s --max-time 5 https://checkip.amazonaws.com || echo "localhost")
fi
PUBLIC_IP=$(echo "$PUBLIC_IP" | tr -d '[:space:]')

# 5. Create root .env for Docker Compose if it doesn't exist
if [ ! -f .env ]; then
  echo ">>> Creating .env configuration for ${PUBLIC_IP}..."
  JWT_VAL=$(openssl rand -hex 32 2>/dev/null || echo "portfolio_super_secure_jwt_secret_key_32_characters_long!")
  cat > .env <<EOF
NODE_ENV=development
JWT_SECRET=${JWT_VAL}
FRONTEND_URL=http://${PUBLIC_IP}
EXTRA_ALLOWED_ORIGINS=http://${PUBLIC_IP},http://localhost,http://127.0.0.1
RESEND_API_KEY=re_placeholder_key
RESEND_FROM=Portfolio Security <onboarding@resend.dev>
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder_secret
EOF
fi

# 6. Build and launch all 5 containers (Postgres, Elasticsearch, Kibana, Backend, Nginx)
echo ">>> Building and starting Docker Compose stack (this takes 2-4 mins first run)..."
sudo docker compose up -d --build

echo ">>> Waiting for services to initialize..."
sleep 15
sudo docker compose ps

echo ""
echo "========================================================"
echo "  Deployment Complete! Your Live AWS URLs:              "
echo "========================================================"
echo "  Portfolio App : http://${PUBLIC_IP}"
echo "  API Health    : http://${PUBLIC_IP}/api/health"
echo "  Kibana ELK UI : http://${PUBLIC_IP}:5601"
echo "========================================================"
echo ""
echo "Useful commands:"
echo "  View OTP/App logs : sudo docker logs portfolio-backend -f"
echo "  Restart stack     : sudo docker compose restart"
echo "  Stop stack        : sudo docker compose down"
