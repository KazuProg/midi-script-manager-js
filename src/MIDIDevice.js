import MIDIElement from "./MIDIElement";
import MIDIMessageTypes from "./MIDIMessageTypes";

class MIDIDevice {
  #input;
  #serviceName;
  #saveCallback;
  #noteElements = [];
  #ccElements = [];
  #options = {};

  constructor(MIDIInput, serviceName, saveCallback, options = {}) {
    this.#input = MIDIInput;
    this.#input.onmidimessage = this.#onMIDIMessage.bind(this);

    this.#serviceName = serviceName;
    this.#saveCallback = saveCallback;

    this.#options = {
      executeScript: false,
      onMessage: null,
      data: null,
      ...options,
    };
    if (this.#options.data) {
      this.applyMappings(this.#options.data.mappings);
    }
  }

  applyMappings(mappings) {
    if (!mappings) {
      return;
    }
    for (const mapping of mappings) {
      const midiData = parseInt(mapping.midi, 16);
      const element = new MIDIElement(
        this,
        (midiData & 0xff00) >> 8,
        midiData & 0x00ff,
        this.#save.bind(this),
        mapping
      );
      if (
        element.messageType === MIDIMessageTypes.NoteOn ||
        element.messageType === MIDIMessageTypes.NoteOff
      ) {
        if (!this.#noteElements[element.channel]) {
          this.#noteElements[element.channel] = [];
        }
        this.#noteElements[element.channel][element.number] = element;
      } else if (element.messageType === MIDIMessageTypes.ControlChange) {
        if (!this.#ccElements[element.channel]) {
          this.#ccElements[element.channel] = [];
        }
        this.#ccElements[element.channel][element.number] = element;
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
    return this.#noteElements;
  }

  get ccElements() {
    return this.#ccElements;
  }

  get elements() {
    return [...this.#noteElements.flat(), ...this.#ccElements.flat()];
  }

  findElementById(id) {
    return this.elements.find((elem) => elem.midiID === id);
  }

  #onMIDIMessage(midiMessage) {
    const [status, data1, data2] = midiMessage.data;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    let elements = null;
    switch (messageType) {
      case MIDIMessageTypes.NoteOn:
      case MIDIMessageTypes.NoteOff:
        elements = this.#noteElements;
        break;

      case MIDIMessageTypes.ControlChange:
        elements = this.#ccElements;
        break;

      default:
        return;
    }

    if (!elements[channel]) {
      elements[channel] = [];
    }
    if (!elements[channel][data1]) {
      elements[channel][data1] = new MIDIElement(
        this,
        status,
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
        messageType,
        channel,
      };
      this.#options.onMessage(this, element, midiData);
    }

    if (this.#options.executeScript) {
      element.executeScript({
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
      mappings: [
        ...this.#noteElements.flat().map((elem) => elem.toJSON()),
        ...this.#ccElements.flat().map((elem) => elem.toJSON()),
      ],
    };
    return result;
  }
}

export default MIDIDevice;
