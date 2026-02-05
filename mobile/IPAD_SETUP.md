# iPad Setup Guide

## Prerequisites
✅ MacBook Pro has static IP: 192.168.1.100  
✅ iPad and MacBook on same WiFi network  

---

## Step 1: Install Development Build (First Time Only)

### On MacBook:

1. **Start the build:**
```bash
cd /Users/tompinataro/My-Repos-VSCode/Bloom-Steward/mobile
npm run build:dev
```

2. **Wait for build to complete** (~15-20 minutes)
   - EAS will show build progress
   - You'll receive a QR code and install URL

### On iPad:

3. **Install the build:**
   - Open Safari on iPad
   - Visit the install URL from EAS (or scan QR code)
   - Tap "Install"
   - Allow installation of development build

4. **Trust the developer certificate:**
   - Settings → General → VPN & Device Management
   - Tap on your developer profile
   - Tap "Trust"

---

## Step 2: Start Local Server

### On MacBook:

```bash
cd /Users/tompinataro/My-Repos-VSCode/Bloom-Steward
npm run server
```

✅ Server runs at `http://192.168.1.100:5100`

---

## Step 3: Test the Connection

### On iPad:

1. Open the **Bloom Steward** development app
2. App automatically connects to `http://192.168.1.100:5100`
3. You should see your local data

**Test successful?** You're ready for development! 🎉

---

## Daily Development Workflow

### Make Code Changes → Push OTA Update

1. **Edit code** on MacBook
2. **Publish update:**
   ```bash
   cd mobile
   npm run publish:dev
   ```
3. **On iPad:**
   - Shake device
   - Developer menu appears
   - Tap "Check for Updates"
   - Update downloads automatically

**OR** simply close and reopen the app to fetch updates.

---

## Troubleshooting

### iPad Can't Connect to Server

**Check 1: Same WiFi Network**
```bash
# On MacBook - check your IP:
ifconfig | grep "inet 192.168.1.100"
```

**Check 2: Server is Running**
```bash
# On MacBook:
curl http://192.168.1.100:5100/api/health
```

**Check 3: Firewall Settings**
System Settings → Network → Firewall → ensure Node/Terminal is allowed

### "No Updates Available" on iPad

The development build fetches updates from Expo's servers, not directly from your MacBook.

**Flow:**
1. You run `npm run publish:dev` on MacBook
2. Updates upload to Expo
3. iPad downloads from Expo
4. iPad connects to your local API at 192.168.1.100:5100

### Need Fresh Build?

Only rebuild if you:
- Change native dependencies
- Modify `app.json` or `eas.json`
- Need different API URL

```bash
cd mobile
npm run build:dev
```

---

## What Gets Updated OTA vs Requires Rebuild

### ✅ OTA Update (Fast - no rebuild):
- JavaScript/TypeScript code changes
- React components
- Styles
- Business logic
- API calls

### 🏗️ Requires Rebuild:
- Native module changes
- `app.json` configuration
- New dependencies with native code
- iOS/Android project files

---

## Quick Reference

```bash
# Setup environment
cd mobile
npm run dev:local

# Publish OTA update
npm run publish:dev

# Build new development version
npm run build:dev

# Start server
cd .. && npm run server
```

**Development App connects to:** `http://192.168.1.100:5100`  
**Updates come from:** Expo OTA servers  
**No rebuild needed for:** JS/React code changes  
