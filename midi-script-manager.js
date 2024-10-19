"use strict";

const MIDIMessageType = {
  NoteOff: 0x80,
  NoteOn: 0x90,
  ControlChange: 0xb0,
};

class MIDIScriptManager {
  #options = {};
  #controls = [];

  constructor(options = {}) {
    this.#options = {
      localStorageKey: "midi-scripts",
      executeScript: false,
      onMessage: null,
      ...options,
    };
    if (this.#options.localStorageKey) {
      window.addEventListener("storage", (event) => {
        if (event.key === this.#options.localStorageKey) {
          this.#controls = JSON.parse(event.newValue) || [];
        }
      });
      this.#controls =
        JSON.parse(localStorage.getItem(this.#options.localStorageKey)) || [];
    }
  }

  async requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this browser.");
    }

    try {
      const midiAccess = await navigator.requestMIDIAccess();
      const inputs = Array.from(midiAccess.inputs.values());

      if (inputs.length === 0) {
        throw new Error("No MIDI input devices found.");
      }

      const input = inputs[0];
      input.onmidimessage = (e) => this.#onMIDIMessage(e);

      return {
        manufacturer: input.manufacturer,
        name: input.name,
      };
    } catch (error) {
      throw new Error(`Failed to request MIDI access: ${error.message}`);
    }
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    if (messageType !== MIDIMessageType.ControlChange) {
      return;
    }

    if (!this.#controls[data1]) {
      this.#controls[data1] = {
        name: "0x" + hex(data1),
      };
      this.#saveControls();
    }

    if (this.#options.onMessage) {
      this.#options.onMessage(messageType, channel, data1, data2);
    }

    if (this.#options.executeScript) {
      if (this.#controls[data1]) {
        try {
          const scriptFunction = new Function(
            "status",
            "data1",
            "data2",
            "messageType",
            "channel",
            this.#controls[data1].script
          );
          scriptFunction(status, data1, data2, messageType, channel);
        } catch (error) {
          console.error(
            "An error occurred while executing the custom script:",
            error
          );
        }
      }
    }
  }

  getKeyInfo(key) {
    const hex = (val, len = 2) => {
      return val.toString(16).toUpperCase().padStart(len, "0");
    };
    const info = {
      key,
      enabled: false,
      keyName: `0x${hex(key)}`,
      scriptName: null,
      script: null,
    };
    if (this.#controls[key]) {
      info.enabled = true;
      if (this.#controls[key].name) {
        info.keyName = this.#controls[key].name;
      }

      if (this.#controls[key].script) {
        info.script = this.#controls[key].script;
        if (this.#controls[key].scriptName) {
          info.scriptName = this.#controls[key].scriptName;
        }
      }
    }
    return info;
  }

  setKeyName(key, name) {
    const control = this.#controls[key];
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

  setScript(key, script) {
    const control = this.#controls[key];
    if (control) {
      const trimmed = script.trim();
      if (trimmed === "") {
        delete control.script;
        delete control.scriptName;
      } else {
        control.script = trimmed;
      }
      this.#saveControls();
    }
    return control;
  }

  setScriptName(key, scriptName) {
    const control = this.#controls[key];
    if (control && control.script) {
      const trimmed = scriptName.trim();
      if (trimmed === "") {
        delete control.scriptName;
      } else {
        control.scriptName = trimmed;
      }
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

  #saveControls() {
    if (this.#options.localStorageKey) {
      localStorage.setItem(
        this.#options.localStorageKey,
        JSON.stringify(this.#controls)
      );
    }
  }
}
