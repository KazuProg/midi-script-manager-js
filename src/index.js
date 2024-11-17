import MIDIDevice from "./MIDIDevice.js";
import MIDIMessageTypes from "./MIDIMessageTypes.js";

class MIDIScriptManager {
  static MessageTypes = MIDIMessageTypes;
  static scriptOrigin;
  #options = {};
  #midiDevices = null;
  #targetOrigin = null;

  constructor(options = {}) {
    this.#options = {
      localStorageKey: "midi-scripts",
      executeScript: false,
      onMessage: null,
      onDeviceChange: null,
      ...options,
    };

    const params = new URLSearchParams(window.location.search);
    this.#targetOrigin = params.get("targetOrigin");
    if (window.opener && this.#targetOrigin) {
      this.#options.localStorageKey = null;
      const listener = (event) => {
        if (event.origin !== this.#targetOrigin) return;
        if (event.data.sender && event.data.sender === "MIDIScriptManager") {
          window.removeEventListener("message", listener);
          console.log(event.data.data);
          this.#loadFromObject(event.data.data);
          this.#options.onDeviceChange(this.#midiDevices[0]);
        }
      };
      window.addEventListener("message", listener);
      window.opener.postMessage(
        {
          sender: "MIDIScriptManager",
          data: "window.loaded",
        },
        this.#targetOrigin
      );
      window.opener.addEventListener("beforeunload", () => {
        window.close();
      });
    } else if (this.#options.localStorageKey) {
      window.addEventListener("storage", (event) => {
        if (event.key === this.#options.localStorageKey) {
          this.#loadFromObject(JSON.parse(event.newValue) || []);
        }
      });
      this.#loadFromObject(
        JSON.parse(localStorage.getItem(this.#options.localStorageKey)) || []
      );
    } else {
      this.#midiDevices = [];
    }
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

  reset() {
    if (this.#options.localStorageKey) {
      if (
        confirm("Settings will be reset. Are you sure you want to proceed?")
      ) {
        localStorage.removeItem(this.#options.localStorageKey);
        location.reload();
      }
    }
  }

  openCustomScriptEditor() {
    const EditorURL = `${MIDIScriptManager.scriptOrigin}/midi-script-manager-js/custom-script-editor/`;
    const params = new URLSearchParams({
      targetOrigin: location.origin,
    });

    const childWindow = window.open(
      `${EditorURL}?${params.toString()}`,
      "CustomScriptEditor",
      "width=960,height=540"
    );

    window.addEventListener("message", (event) => {
      if (event.origin !== MIDIScriptManager.scriptOrigin) return;
      if (event.data.sender === "MIDIScriptManager") {
        const data = event.data.data;
        if (data === "window.loaded") {
          childWindow.postMessage(
            {
              sender: "MIDIScriptManager",
              data: JSON.parse(JSON.stringify(this.#midiDevices)),
            },
            MIDIScriptManager.scriptOrigin
          );
          return;
        }

        this.#loadFromObject(data);
        this.#saveControls();
      }
    });
  }

  #MIDIInputChanged(MIDIInput) {
    if (MIDIInput.state !== "connected") {
      return;
    }

    MIDIInput.onmidimessage = this.#onMIDIMessage.bind(this);

    let device = new MIDIDevice(
      MIDIInput.name,
      MIDIInput.manufacturer,
      this.#saveControls.bind(this)
    );

    if (!this.findDevice(device.name, device.manufacturer)) {
      this.#midiDevices.push(device);
      this.#saveControls();
    } else {
      device = this.findDevice(device.name, device.manufacturer);
    }

    if (this.#options.onDeviceChange) {
      this.#options.onDeviceChange(device);
    }
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    const device = this.findDevice(
      midiMessage.target.name,
      midiMessage.target.manufacturer
    );

    if (!device) {
      throw new Error(
        "Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen."
      );
    }

    const midiKeyMap = this.findDevice(
      device.name,
      device.manufacturer
    )?.getKeyMap(messageType);

    if (!midiKeyMap) {
      throw new Error(
        "Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen."
      );
    }

    if (!midiKeyMap[data1].isAvailable) {
      midiKeyMap[data1].setAvailable();
    }

    if (this.#options.onMessage) {
      const midiData = {
        raw: midiMessage.data,
        status,
        data1,
        data2,
        messageType,
        channel,
      };
      this.#options.onMessage(midiKeyMap[data1], midiData);
    }

    if (this.#options.executeScript) {
      midiKeyMap[data1].executeScript({
        status,
        data1,
        data2,
        messageType,
        channel,
        number: data1,
        value: data2,
        val: data2 / 127,
      });
    }
  }

  #loadFromObject(obj) {
    this.#midiDevices = [];
    for (const val of obj) {
      this.#midiDevices.push(
        new MIDIDevice(
          val.device.name,
          val.device.manufacturer,
          this.#saveControls.bind(this),
          val.keymap
        )
      );
    }
  }

  #saveControls() {
    if (this.#options.localStorageKey) {
      localStorage.setItem(
        this.#options.localStorageKey,
        JSON.stringify(this.#midiDevices)
      );
    }
    if (window.opener && this.#targetOrigin) {
      window.opener.postMessage(
        {
          sender: "MIDIScriptManager",
          data: this.#midiDevices,
        },
        this.#targetOrigin
      );
    }
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
