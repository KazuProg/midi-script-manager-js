import MIDIMessageTypes from "./MIDIMessageTypes";

class MIDIElement {
  #device;
  #midiStatus;
  #midiNumber;
  #name = null;
  #scriptName = null;
  #scriptCode = null;
  #saveCallback;

  constructor(device, midiStatus, midiNumber, saveCallback, data = {}) {
    this.#device = device;
    this.#midiStatus = midiStatus;
    this.#midiNumber = midiNumber;

    this.#name = data?.name || null;
    this.#scriptName = data?.script?.name || null;
    this.#scriptCode = data?.script?.code || null;

    this.#saveCallback = saveCallback;
  }

  get device() {
    return this.#device;
  }

  get messageType() {
    return this.#midiStatus & 0xf0;
  }

  get channel() {
    return this.#midiStatus & 0x0f;
  }

  get number() {
    return this.#midiNumber;
  }

  get defaultName() {
    let name;
    switch (this.messageType) {
      case MIDIMessageTypes.NoteOff:
      case MIDIMessageTypes.NoteOn:
        name = this.#getNoteName(this.#midiNumber);
        break;
      case MIDIMessageTypes.ControlChange:
        const hex = this.#midiNumber
          .toString(16)
          .toUpperCase()
          .padStart(2, "0");
        name = `0x${hex}`;
        break;
    }
    return name;
  }

  get name() {
    return this.#name !== null ? this.#name : this.defaultName;
  }

  get isDefaultName() {
    return this.#name === null;
  }

  get scriptName() {
    if (this.scriptCode) {
      return this.#scriptName || "No Name";
    }
    return null;
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

  get midiID() {
    return ((this.#midiStatus << 8) + this.#midiNumber).toString(16);
  }

  toJSON() {
    const result = {
      midi: this.midiID,
      name: this.name,
    };
    if (this.#scriptCode) {
      result.script = {
        name: this.#scriptName,
        code: this.#scriptCode,
      };
    }
    return result;
  }

  #getNoteName(noteNumber) {
    const noteNames = "C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|");
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteIndex = noteNumber % 12;
    const noteName = noteNames[noteIndex];
    return `${noteName}${octave}`;
  }
}

export default MIDIElement;
