"use strict";

const MIDIMessageType = {
  NoteOff: 0x80,
  NoteOn: 0x90,
  ControlChange: 0xb0,
};

class MIDIScriptManager {
  static scriptOrigin;
  #options = {};
  #midiKeyMappings = null;
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
          this.#midiKeyMappings = event.data.data;
          this.#options.onDeviceChange(this.#midiKeyMappings[0].device);
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
          this.#midiKeyMappings = JSON.parse(event.newValue) || [];
        }
      });
      this.#midiKeyMappings =
        JSON.parse(localStorage.getItem(this.#options.localStorageKey)) || [];
    } else {
      this.#midiKeyMappings = [];
    }
  }

  async requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this browser.");
    }

    await new Promise((resolve) => {
      if (this.#midiKeyMappings !== null) return resolve();

      const intervalId = setInterval(() => {
        if (this.#midiKeyMappings !== null) {
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
      this.#midiKeyMappings.push({
        device,
        keymap: new Array(0x80).fill(null),
      });
      this.#saveControls();
    }

    if (this.#options.onDeviceChange) {
      this.#options.onDeviceChange(device);
    }
  }

  #getKeyMap(name, manufacturer) {
    for (const midiKeyMapping of this.#midiKeyMappings) {
      if (
        midiKeyMapping.device.name === name &&
        midiKeyMapping.device.manufacturer === manufacturer
      ) {
        return midiKeyMapping.keymap;
      }
    }
    return null;
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    if (messageType !== MIDIMessageType.ControlChange) {
      return;
    }

    const device = {
      name: midiMessage.target.name,
      manufacturer: midiMessage.target.manufacturer,
    };

    const midiKeyMap = this.#getKeyMap(device.name, device.manufacturer);

    if (midiKeyMap === null) {
      throw new Error(
        "Variable 'MIDIScriptManager.#midiKeyMappings' is not initialized. This should never happen."
      );
    }

    if (!midiKeyMap[data1]) {
      midiKeyMap[data1] = {
        name: "0x" + data1.toString(16).toUpperCase().padStart(2, "0"),
      };
      this.#saveControls();
    }

    if (this.#options.onMessage) {
      this.#options.onMessage(device, messageType, channel, data1, data2);
    }

    if (this.#options.executeScript) {
      if (midiKeyMap[data1].script) {
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
            midiKeyMap[data1].script.code
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

  getKeyInfo(device, key) {
    const keyMap = this.#getKeyMap(device.name, device.manufacturer);
    if (keyMap === null) {
      return null;
    }

    const info = {
      key,
      enabled: false,
      keyName: `0x${key.toString(16).toUpperCase().padStart(2, "0")}`,
      scriptName: null,
      script: null,
    };

    if (keyMap[key]) {
      info.enabled = true;
      if (keyMap[key].name) {
        info.keyName = keyMap[key].name;
      }

      if (keyMap[key].script) {
        info.scriptName = keyMap[key].script.name;
        info.script = keyMap[key].script.code;
      }
    }
    return info;
  }

  setKeyName(device, key, name) {
    const keyMap = this.#getKeyMap(device.name, device.manufacturer);
    if (keyMap === null) {
      return null;
    }
    const control = keyMap[key];
    if (control) {
      const trimmed = name.trim();
      if (trimmed === "") {
        delete control.name;
      } else {
        control.name = trimmed;
      }
      this.#saveControls();
    }
    return control;
  }

  setScript(device, key, script) {
    const keyMap = this.#getKeyMap(device.name, device.manufacturer);
    if (keyMap === null) {
      return null;
    }
    const control = keyMap[key];
    if (control) {
      const trimmed = script.trim();
      if (trimmed === "") {
        delete control.script;
      } else {
        if (control.script) {
          control.script.code = trimmed;
        } else {
          control.script = {
            name: "",
            code: trimmed,
          };
        }
      }
      this.#saveControls();
    }
    return control;
  }

  setScriptName(device, key, scriptName) {
    const keyMap = this.#getKeyMap(device.name, device.manufacturer);
    if (keyMap === null) {
      return null;
    }
    const control = keyMap[key];
    if (control && control.script) {
      control.script.name = scriptName.trim();
      this.#saveControls();
    }
    return control;
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
              data: this.#midiKeyMappings,
            },
            MIDIScriptManager.scriptOrigin
          );
          return;
        }

        this.#midiKeyMappings = data;
        this.#saveControls();
      }
    });
  }

  #saveControls() {
    if (this.#options.localStorageKey) {
      localStorage.setItem(
        this.#options.localStorageKey,
        JSON.stringify(this.#midiKeyMappings)
      );
    }
    if (window.opener && this.#targetOrigin) {
      window.opener.postMessage(
        {
          sender: "MIDIScriptManager",
          data: this.#midiKeyMappings,
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
