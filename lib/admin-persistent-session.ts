/**
 * Opted-in device persistence for the admin's fine-grained GitHub token.
 * No cleartext PAT is written to Web Storage or IndexedDB. A non-extractable
 * WebCrypto AES-GCM key and encrypted token are stored in IndexedDB.
 * This protects casual at-rest inspection, not a compromised same-origin script.
 */
const DB_NAME = 'hyu-premium-admin-credentials-v1';
const STORE = 'secrets';
const KEY_ID = 'device-key';
const TOKEN_ID = 'sealed-pat';

type SealedToken = { version: 1; iv: number[]; data: number[] };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle || !window.isSecureContext) {
      reject(new Error('Trình duyệt không hỗ trợ lưu phiên mã hóa an toàn.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được bộ nhớ phiên quản trị.'));
    request.onblocked = () => reject(new Error('Bộ nhớ phiên đang được sử dụng bởi tab khác.'));
  });
}

function getValue<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function saveValue(db: IDBDatabase, id: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function rememberAdminToken(token: string): Promise<void> {
  if (!token.startsWith('github_pat_')) throw new Error('GitHub token không hợp lệ.');
  const db = await openDatabase();
  try {
    let key = await getValue<CryptoKey>(db, KEY_ID);
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
      await saveValue(db, KEY_ID, key);
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
    const sealed: SealedToken = { version: 1, iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
    await saveValue(db, TOKEN_ID, sealed);
  } finally {
    db.close();
  }
}

export async function restoreAdminToken(): Promise<string | null> {
  const db = await openDatabase();
  try {
    const key = await getValue<CryptoKey>(db, KEY_ID);
    const sealed = await getValue<SealedToken>(db, TOKEN_ID);
    if (!key || !sealed || sealed.version !== 1) return null;
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(sealed.iv) },
        key, new Uint8Array(sealed.data),
      );
      const token = new TextDecoder().decode(plaintext);
      return token.startsWith('github_pat_') ? token : null;
    } catch {
      // Preserve nothing that cannot be decrypted; do not reuse damaged credentials.
      await clearSessionInDatabase(db);
      return null;
    }
  } finally {
    db.close();
  }
}

function clearSessionInDatabase(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function forgetAdminToken(): Promise<void> {
  const db = await openDatabase();
  try {
    await clearSessionInDatabase(db);
  } finally {
    db.close();
  }
}
