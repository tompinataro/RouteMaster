# Development & Testing Methods for Bloom Steward

## Build & Deployment Methods Overview

### 1. **Metro Bundler (Development Server)**
**What it is:** Local development server that runs on your Mac, live-reloading JavaScript changes.

**When to use:**
- ✅ Active development with rapid iteration
- ✅ Testing UI/logic changes without waiting for builds
- ✅ When you need instant feedback (press 'r' in terminal to reload)
- ✅ Network debugging with local breakpoints

**Requirements:**
- Mac server must be running (`npm start` or `npx expo start`)
- Device must be on same WiFi network OR plugged into Mac via USB
- App must be in development mode (not production builds)

**Limitations:**
- ❌ Cannot test native code changes (iOS/Android modifications)
- ❌ Requires device to stay connected to Mac
- ❌ Only works with development builds, not production builds

**API Configuration:**
- Points to `http://192.168.0.159:5100` (your local Mac server)
- Good for testing database changes and server logic locally

---

### 2. **OTA Updates (Over-The-Air via EAS Update)**
**What it is:** Push JavaScript/asset updates to existing builds without rebuilding the native app.

**When to use:**
- ✅ UI tweaks, text changes, styling adjustments
- ✅ Business logic updates (JavaScript/TypeScript only)
- ✅ Quick fixes that don't touch native code
- ✅ When you want to update multiple devices instantly

**How to deploy:**
```bash
cd mobile
npx eas update --branch staging --message "Description of changes"
```

**Requirements:**
- Device must have internet connection
- App must be hard-closed and reopened to fetch update
- Build must have been created with the same `runtimeVersion`

**Limitations:**
- ❌ Cannot update native iOS/Android code
- ❌ Cannot change build number, bundle ID, or native dependencies
- ❌ Cannot update Expo SDK version or native modules
- ❌ Users must relaunch app to receive update

**API Configuration:**
- Uses whatever API URL was baked into the original build
- Currently pointing to Heroku: `https://bloom-steward-2a872c497756.herokuapp.com`

---

### 3. **EAS Build (Full Native Builds)**
**What it is:** Creates complete iOS/Android app packages on Expo's cloud servers.

**When to use:**
- ✅ Native code changes (Info.plist, Xcode project, Android manifest)
- ✅ Adding/updating native dependencies (expo-location, react-native modules)
- ✅ Changing build number or version
- ✅ First-time installation or major releases
- ✅ When OTA updates aren't sufficient

**How to build:**
```bash
cd mobile
npx eas build --profile staging --platform ios
```

**Build Profiles (defined in `eas.json`):**

#### `preview` Profile
- **Distribution:** Internal (Ad Hoc)
- **API URL:** Heroku
- **When prompted:** EAS asks questions when credentials need updating or validation
- **Use for:** Testing builds before production

#### `staging` Profile
- **Distribution:** Internal (Ad Hoc)
- **API URL:** Heroku
- **When prompted:** Usually non-interactive after initial setup
- **Use for:** Main testing/QA builds

#### `production` Profile
- **Distribution:** App Store
- **API URL:** Heroku
- **When prompted:** More validation before App Store submission
- **Use for:** Final App Store releases

**Requirements:**
- Device UDID must be registered in Apple Developer portal (for Ad Hoc)
- Takes 10-20 minutes to build on EAS servers
- Requires signing certificates and provisioning profiles

**Installation:**
- Open EAS build link on device (iPad/iPhone)
- Or use QR code to download
- **iPad must be connected to WiFi** to download build (cellular might work but WiFi is more reliable)
- iPad does NOT need to be plugged into Mac

**Limitations:**
- ❌ Slow feedback loop (10-20 min per build)
- ❌ Limited to 30 builds/month on free Expo plan
- ❌ Requires internet connection to build and download

---

### 4. **TestFlight (Apple's Beta Distribution)**
**What it is:** Apple's official beta testing platform for iOS apps.

