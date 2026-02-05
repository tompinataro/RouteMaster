#!/bin/bash

# Script to build development version for iPad testing
# This build will connect to your local server at 192.168.1.100:5100

echo "🏗️  Building development version for iOS..."
echo ""
echo "This build will use:"
echo "  API URL: http://192.168.1.100:5100"
echo "  Channel: development"
echo ""

# Build for iOS with development profile
eas build --profile development --platform ios

echo ""
echo "✅ Build started!"
echo ""
echo "📱 Once complete:"
echo "   1. You'll receive a URL/QR code"
echo "   2. Open the URL on your iPad"
echo "   3. Install the development build"
echo "   4. The app will connect to http://192.168.1.100:5100"
echo ""
echo "💡 After installation, you can push OTA updates with:"
echo "   npm run publish:dev"
echo ""
