import MIDIElement from "./MIDIElement";
import MIDIMessageTypes from "./MIDIMessageTypes";

class MIDIDevice {
  #input;
  #output;
  #serviceName;
  #saveCallback;
  #options;
  #elements;

  constructor(midiInput, serviceName, saveCallback, options = {}) {
    if (!(midiInput instanceof MIDIInput)) {
      throw new TypeError("Expected a MIDIInput object");
    }
    this.#input = midiInput;
    this.#input.onmidimessage = this.#onMIDIMessage.bind(this);

    this.#serviceName = serviceName;
    this.#saveCallback = saveCallback;

    this.#options = {
      executeScript: false,
      onMessage: null,
      data: null,
      midiAccess: null,
      ...options,
    };

    this.#elements = {
      [MIDIMessageTypes.Note]: Array.from({ length: 16 }, () => []),
      [MIDIMessageTypes.CC]: Array.from({ length: 16 }, () => []),
    };

    if (this.#options.data) {
      this.applyMappings(this.#options.data.mappings);
    }

    if (this.#options.midiAccess) {
      this.#options.midiAccess.outputs.forEach((output) => {
        if (
          output.name === this.name &&
          output.manufacturer === this.manufacturer
        ) {
          this.#output = output;
        }
      });
    }
  }

  applyMappings(mappings) {
    if (!mappings) {
      return;
    }
    for (const mapping of mappings) {
      const type = mapping.midi.substr(0, 1);
      const channel = parseInt(mapping.midi.substr(1, 1), 16);
      const number = parseInt(mapping.midi.substr(2, 2), 16);

      const element = new MIDIElement(
        this,
        type,
        channel,
        number,
        this.#save.bind(this),
        mapping
      );

      if (type in this.#elements) {
        this.#elements[type][channel][number] = element;
      }
    }
  }

  get name() {
    return this.#input.name;
  }

  get manufacturer() {
    return this.#input.manufacturer;
  }

  get serviceName() {
    return this.#serviceName;
  }

  get noteElements() {
    return this.#elements[MIDIMessageTypes.Note];
  }

  get ccElements() {
    return this.#elements[MIDIMessageTypes.CC];
  }

  get elements() {
    return [...this.noteElements.flat(), ...this.ccElements.flat()];
  }

  findElementById(id) {
    return this.elements.find((elem) => elem.midiID === id);
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    let type;
    switch (messageType) {
      case MIDIMessageTypes.RawNoteOn:
      case MIDIMessageTypes.RawNoteOff:
        type = MIDIMessageTypes.Note;
        break;
      case MIDIMessageTypes.RawControlChange:
        type = MIDIMessageTypes.CC;
        break;
      default:
        return;
    }

    const elements = this.#elements[type];
    if (!elements[channel][data1]) {
      elements[channel][data1] = new MIDIElement(
        this,
        type,
        channel,
        data1,
        this.#save.bind(this)
      );
      this.#save();
    }

    const element = elements[channel][data1];

    if (this.#options.onMessage) {
      const midiData = {
        raw: midiMessage.data,
        status,
        data1,
        data2,
        type,
        channel,
      };
      this.#options.onMessage(this, element, midiData);
    }

    if (this.#options.executeScript) {
      const output = (val) => {
        if (this.#output) {
          this.#output.send([status, data1, val]);
        }
      };
      element.executeScript({
        status,
        data1,
        data2,
        type,
        channel,
        number: data1,
        value: data2,
        val: data2 / 127,
        output,
      });
    }
  }

  #save() {
    this.#saveCallback(this);
  }

  toJSON() {
    let result = {
      device: {
        name: this.name,
        manufacturer: this.manufacturer,
      },
      service: this.#serviceName,
      mappings: this.elements.map((elem) => elem.toJSON()),
    };
    return result;
  }
}

export default MIDIDevice;