**When to use:**
- ✅ Distributing to external testers (up to 10,000)
- ✅ Testing App Store submission process
- ✅ When you need Apple's review before full release
- ✅ Production-like environment testing

**How to submit:**
```bash
cd mobile
npx eas build --profile production --platform ios
npx eas submit --platform ios
```

**Requirements:**
- Build must pass Apple's automated review (can take hours)
- Testers must have TestFlight app installed
- Build must be signed with App Store distribution certificate

**Limitations:**
- ❌ Slower than EAS builds (Apple review delay)
- ❌ 90-day expiration per build
- ❌ More restricted environment (sandbox)
- ❌ Cannot use certain debugging features

---

### 5. **iOS Simulator (Xcode)**
**What it is:** Software simulation of iPhone/iPad running on your Mac.

**When to use:**
- ✅ Quick UI testing without physical device
- ✅ Testing different screen sizes/iOS versions
- ✅ Debugging with Xcode tools

**How to run:**
```bash
cd mobile
npx expo run:ios
```

**Limitations:**
- ❌ Cannot test device-specific features (camera, GPS, push notifications)
- ❌ Performance differs from real devices
- ❌ Slower than physical devices for some operations
- ❌ Requires Xcode installed (40+ GB)

---

## API Endpoint Strategy

### Why Point to Heroku?
**Current setup:** All builds point to `https://bloom-steward-2a872c497756.herokuapp.com`

**Reasons:**
1. **Device Independence:** iPad/iPhone work anywhere with internet
2. **Consistency:** All testers use same backend
3. **Always Available:** Heroku runs 24/7 (idle after 30 min, wakes on request)
4. **Production-like:** Mimics real deployment environment

### Why Use Local Server?
**Alternative:** Point to `http://192.168.0.159:5100` (your Mac)

**Reasons:**
1. **Database Control:** Easier to reset/seed data during development
2. **Faster Debugging:** Direct access to server logs
3. **No Cold Starts:** Local server responds instantly
4. **Offline Development:** Works without internet

**Problem:** Device must be on same network as Mac, breaks when you leave home/Mac sleeps

---

## Historical Context: Why We Switched

### Builds 1-30: Local Development
- Pointed to `http://192.168.0.159:5100`
- Fast iteration but brittle (network issues, Mac sleep, WiFi changes)

### Builds 31-42: Transition Period
- Mixed configurations (some local, some Heroku)
- Network issues forced us to try different approaches
- Confusion about which build pointed where

### Builds 43-45: Heroku Standard
- All builds now point to Heroku
- OTA updates work consistently
- More stable for testing

---

## EAS Build Questions (When & Why)

### Non-Interactive Builds
```bash
npx eas build --profile staging --platform ios --non-interactive
```
- **No questions asked** if credentials are valid and up-to-date
- Uses cached certificates and provisioning profiles

### Interactive Builds (Default)
```bash
npx eas build --profile staging --platform ios
```

**You'll be prompted when:**

1. **Credentials Expired/Missing**
   - Distribution certificate expired (happens yearly)
   - Provisioning profile needs updating (devices added/removed)
   - First time building with EAS

2. **Credential Validation**
   - EAS wants to verify credentials with Apple servers
   - You're not logged into Apple Developer account in terminal
   - Profile setting: `"credentialsSource": "local"` requires manual input

3. **Device Registration**
   - New device UDID detected for Ad Hoc builds
   - Provisioning profile needs regeneration with new device

4. **Build Profile Changes**
   - Switched from one profile to another (preview → staging → production)
   - Different credentials required for different profiles

**How to avoid questions:**
- Use `--non-interactive` flag for automated builds
- Keep credentials synced with `eas credentials`
- Use remote credentials managed by Expo (current setup)
- Don't change build profiles frequently

---

## Recommended Workflow

### Daily Development (JavaScript/UI Changes)
1. **Run Metro:** `npm start` on Mac
2. **Connect device** via WiFi or USB
3. **Press 'r'** in terminal to reload after changes
4. **Advantage:** Instant feedback, no waiting

