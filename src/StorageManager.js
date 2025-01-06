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
      window.opener.addEventListener("beforeunload", () => {
        window.close();
      });
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

  load(deviceName, deviceManufacturer) {
    return this.#data.find(
      (device) =>
        device.device.name === deviceName &&
        device.device.manufacturer === deviceManufacturer
    );
  }

  save(midiDevice) {
    if (!midiDevice instanceof MIDIDevice) {
      throw new Error("Invalid device type");
    }

    this.saveObject(midiDevice.toJSON());
  }

  saveObject(obj) {
    const target = this.#data.find(
      (device) =>
        device.device.name === obj.device.name &&
        device.device.manufacturer === obj.device.manufacturer
    );

    if (target) {
      Object.assign(target, obj);
    } else {
      this.#data.push(obj);
    }

    this.#storageHandler.save(this.#data);
  }
}

export default StorageManager;
