# Google Play Submission Checklist (Current State)

## Done
- Expo Android config now declares package `com.pinataro.bloomsteward`, versionCode 28, and adaptive icon (mobile/app.json).
- Expo config links to projectId `280ba249-4601-4642-b9fd-81b14869ba5e` (`extra.eas.projectId`) and EAS CLI appVersionSource is set to `local`.
- Local `android` folder generated via `npx expo prebuild --platform android` to mirror EAS native build layout (mobile/android/*), with a vendored `expo-module-gradle-plugin` wired in via `settings.gradle`.
- Launcher, Play Store, and feature graphic assets live in `mobile/assets/` and match Play size requirements.
- Privacy and support URLs are published at `https://tompinataro.github.io/Bloom-Steward/privacy` and `/support`.
- App metadata draft (`docs/release/APP_STORE_METADATA.md`) covers descriptions, keywords, and review notes you can reuse in Play Console.
- Data safety answers prepared in `docs/release/APP_PRIVACY.md` and export compliance notes in `docs/release/COMPLIANCE_CHECKLIST.md`.

## Next Actions

### Credentials and Environment
- [ ] Create/locate a Google Play service account key with release manager access; download the JSON.
- [ ] Store the JSON securely and set `GOOGLE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`) before running submission commands.
- [ ] Ensure `expo login` (or `EXPO_TOKEN`) is active on the machine/CI that will run the build.

### Build & Submit
- [x] From `mobile/`, run `npm run build:android:prod` and confirm the build summary shows package `com.pinataro.bloomsteward` and versionCode 28. _Result: Latest attempt (`15822cc5-7e26-47a7-9c8d-27a26ca9e881`) now passes the custom plugin stage but still fails during Gradle; pull the `Run gradlew` log from the Expo build page for the exact error before retrying._
- [ ] After the build finishes, run `npm run submit:android:latest` (or upload the `.aab` manually if preferred).

### Play Console Prep
- [ ] Create or verify the app record in Play Console with package `com.pinataro.bloomsteward`.
- [ ] Populate store listing text, icons, feature graphic, and screenshots using the repo docs above.
- [ ] Complete App Content: data safety questionnaire (match `APP_PRIVACY`), privacy policy URL, content rating, ads (No), news declarations if applicable.
- [ ] Add an internal testing list (Google Groups or email list) and save an initial release.

### Testing and Rollout
- [ ] Install the internal build from the Play link; run the Route List → Visit → Submit smoke test.
- [ ] Promote the same build to Closed/Open testing or Production once validation passes, updating release notes and country availability.

## Reminders
- Keep versionCode in sync with `app.json` each release (increment per Play upload).
- Rotate the service account key periodically and update any CI secrets.
- Use `.env` or EAS profile env vars if you need staging vs production API targets per build.
- Latest production build attempt (https://expo.dev/accounts/pinataro/projects/bloom-steward/builds/15822cc5-7e26-47a7-9c8d-27a26ca9e881) still fails during Gradle; review that log and address the reported task before another submission.
