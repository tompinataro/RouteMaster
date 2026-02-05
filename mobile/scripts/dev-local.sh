#!/bin/bash

# Script to start local development with static IP
# Ensures .env is configured for local testing on iPad

echo "🔧 Setting up local development environment..."
echo ""

# Check if static IP is configured
CURRENT_IP=$(ifconfig | grep "inet 192.168.1.100" | awk '{print $2}')

if [ "$CURRENT_IP" = "192.168.1.100" ]; then
  echo "✅ Static IP confirmed: 192.168.1.100"
else
  echo "⚠️  Warning: Expected IP 192.168.1.100, but found different IP"
  echo "   Current IP: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"
  echo ""
  echo "   Please set static IP in System Settings > Network > WiFi > Details > TCP/IP"
  echo "   Configure IPv4: Using DHCP with manual address"
  echo "   IPv4 Address: 192.168.1.100"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Create .env file with local API URL
echo "📝 Creating .env for local development..."
echo "EXPO_PUBLIC_API_URL=http://192.168.1.100:5100" > .env

echo "✅ .env created:"
cat .env
echo ""
echo "🚀 You can now:"
echo "   1. Start server: cd .. && npm run server"
echo "   2. Test on iPad with development build"
echo "   3. Publish OTA updates: npm run publish:dev"
echo ""
