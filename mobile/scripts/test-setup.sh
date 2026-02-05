#!/bin/bash

# Quick test script to verify local development setup

echo "🔍 Testing Local Development Setup"
echo "=================================="
echo ""

# Test 1: Check static IP
echo "1️⃣  Checking static IP configuration..."
CURRENT_IP=$(ifconfig | grep "inet 192.168.1.100" | awk '{print $2}')
if [ "$CURRENT_IP" = "192.168.1.100" ]; then
  echo "   ✅ Static IP confirmed: 192.168.1.100"
else
  echo "   ❌ Static IP not set to 192.168.1.100"
  echo "   Current IPs:"
  ifconfig | grep "inet " | grep -v "127.0.0.1"
fi
echo ""

# Test 2: Check WiFi connection
echo "2️⃣  Checking WiFi connection..."
WIFI_STATUS=$(networksetup -getairportnetwork en0 2>/dev/null || networksetup -getairportnetwork en1 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "   ✅ $WIFI_STATUS"
else
  echo "   ⚠️  Could not determine WiFi status"
fi
echo ""

# Test 3: Check if server port is available
echo "3️⃣  Checking if port 5100 is available..."
if lsof -i :5100 > /dev/null 2>&1; then
  echo "   ✅ Server is running on port 5100"
  echo "   Process:"
  lsof -i :5100 | head -2
else
  echo "   ⚠️  Port 5100 is available (server not running)"
  echo "   Start server with: cd .. && npm run server"
fi
echo ""

# Test 4: Test server connectivity
echo "4️⃣  Testing server connectivity..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.1.100:5100/api/health 2>/dev/null)
if [ "$RESPONSE" = "200" ]; then
  echo "   ✅ Server responding at http://192.168.1.100:5100"
elif [ "$RESPONSE" = "000" ]; then
  echo "   ❌ Cannot connect to server (not running or firewall blocking)"
else
  echo "   ⚠️  Server returned status: $RESPONSE"
fi
echo ""

# Test 5: Check EAS CLI
echo "5️⃣  Checking EAS CLI..."
if command -v eas &> /dev/null; then
  EAS_VERSION=$(eas --version 2>&1 | grep "eas-cli" | awk '{print $1}')
  echo "   ✅ EAS CLI installed: $EAS_VERSION"
else
  echo "   ❌ EAS CLI not found"
  echo "   Install with: npm install -g eas-cli"
fi
echo ""

# Test 6: Check .env file
echo "6️⃣  Checking .env configuration..."
if [ -f .env ]; then
  echo "   ✅ .env file exists:"
  cat .env | sed 's/^/      /'
else
  echo "   ⚠️  No .env file found"
  echo "   Create with: npm run dev:local"
fi
echo ""

# Summary
echo "=================================="
echo "📋 Setup Summary"
echo "=================================="
echo ""
echo "Ready for iPad testing:"
echo "  1. Build dev app: npm run build:dev"
echo "  2. Start server: cd .. && npm run server"
echo "  3. Install app on iPad from EAS URL"
echo "  4. Publish updates: npm run publish:dev"
echo ""
