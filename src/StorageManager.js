import LocalStorageHandler from "./LocalStorageHandler";
import MIDIDevice from "./MIDIDevice";
import PostMessageHandler from "./PostMessageHandler";

class StorageManager {
  #storageHandler;
  #data;

  constructor(options) {
    const params = new URLSearchParams(window.location.search);
    const targetOrigin = params.get("targetOrigin");
    if (window.opener && targetOrigin) {
      this.#storageHandler = new PostMessageHandler(
        targetOrigin,
        options.postMessageKey
      );
      try {
        // ドメインが異なるとエラーになるため、try-catchで囲む
        window.opener.addEventListener("beforeunload", () => {
          window.close();
        });
      } catch (e) {
        console.log(e);
      }
    } else {
      this.#storageHandler = new LocalStorageHandler(options.localStorageKey);
      window.addEventListener("storage", (event) => {
        if (event.key === options.localStorageKey) {
          this.#data = JSON.parse(event.newValue) || [];
        }
      });
    }

    this.#storageHandler.load().then((data) => {
      this.#data = data || [];
    });
  }

  loadAll() {
    return this.#data;
  }

  load(deviceName, deviceManufacturer, serviceName) {
    return this.#data.find(
      (device) =>
        device.device.name === deviceName &&
        device.device.manufacturer === deviceManufacturer &&
        device.service === serviceName
    );
  }

  save(midiDevice) {
    if (!midiDevice instanceof MIDIDevice) {
      throw new Error("Invalid device type");
    }

    this.saveObject(midiDevice.toJSON());
  }

  saveObject(obj) {
    if (!this.isValidKeymapObject(obj)) {
      throw new Error("The format of the key mapping object is invalid.");
    }

    const target = this.#data.find(
      (device) =>
        device.device.name === obj.device.name &&
        device.device.manufacturer === obj.device.manufacturer &&
        device.service === obj.service
    );

    if (target) {
      Object.assign(target, obj);
    } else {
      this.#data.push(obj);
    }

    this.#storageHandler.save(this.#data);
  }

  isValidKeymapObject(obj) {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    if (
      typeof obj.device?.name !== "string" ||
      typeof obj.device?.manufacturer !== "string"
    ) {
      return false;
    }

    if (typeof obj.service !== "string") {
      return false;
    }

    if (!Array.isArray(obj.mappings)) {
      return false;
    }

    return true;
  }
}

export default StorageManager;
