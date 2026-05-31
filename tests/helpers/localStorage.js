class LocalStorageMock {
  constructor() {
    /** @type {Map<string, string>} */
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export function createLocalStorageMock() {
  return new LocalStorageMock();
}
