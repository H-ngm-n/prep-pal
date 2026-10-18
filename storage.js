/* =====================================================================
   SYNC_CONFIG: optional cross-device sync. OFF by default.
   When enabled:false, every profile lives only in this browser's
   localStorage, so nothing leaves the device.
   To turn on Firebase Auth (email link / Google) + Firestore per-user
   sync, fill in firebaseConfig and set enabled:true. See SYNC_SETUP.md.
   ===================================================================== */
const SYNC_CONFIG = {
  enabled: false,
  provider: 'firebase',
  signInMethods: ['emailLink', 'google'],
  firebaseConfig: { apiKey: '', authDomain: '', projectId: '', appId: '' },
  sdkVersion: '10.12.2'
};

/* Optional base URL of YOUR price proxy (see PROXY_SPEC.md). Blank = estimated prices.json only.
   When set, the Kroger-family provider calls {PRICE_API_URL}/locations?zip=..&chain=..
   and {PRICE_API_URL}/products?locationId=..&items=.. to get live prices + aisleLocations. */
const PRICE_API_URL = '';

/* ---------------- Storage abstraction ----------------
   The app only talks to `Store`. Both backends expose the same async API:
   listProfiles() -> [{id,name}], getProfile(id), saveProfile(p), deleteProfile(id),
   getActiveId(), setActiveId(id)                                              */
const LS_INDEX = 'mealprep.index', LS_ACTIVE = 'mealprep.active', LS_PROFILE = id => 'mealprep.profile.' + id;

const LocalStore = {
  kind: 'local',
  async listProfiles() { try { return JSON.parse(localStorage.getItem(LS_INDEX)) || []; } catch { return []; } },
  async getProfile(id) { try { return JSON.parse(localStorage.getItem(LS_PROFILE(id))); } catch { return null; } },
  async saveProfile(p) {
    p.updatedAt = new Date().toISOString();
    localStorage.setItem(LS_PROFILE(p.id), JSON.stringify(p));
    const idx = await this.listProfiles(), i = idx.findIndex(x => x.id === p.id);
    if (i < 0) idx.push({ id: p.id, name: p.name }); else idx[i].name = p.name;
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  },
  async deleteProfile(id) {
    localStorage.removeItem(LS_PROFILE(id));
    localStorage.setItem(LS_INDEX, JSON.stringify((await this.listProfiles()).filter(x => x.id !== id)));
  },
  async getActiveId() { return localStorage.getItem(LS_ACTIVE); },
  async setActiveId(id) { localStorage.setItem(LS_ACTIVE, id); }
};

/* Firestore backend (only loaded when SYNC_CONFIG.enabled). Layout:
   users/{uid}/profiles/{profileId}. The security rules in SYNC_SETUP.md
   restrict every path to request.auth.uid == uid. */
function makeFirestoreStore() {
  let db, uid, fs;
  const base = 'https://www.gstatic.com/firebasejs/' + SYNC_CONFIG.sdkVersion + '/';
  const ready = (async () => {
    const appM = await import(base + 'firebase-app.js');
    const authM = await import(base + 'firebase-auth.js');
    fs = await import(base + 'firebase-firestore.js');
    const app = appM.initializeApp(SYNC_CONFIG.firebaseConfig);
    const auth = authM.getAuth(app);
    if (authM.isSignInWithEmailLink(auth, location.href)) {
      const email = localStorage.getItem('mealprep.signinEmail') || prompt('Confirm your email');
      await authM.signInWithEmailLink(auth, email, location.href);
    }
    uid = await new Promise(res => authM.onAuthStateChanged(auth, u => res(u && u.uid)));
    if (!uid) {
      const email = prompt('Sign in to sync. Enter your email for a sign-in link, or leave it blank to use Google:');
      if (email) {
        await authM.sendSignInLinkToEmail(auth, email, { url: location.href, handleCodeInApp: true });
        localStorage.setItem('mealprep.signinEmail', email);
        alert('Check your email for the sign-in link.'); throw new Error('awaiting email link');
      }
      uid = (await authM.signInWithPopup(auth, new authM.GoogleAuthProvider())).user.uid;
    }
    db = fs.getFirestore(app);
  })();
  const col = () => fs.collection(db, 'users', uid, 'profiles');
  return {
    kind: 'firestore',
    async listProfiles() { await ready; const s = await fs.getDocs(col()); return s.docs.map(d => ({ id: d.id, name: d.data().name })); },
    async getProfile(id) { await ready; const d = await fs.getDoc(fs.doc(col(), id)); return d.exists() ? d.data() : null; },
    async saveProfile(p) { await ready; p.updatedAt = new Date().toISOString(); await fs.setDoc(fs.doc(col(), p.id), JSON.parse(JSON.stringify(p))); LocalStore.saveProfile(p); },
    async deleteProfile(id) { await ready; await fs.deleteDoc(fs.doc(col(), id)); LocalStore.deleteProfile(id); },
    getActiveId: LocalStore.getActiveId, setActiveId: LocalStore.setActiveId
  };
}

const Store = SYNC_CONFIG.enabled ? makeFirestoreStore() : LocalStore;

/* Export / import helpers (file or copy-paste code) */
const ProfileIO = {
  toCode(p) { return 'MP1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, profile: p })))); },
  fromText(t) {
    t = t.trim();
    let o = t.startsWith('MP1.') ? JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))) : JSON.parse(t);
    const p = o.profile || o;
    if (!p || !p.targets) throw new Error('Not a meal-prep profile');
    return p;
  }
};
