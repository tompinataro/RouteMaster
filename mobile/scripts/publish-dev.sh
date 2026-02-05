#!/bin/bash

# Script to publish OTA updates to development channel
# Use this after making code changes to push updates to iPad

echo "📦 Publishing OTA update to development channel..."
echo ""

# Ensure .env is set for local development
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Creating one..."
  echo "EXPO_PUBLIC_API_URL=http://192.168.1.100:5100" > .env
fi

echo "Current .env configuration:"
cat .env
echo ""

# Publish to development channel using EAS Update
eas update --branch development --message "Local development update"

echo ""
echo "✅ OTA update published!"
echo "📱 On your iPad:"
echo "   1. Open Bloom Steward development app"
echo "   2. Shake device for developer menu"
echo "   3. Tap 'Check for Updates'"
echo "   OR simply close and reopen the app"
echo ""
