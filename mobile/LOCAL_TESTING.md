# Local iPad Testing Setup

Your MacBook Pro is already configured with static IP **192.168.1.100** ✅

## Quick Start

### 1. First Time Setup - Build Development App

```bash
cd mobile
npm run build:dev
```

This creates a development build that connects to `http://192.168.1.100:5100`

**After build completes:**
- Open the provided URL on your iPad
- Install the Bloom Steward development app
- App will automatically connect to your local server

### 2. Start Local Server

```bash
cd /Users/tompinataro/My-Repos-VSCode/Bloom-Steward
npm run server
```

Server will be accessible at `http://192.168.1.100:5100`

### 3. Daily Development Workflow

After making code changes:

```bash
cd mobile
npm run publish:dev
```

**On iPad:**
- Shake device → "Check for Updates"
- OR simply close and reopen the app

Updates download automatically (OTA) - no rebuild needed!

## Helper Commands

```bash
# Setup local environment
cd mobile
npm run dev:local

# Publish OTA update after code changes
npm run publish:dev

# Build new development version (rarely needed)
npm run build:dev
```

## Network Configuration

**MacBook Pro:**
- IP: `192.168.1.100` (already set)
- Server: `http://192.168.1.100:5100`

**iPad:**
- Must be on same WiFi network
- Development app points to `http://192.168.1.100:5100`

## Troubleshooting

**Can't connect from iPad?**
1. Verify iPad is on same WiFi
2. Check MacBook firewall settings
3. Confirm server is running: `curl http://192.168.1.100:5100/api/health`

**Need to change static IP?**
System Settings → Network → WiFi → Details → TCP/IP → "Using DHCP with manual address"

## What's Already Configured

✅ Static IP: 192.168.1.100  
✅ EAS development profile points to local server  
✅ Helper scripts created  
✅ npm commands added  

You're ready to test!
