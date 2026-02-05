# Pre-Submission Cleanup & App Store Readiness

## ✅ Completed
- Database cleaned (duplicates removed, demo users deleted)
- Report date range shows date only (no time)
- Local development workflow stable
- HTTP security configured for iOS

## 🧹 Recommended Cleanup

### 1. Remove Console Logs (Production)
**File:** `mobile/src/components/ErrorBoundary.tsx` (line 15)
```tsx
// Remove or change to production-safe logging
console.warn('ErrorBoundary', error, info);
```

**File:** `mobile/src/auth.tsx` (line 84)
```tsx
console.error('[signIn] failed to post odometer', e);
```

**Action:** These are fine for now but consider using a production logging service.

### 2. Environment Files
Currently have `.env` in mobile directory. Verify it's in `.gitignore`:
```bash
echo ".env" >> mobile/.gitignore
```

### 3. Update Version Numbers
Before submission:
- **iOS:** Update `buildNumber` in `mobile/app.json` (currently "46")
- **Android:** Update `versionCode` in `mobile/app.json` (currently 28)
- **Version:** Update `version` in `mobile/app.json` (currently "1.2.0")

### 4. Asset Optimization
All assets look good - no cleanup needed.

### 5. Code Quality
- ✅ 36 TypeScript files - well organized
- ✅ No .bak or temp files
- ✅ Good structure in src/
- ✅ No critical technical debt

---

## 📱 iOS App Store Submission

### Ready to Submit
1. Build production version:
```bash
cd mobile
eas build --profile production --platform ios
```

2. When complete, submit:
```bash
eas submit --platform ios --latest
```

3. Fill out App Store Connect metadata if not done
4. Submit for review

---

## 🤖 Google Play Submission

### Prerequisites

#### 1. Create Google Play Console Account
- Go to https://play.google.com/console
- Pay $25 one-time registration fee
- Create app listing

#### 2. Configure Android Build

**Update `mobile/app.json`:**
```json
"android": {
  "package": "com.pinataro.bloomsteward",
  "versionCode": 29,  // Increment from 28
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "permissions": [
    "ACCESS_COARSE_LOCATION",
    "ACCESS_FINE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION"
  ]
}
```

#### 3. Configure `mobile/eas.json` for Android

Already configured! Your production profile works for both platforms.

#### 4. Build for Google Play

```bash
cd mobile
eas build --profile production --platform android
```

This creates an `.aab` (Android App Bundle) file.

#### 5. Submit to Google Play

**Option A: Via EAS (easiest):**
```bash
eas submit --platform android --latest
```

**Option B: Manual:**
1. Download `.aab` from EAS build page
2. Go to Google Play Console
3. Create new release (Production)
4. Upload `.aab` file
5. Fill out store listing
6. Submit for review

### Required Google Play Assets

1. **App Icon:** 512x512px (you have this)
2. **Feature Graphic:** 1024x500px
3. **Screenshots:** At least 2 (phone), up to 8
4. **Privacy Policy URL:** Host privacy.md somewhere public
5. **Content Rating Questionnaire:** Complete in console

### Store Listing Content Needed

- **Short Description:** (80 chars max)
- **Full Description:** (4000 chars max)
- **Category:** Business or Productivity
- **Contact Email:** Your support email
- **Privacy Policy:** https://your-domain.com/privacy

---

## 🎯 Pre-Submission Checklist

### iOS
- [ ] Update build number in app.json
- [ ] Build with production profile
- [ ] Test on physical device
- [ ] Submit via EAS
- [ ] Complete App Store Connect metadata

### Android (First Time)
- [ ] Register Google Play Console account ($25)
- [ ] Create app in console
- [ ] Prepare feature graphic (1024x500)
- [ ] Prepare 2-8 screenshots
- [ ] Host privacy policy publicly
- [ ] Update android versionCode in app.json
- [ ] Build with production profile
- [ ] Submit via EAS or manual upload
- [ ] Complete content rating questionnaire
- [ ] Submit for review

---

## 📊 Current Status

**Codebase Quality:** ✅ Excellent
- Clean structure
- No technical debt
- TypeScript throughout
- Good error handling

**Assets:** ✅ Ready
- Icons present
- Splash screens configured
- Adaptive icons for Android

**Configuration:** ✅ Complete
- EAS configured for both platforms
- Environment variables set
- Build profiles ready

**Documentation:** ✅ Good
- Setup guides created
- Testing workflow documented

---

## 🚀 Next Steps

1. **Test thoroughly** on iPad with local server
2. **Increment version numbers** when ready
3. **Build iOS production** → Submit to Apple
4. **Register Google Play** → Build Android → Submit to Google

Estimated time to both stores: **2-3 hours** (mostly waiting for reviews)
