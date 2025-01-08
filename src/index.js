import MIDIDevice from "./MIDIDevice.js";
import MIDIMessageTypes from "./MIDIMessageTypes.js";
import StorageManager from "./StorageManager.js";

class MIDIScriptManager {
  static MessageTypes = MIDIMessageTypes;
  static scriptOrigin;
  #serviceName;
  #options = {};
  #midiDevices = [];
  #storageManager;

  constructor(serviceName, options = {}) {
    this.#serviceName = serviceName;
    this.#options = {
      localStorageKey: "midi-scripts",
      postMessageKey: "MIDIScriptManager",
      executeScript: false,
      onMessage: null,
      onDeviceChange: null,
      ...options,
    };

    this.#storageManager = new StorageManager(this.#options);
  }

  get devices() {
    return this.#midiDevices;
  }

  async requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this browser.");
    }

    try {
      const midiAccess = await navigator.requestMIDIAccess();

      midiAccess.onstatechange = (e) => {
        if (e.port.type === "input") {
          this.#MIDIInputChanged(e.port);
        }
      };

      midiAccess.inputs.forEach((input) => {
        this.#MIDIInputChanged(input);
      });
    } catch (error) {
      throw new Error(`Failed to request MIDI access: ${error.message}`);
    }
  }

  findDevice(deviceName, deviceManufacturer) {
    return this.#midiDevices.find(
      (device) =>
        device.name === deviceName && device.manufacturer === deviceManufacturer
    );
  }

  openCustomScriptEditor() {
    const EditorURL = `${MIDIScriptManager.scriptOrigin}/midi-script-manager-js/custom-script-editor/`;
    const params = new URLSearchParams({
      service: this.#serviceName,
      targetOrigin: location.origin,
    });

    const childWindow = window.open(
      `${EditorURL}?${params.toString()}`,
      "CustomScriptEditor",
      "width=640,height=720"
    );

    window.addEventListener("message", (event) => {
      if (event.origin !== MIDIScriptManager.scriptOrigin) return;
      if (event.data.sender === "MIDIScriptManager") {
        const data = event.data.data;
        if (data === "requestData") {
          childWindow.postMessage(
            {
              sender: "MIDIScriptManager",
              data: this.#storageManager.loadAll(),
            },
            MIDIScriptManager.scriptOrigin
          );
          return;
        } else {
          for (const device of data) {
            this.importKeymapObject(device);
          }
        }
      }
    });
  }

  importKeymapObject(keymapObject) {
    this.#storageManager.saveObject(keymapObject);

    // デバイスが存在する場合はマッピングを適用
    const dev = this.findDevice(
      keymapObject.device.name,
      keymapObject.device.manufacturer
    );
    if (dev) {
      dev.applyMappings(keymapObject.mappings);
    }
  }

  #MIDIInputChanged(MIDIInput) {
    // デバイスを削除
    const deviceResult = this.findDevice(
      MIDIInput.name,
      MIDIInput.manufacturer
    );
    if (deviceResult) {
      this.#midiDevices.splice(this.#midiDevices.indexOf(deviceResult), 1);
    }

    if (MIDIInput.state === "connected") {
      // デバイスを追加
      const device = new MIDIDevice(
        MIDIInput,
        this.#serviceName,
        this.#saveControls.bind(this),
        {
          ...this.#options,
          data: this.#storageManager.load(
            MIDIInput.name,
            MIDIInput.manufacturer,
            this.#serviceName
          ),
        }
      );
      this.#midiDevices.push(device);
      if (this.#options.onDeviceChange) {
        this.#options.onDeviceChange(device);
      }
    }
  }

  #saveControls(device) {
    this.#storageManager.save(device);
  }
}

if (document.currentScript && document.currentScript.src) {
  const scriptSrc = document.currentScript.src;
  const scriptOrigin = new URL(scriptSrc).origin;
  MIDIScriptManager.scriptOrigin = scriptOrigin;
} else {
  MIDIScriptManager.scriptOrigin = "https://kazuprog.github.io";
}

export default MIDIScriptManager;
