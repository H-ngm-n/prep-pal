# Optional cross-device sync (Firebase Auth + Firestore)

Sync is **off by default**. With `SYNC_CONFIG.enabled = false` in `storage.js`, every profile lives only in the
browser's localStorage (`mealprep.index`, `mealprep.active`, plus one `mealprep.profile.<id>` key per profile).
Nothing leaves the device.

## Turning it on
1. Create a Firebase project at https://console.firebase.google.com and add a **Web app**. Copy its config.
2. Authentication → Sign-in method: enable **Email link (passwordless)** and/or **Google**. Add your hosting domain
   under *Authorized domains*.
3. Firestore Database → Create database (production mode). Paste in the rules below.
4. In `storage.js` set:
   ```js
   const SYNC_CONFIG = { enabled: true, provider: 'firebase', signInMethods: ['emailLink','google'],
     firebaseConfig: { apiKey: '…', authDomain: '…', projectId: '…', appId: '…' }, sdkVersion: '10.12.2' };
   ```
5. Bump the cache name in `sw.js` (`prep-pal-v1` → `v2`) and redeploy.

Each person signs in with their own email or Google account. Profiles are stored at
`users/{uid}/profiles/{profileId}`. A local copy is still kept for offline use.
To move existing device-only profiles into an account, use **Export** before turning sync on and **Import** after signing in.

## Firestore security rules (per-user)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```
These rules mean a signed-in user can read and write only their own documents. No one can list or open another user's data.
The Firebase web `apiKey` is not a secret. The rules are what protect the data.

## Data layer contract
The app talks only to `Store` (see `storage.js`): `listProfiles, getProfile, saveProfile, deleteProfile, getActiveId, setActiveId`.
`LocalStore` and the Firestore store both implement that API, so the rest of the app doesn't change when sync is turned on.
