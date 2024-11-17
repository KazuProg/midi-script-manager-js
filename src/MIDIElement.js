import MIDIMessageTypes from "./MIDIMessageTypes";

class MIDIElement {
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

  #getNoteName(noteNumber) {
    const noteNames = "C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|");
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteIndex = noteNumber % 12;
    const noteName = noteNames[noteIndex];
    return `${noteName}${octave}`;
  }
}

export default MIDIElement;
