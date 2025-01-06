class LocalStorageHandler {
  #key;

  constructor(key) {
    this.#key = key;
  }

  load() {
    return new Promise((resolve, reject) => {
      resolve(JSON.parse(localStorage.getItem(this.#key)));
    });
  }

  save(value) {
    localStorage.setItem(this.#key, JSON.stringify(value));
  }
}

export default LocalStorageHandler;
