"use strict";

const MIDIMessageType = {
  NoteOff: 0x80,
  NoteOn: 0x90,
  ControlChange: 0xb0,
};

class MIDIScriptManager {
  static noteNames = "C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|");
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

  #loadFromObject(obj) {
    this.#midiDevices = [];
    for (const val of obj) {
      this.#midiDevices.push(
        new _MIDIDevice(
          val.device.name,
          val.device.manufacturer,
          val.keymap,
          this.#saveControls.bind(this)
        )
      );
    }
  }

  async requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this browser.");
    }

    await new Promise((resolve) => {
      if (this.#midiDevices !== null) return resolve();

      const intervalId = setInterval(() => {
        if (this.#midiDevices !== null) {
          clearInterval(intervalId);
          resolve();
        }
      }, 10);
    });

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
      return;
    } catch (error) {
      throw new Error(`Failed to request MIDI access: ${error.message}`);
    }
  }

  #MIDIInputChanged(MIDIInput) {
    if (MIDIInput.state !== "connected") {
      return;
    }

    MIDIInput.onmidimessage = (e) => this.#onMIDIMessage(e);

    let device = {
      name: MIDIInput.name,
      manufacturer: MIDIInput.manufacturer,
    };

    if (this.#getKeyMap(device.name, device.manufacturer) === null) {
      this.#midiDevices.push(
        new _MIDIDevice(
          device.name,
          device.manufacturer,
          null,
          this.#saveControls.bind(this)
        )
      );
      this.#saveControls();
    }

    if (this.#options.onDeviceChange) {
      this.#options.onDeviceChange(device);
    }
  }

  #getKeyMap(name, manufacturer, messageType = null) {
    for (const midiDevice of this.#midiDevices) {
      if (
        midiDevice.name === name &&
        midiDevice.manufacturer === manufacturer
      ) {
        switch (messageType) {
          case null:
            return {
              note: midiDevice.noteKeyMap,
              cc: midiDevice.ccKeyMap,
            };
          case MIDIMessageType.NoteOn:
          case MIDIMessageType.NoteOff:
            return midiDevice.noteKeyMap;
          case MIDIMessageType.ControlChange:
            return midiDevice.ccKeyMap;
        }
      }
    }
    return null;
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    const device = {
      name: midiMessage.target.name,
      manufacturer: midiMessage.target.manufacturer,
    };

    const midiKeyMap = this.#getKeyMap(
      device.name,
      device.manufacturer,
      messageType
    );

    if (midiKeyMap === null) {
      throw new Error(
        "Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen."
      );
    }

    if (!midiKeyMap[data1]) {
      midiKeyMap[data1] = new _MIDIElement(
        messageType,
        data1,
        null,
        this.#saveControls.bind(this)
      );
      this.#saveControls();
    }

    if (this.#options.onMessage) {
      this.#options.onMessage(device, messageType, channel, data1, data2);
    }

    if (this.#options.executeScript) {
      if (midiKeyMap[data1].scriptCode) {
        try {
          const scriptFunction = new Function(
            "status",
            "data1",
            "data2",
            "messageType",
            "channel",
            "number",
            "value",
            "val",
            midiKeyMap[data1].scriptCode
          );
          scriptFunction(
            status,
            data1,
            data2,
            messageType,
            channel,
            data1,
            data2,
            data2 / 127
          );
        } catch (error) {
          console.error(
            "An error occurred while executing the custom script:",
            error
          );
        }
      }
    }
  }

  getKeyInfo(device, messageType, key) {
    const keyMap = this.#getKeyMap(
      device.name,
      device.manufacturer,
      messageType
    );
    if (keyMap === null) return null;

    const info = {
      key,
      enabled: false,
      keyName: `0x${key.toString(16).toUpperCase().padStart(2, "0")}`,
      scriptName: null,
      script: null,
    };

    if (
      messageType === MIDIMessageType.NoteOff ||
      messageType === MIDIMessageType.NoteOn
    ) {
      info.keyName = this.#getNoteName(key);
    }

    if (keyMap[key]) {
      info.enabled = true;
      if (keyMap[key].name) {
        info.keyName = keyMap[key].name;
      }

      if (keyMap[key].scriptCode) {
        info.scriptName = keyMap[key].scriptName;
        info.script = keyMap[key].scriptCode;
      }
    }

    return info;
  }

  setKeyName(device, messageType, key, keyName) {
    return this.#patchKey(device, messageType, key, { keyName });
  }

  setScript(device, messageType, key, scriptCode) {
    return this.#patchKey(device, messageType, key, { scriptCode });
  }

  setScriptName(device, messageType, key, scriptName) {
    return this.#patchKey(device, messageType, key, { scriptName });
  }

  #patchKey(device, messageType, key, patch = {}) {
    const keyMap = this.#getKeyMap(
      device.name,
      device.manufacturer,
      messageType
    );

    if (keyMap && keyMap[key]) {
      const control = keyMap[key];
      for (const patchKey in patch) {
        let value = patch[patchKey];
        switch (patchKey) {
          case "keyName":
            control.name = value;
            break;
          case "scriptCode":
            control.scriptCode = value;
            break;
          case "scriptName":
            control.scriptName = value;
            break;
        }
      }
    }

    // 更新後の情報を返す
    return this.getKeyInfo(device, messageType, key);
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
      //TODO
      if (event.origin !== MIDIScriptManager.scriptOrigin) return;
      if (event.data.sender === "MIDIScriptManager") {
        const data = event.data.data;
        if (data === "window.loaded") {
          childWindow.postMessage(
            {
              sender: "MIDIScriptManager",
              data: this.#midiDevices,
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

  #getNoteName(noteNumber) {
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteIndex = noteNumber % 12;
    const noteName = MIDIScriptManager.noteNames[noteIndex];
    return `${noteName}${octave}`;
  }
}

class _MIDIDevice {
  #name;
  #manufacturer;
  #noteKeyMap;
  #ccKeyMap;
  #saveCallback;

  constructor(name, manufacturer, keymaps, saveCallback) {
    this.#name = name;
    this.#manufacturer = manufacturer;
    this.#noteKeyMap = new Array(0x80).fill(null);
    this.#ccKeyMap = new Array(0x80).fill(null);
    this.#saveCallback = saveCallback;

    if (keymaps) {
      for (const idx in keymaps.note) {
        if (keymaps.note[idx]) {
          this.#noteKeyMap[idx] = new _MIDIElement(
            MIDIMessageType.NoteOn,
            idx,
            keymaps.note[idx],
            this.#saveCallback
          );
        }
      }
      for (const idx in keymaps.cc) {
        if (keymaps.cc[idx]) {
          this.#ccKeyMap[idx] = new _MIDIElement(
            MIDIMessageType.ControlChange,
            idx,
            keymaps.cc[idx],
            this.#saveCallback
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
  static noteNames = "C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|");
  #messageType;
  #data1;
  #name;
  #scriptName;
  #scriptCode;
  #saveCallback;

  constructor(messageType, data1, data, saveCallback) {
    this.#messageType = messageType;
    this.#data1 = data1;

    this.#name = data?.name || null;
    this.#scriptName = data?.script?.name || null;
    this.#scriptCode = data?.script?.code || null;
    this.#saveCallback = saveCallback;
  }

  get name() {
    let name = this.#name;
    if (name === null) {
      switch (this.#messageType) {
        case MIDIMessageType.NoteOff:
        case MIDIMessageType.NoteOn:
          name = this.#getNoteName(this.#data1);
          break;
        case MIDIMessageType.ControlChange:
          const hex = this.#data1.toString(16).toUpperCase().padStart(2, "0");
          name = `0x${hex}`;
          break;
      }
    }
    return name;
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

  toJSON() {
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
  }

  #getNoteName(noteNumber) {
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteIndex = noteNumber % 12;
    const noteName = _MIDIElement.noteNames[noteIndex];
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