### Testing Server Changes (Database/API)
1. **Start local server:** `npm run build && npm start`
2. **Use Metro** with device pointing to local server
3. **Or:** Deploy to Heroku and use existing build
4. **Advantage:** Full-stack testing

### Deploying Quick Fixes (No Native Changes)
1. **Make changes** to JavaScript/TypeScript
2. **Publish OTA:** `npx eas update --branch staging --message "Fix description"`
3. **Users relaunch app** to receive update
4. **Advantage:** No rebuild needed, fast deployment

### Major Updates (Native Changes Required)
1. **Update build number** in `ios/BloomSteward/Info.plist`
2. **Create new build:** `npx eas build --profile staging --platform ios --non-interactive`
3. **Wait 10-20 minutes** for build to complete
4. **Install on devices** via download link
5. **Advantage:** Full native code updates

### Pre-Release Testing
1. **Build with production profile:** `npx eas build --profile production --platform ios`
2. **Submit to TestFlight:** `npx eas submit --platform ios`
3. **Wait for Apple review** (hours to days)
4. **Distribute to testers** via TestFlight app
5. **Advantage:** Production environment, external testers

---

## Current Best Practice for Bloom Steward

### Primary Method: EAS Build + Heroku + OTA Updates
1. **Create base build** with EAS pointing to Heroku (current setup)
2. **Deploy quickly** with OTA updates for UI/logic fixes
3. **Rebuild only when** native code changes or build number needs incrementing
4. **TestFlight for** final pre-release validation before App Store

### iPad Cable Connection
**Never required for:**
- Installing EAS builds (use download link over WiFi)
- Receiving OTA updates (over internet)
- TestFlight installation

**Only required for:**
- Xcode debugging with breakpoints
- Installing from Xcode directly (`npx expo run:ios --device`)
- Capturing device logs with Xcode Devices window

---

## Build Number Management

### Where Build Number Lives
- **Native iOS:** `ios/BloomSteward/Info.plist` → `CFBundleVersion`
- **NOT in:** `app.json` (ignored in bare workflow)

### How to Increment
```bash
# Update to build 46
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 46" mobile/ios/BloomSteward/Info.plist

# Verify
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" mobile/ios/BloomSteward/Info.plist
```

### Why It Matters
- App Store requires incrementing build numbers for each submission
- TestFlight requires unique build numbers
- EAS builds use this number (NOT app.json in bare workflow)

---

## Summary Table

| Method | Speed | Native Code | Internet Required | Best For |
|--------|-------|-------------|-------------------|----------|
| **Metro** | ⚡ Instant | ❌ | Only for download | Active development |
| **OTA Updates** | 🔄 2-3 min | ❌ | ✅ | Quick fixes, UI tweaks |
| **EAS Build** | 🕐 10-20 min | ✅ | ✅ | Native changes, new features |
| **TestFlight** | 🕐 Hours-Days | ✅ | ✅ | Pre-release testing |
| **Simulator** | ⚡ Fast | ✅ | ❌ | UI/layout testing |

---

## Decision Tree

```
Need to make a change?
│
├─ Is it JavaScript/CSS only?
│  └─ YES → Use OTA Update (eas update)
│
├─ Is it native code (iOS files)?
│  └─ YES → Create new EAS Build
│
├─ Testing locally with frequent changes?
│  └─ YES → Use Metro (npm start + reload)
│
├─ Need to distribute to external testers?
│  └─ YES → Use TestFlight
│
└─ Just checking UI layout?
   └─ YES → Use iOS Simulator
```

---

## Final Recommendation

**For Bloom Steward development:**

1. **Keep Heroku as primary backend** - More reliable than local server for testing
2. **Use OTA updates** for 80% of changes (UI, logic, styling)
3. **Create new EAS builds** only when necessary (native changes, version bumps)
4. **Use Metro locally** when rapidly iterating on complex features
5. **TestFlight before App Store** submission for final validation
6. **Never need cable** for iPad - all installations work over WiFi

This setup minimizes build times while maintaining stability and flexibility.
