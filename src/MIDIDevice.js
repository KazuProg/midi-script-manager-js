import MIDIElement from "./MIDIElement";
import MIDIMessageTypes from "./MIDIMessageTypes";

class MIDIDevice {
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
        new MIDIElement(
          this,
          MIDIMessageTypes.NoteOn,
          index,
          this.#saveCallback
        )
    );
    this.#ccKeyMap = Array.from(
      { length: 0x80 },
      (_, index) =>
        new MIDIElement(
          this,
          MIDIMessageTypes.ControlChange,
          index,
          this.#saveCallback
        )
    );

    if (keymaps) {
      for (const idx in keymaps.note) {
        if (keymaps.note[idx]) {
          this.#noteKeyMap[idx] = new MIDIElement(
            this,
            MIDIMessageTypes.NoteOn,
            idx,
            this.#saveCallback,
            keymaps.note[idx]
          );
        }
      }
      for (const idx in keymaps.cc) {
        if (keymaps.cc[idx]) {
          this.#ccKeyMap[idx] = new MIDIElement(
            this,
            MIDIMessageTypes.ControlChange,
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
      case MIDIMessageTypes.NoteOff:
      case MIDIMessageTypes.NoteOn:
        return this.#noteKeyMap;
      case MIDIMessageTypes.ControlChange:
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

export default MIDIDevice;
