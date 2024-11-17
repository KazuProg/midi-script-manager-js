"use strict";

const MIDIMessageType = {
  NoteOff: 0x80,
  NoteOn: 0x90,
  ControlChange: 0xb0,
};

class MIDIScriptManager {
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

    let device = new _MIDIDevice(
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
        new _MIDIDevice(
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

class _MIDIDevice {
  #name;
  #manufacturer;
  #noteKeyMap;
  #ccKeyMap;
  #saveCallback;

  constructor(name, manufacturer, saveCallback, keymaps = null) {
    this.#name = name;
    this.#manufacturer = manufacturer;
    this.#saveCallback = saveCallback;

    this.#noteKeyMap = Array.from(
      { length: 0x80 },
      (_, index) =>
        new _MIDIElement(
          this,
          MIDIMessageType.NoteOn,
          index,
          this.#saveCallback
        )
    );
    this.#ccKeyMap = Array.from(
      { length: 0x80 },
      (_, index) =>
        new _MIDIElement(
          this,
          MIDIMessageType.ControlChange,
          index,
          this.#saveCallback
        )
    );

    if (keymaps) {
      for (const idx in keymaps.note) {
        if (keymaps.note[idx]) {
          this.#noteKeyMap[idx] = new _MIDIElement(
            this,
            MIDIMessageType.NoteOn,
            idx,
            this.#saveCallback,
            keymaps.note[idx]
          );
        }
      }
      for (const idx in keymaps.cc) {
        if (keymaps.cc[idx]) {
          this.#ccKeyMap[idx] = new _MIDIElement(
            this,
            MIDIMessageType.ControlChange,
            idx,
            this.#saveCallback,
            keymaps.cc[idx]
          );
        }
      }
    }
  }

  get name() {
    return this.#name;
  }

  get manufacturer() {
    return this.#manufacturer;
  }

  get noteKeyMap() {
    return this.#noteKeyMap;
  }

  get ccKeyMap() {
    return this.#ccKeyMap;
  }

  getKeyMap(midiMessageType) {
    switch (midiMessageType) {
      case MIDIMessageType.NoteOff:
      case MIDIMessageType.NoteOn:
        return this.#noteKeyMap;
      case MIDIMessageType.ControlChange:
        return this.#ccKeyMap;
    }
    return null;
  }

  toJSON() {
    return {
      device: {
        name: this.#name,
        manufacturer: this.#manufacturer,
      },
      keymap: {
        note: this.#noteKeyMap,
        cc: this.#ccKeyMap,
      },
    };
  }
}

class _MIDIElement {
  #device;
  #messageType;
  #midiNumber;
  #isAvailable = false;
  #name = null;
  #scriptName = null;
  #scriptCode = null;
  #saveCallback;

  constructor(device, messageType, midiNumber, saveCallback, data = null) {
    this.#device = device;
    this.#messageType = messageType;
    this.#midiNumber = midiNumber;

    if (data) {
      this.#isAvailable = true;
      this.#name = data?.name || null;
      this.#scriptName = data?.script?.name || null;
      this.#scriptCode = data?.script?.code || null;
    }
    this.#saveCallback = saveCallback;
  }

  get device() {
    return this.#device;
  }

  get midiNumber() {
    return this.#midiNumber;
  }

  get isAvailable() {
    return this.#isAvailable;
  }

  get name() {
    return this.#name !== null ? this.#name : this.#getDefaultName();
  }

  get isDefaultName() {
    return this.#name === null;
  }

  get scriptName() {
    return this.#scriptName;
  }

  get scriptCode() {
    return this.#scriptCode;
  }

  set name(value) {
    value = value.trim();
    if (value === "") {
      value = null;
    }
    this.#name = value;
    this.#saveCallback();
  }

  set scriptName(value) {
    value = value.trim();
    if (value === "") {
      value = null;
    }
    this.#scriptName = value;
    this.#saveCallback();
  }

  set scriptCode(value) {
    value = value.trim();
    if (value === "") {
      this.#scriptName = null;
      this.#scriptCode = null;
    } else {
      this.#scriptCode = value.trim();
    }
    this.#saveCallback();
  }

  setAvailable() {
    this.#isAvailable = true;
    this.#saveCallback();
  }

  executeScript(argumentObject = {}) {
    if (this.#scriptCode) {
      try {
        const scriptFunction = new Function(
          ...Object.keys(argumentObject),
          this.#scriptCode
        );
        scriptFunction(...Object.values(argumentObject));
      } catch (error) {
        console.error(
          "An error occurred while executing the custom script:",
          error
        );
      }
    }
  }

  toJSON() {
    if (this.#isAvailable) {
      const result = {};
      if (this.#name) {
        result.name = this.#name;
        if (this.#scriptCode) {
          result.script = {
            name: this.#scriptName,
            code: this.#scriptCode,
          };
        }
      }
      return result;
    } else {
      return null;
    }
  }

  #getDefaultName() {
    let name;
    switch (this.#messageType) {
      case MIDIMessageType.NoteOff:
      case MIDIMessageType.NoteOn:
        name = this.#getNoteName(this.#midiNumber);
        break;
      case MIDIMessageType.ControlChange:
        const hex = this.#midiNumber
          .toString(16)
          .toUpperCase()
          .padStart(2, "0");
        name = `0x${hex}`;
        break;
    }
    return name;
  }

  #getNoteName(noteNumber) {
    const noteNames = "C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|");
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteIndex = noteNumber % 12;
    const noteName = noteNames[noteIndex];
    return `${noteName}${octave}`;
  }
}

if (document.currentScript && document.currentScript.src) {
  const scriptSrc = document.currentScript.src;
  const scriptOrigin = new URL(scriptSrc).origin;
  MIDIScriptManager.scriptOrigin = scriptOrigin;
} else {
  MIDIScriptManager.scriptOrigin = "https://kazuprog.github.io";
}
