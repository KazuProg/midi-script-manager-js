"use strict";

const MIDIMessageType = MIDIScriptManager.MessageTypes;
let midi;

const PageElements = {
  detail: {},
  keyMap: [],
  init() {
    document.querySelectorAll("#detail [data-field]").forEach((elem) => {
      const property = elem.getAttribute("data-field");
      this.detail[property] = elem;
    });

    // KeyMap作成
    const keyMapsContainer = document.querySelector("#keymap");
    for (let i = 0; i <= 0x7f; i++) {
      let btn = document.createElement("button");
      btn.innerHTML =
        `<span class="key-name"></span>` +
        `<hr />` +
        `<span class="script-name"></span>`;
      btn.disabled = true;
      btn.onclick = (e) => {
        if (!e.target.disabled) {
          Page.selectedMIDIElement = Page.device.getKeyMap(Page.messageType)[i];
        }
      };
      keyMapsContainer.appendChild(btn);
      this.keyMap.push(btn);
    }
  },
};

const Page = {
  _device: null,
  _messageType: MIDIMessageType.ControlChange,
  _selectedMIDIElement: null,
  get device() {
    return this._device;
  },
  get messageType() {
    return this._messageType;
  },
  get selectedMIDIElement() {
    return this._selectedMIDIElement;
  },
  set device(device) {
    if (this._device === device) {
      return;
    }

    this._device = device;
    const value = JSON.stringify([device.name, device.manufacturer]);

    const deviceElem = PageElements.detail.device;
    const options = Array.from(deviceElem.options);
    const exists = options.some((option) => option.value === value);
    if (!exists) {
      const option = document.createElement("option");
      option.value = value;
      option.innerText = `[${device.manufacturer}] ${device.name}`;
      deviceElem.appendChild(option);
    }

    deviceElem.value = value;
    const keyMap = device.getKeyMap(this.messageType);
    for (let i = 0; i <= 0x7f; i++) {
      Page._updateButton(keyMap[i]);
    }
  },
  set messageType(value) {
    this._messageType = value;
    switch (this._messageType) {
      case MIDIMessageType.NoteOff:
      case MIDIMessageType.NoteOn:
        document.querySelector("#keymap-title").innerText = "NoteOn/Off";
        break;
      case MIDIMessageType.ControlChange:
        document.querySelector("#keymap-title").innerText = "ControlChange";
        break;
    }

    const keyMap = this._device.getKeyMap(this.messageType);
    for (let i = 0; i <= 0x7f; i++) {
      Page._updateButton(keyMap[i]);
    }
  },
  set selectedMIDIElement(midiElement) {
    if (this._selectedMIDIElement === midiElement) return;
    if (Page.selectedMIDIElement !== null) {
      PageElements.keyMap[Page.selectedMIDIElement.midiNumber].classList.remove(
        "selected"
      );
    }
    this._selectedMIDIElement = midiElement;

    const detailElem = PageElements.detail;
    detailElem.message.innerText = "";
    detailElem.channel.innerText = "";
    detailElem.data2.innerText = "";

    Page.updateDetail(midiElement);
  },
  updateDetail(midiElement) {
    const detailElem = PageElements.detail;
    detailElem.data1.innerText =
      "0x" + hex(Page.selectedMIDIElement.midiNumber);
    detailElem.keyName.value = midiElement.name;
    detailElem.scriptName.value = midiElement.scriptName || "";
    detailElem.script.value = midiElement.scriptCode || "";

    detailElem.keyName.disabled = false;
    detailElem.scriptName.disabled = midiElement.scriptCode === null;
    detailElem.script.disabled = false;

    Page._updateButton(midiElement);
    const btn = PageElements.keyMap[Page.selectedMIDIElement.midiNumber];
    btn.classList.add("selected");
  },
  _updateButton(midiElement) {
    const btn = PageElements.keyMap[midiElement.midiNumber];
    btn.disabled = !midiElement.isAvailable;
    btn.querySelector(".key-name").innerText = midiElement.name;

    btn.querySelector(".script-name").innerText =
      midiElement.scriptCode === null
        ? "----"
        : midiElement.scriptName || "\u00A0";
  },
  showMessageDetail(midiElement, status, channel, data1, data2) {
    Page.selectedMIDIElement = midiElement;

    const btn = PageElements.keyMap[Page.selectedMIDIElement.midiNumber];
    btn.disabled = false;
    btn.style.background = `#ff8800${hex(data2 * 2)}`;

    const detailElem = PageElements.detail;
    detailElem.message.innerText =
      status != null ? `0x${hex(status)} (${getKeyByStatus(status)})` : "";
    detailElem.channel.innerText = channel != null ? "0x" + hex(channel) : "";
    detailElem.data2.innerText = data2 != null ? "0x" + hex(data2) : "";
  },
};

window.addEventListener("load", async () => {
  // 画面初期化
  PageElements.init();

  midi = new MIDIScriptManager({
    onMessage: (midiElement, midiData) => {
      Page.device = midiElement.device;
      Page.messageType = midiData.messageType;
      Page.showMessageDetail(
        midiElement,
        midiData.messageType,
        midiData.channel,
        midiData.data1,
        midiData.data2
      );
    },
    onDeviceChange: (device) => {
      Page.device = device;
    },
  });

  const devices = midi.devices;
  for (const device of devices) {
    Page.device = device;
  }
  // Select the first one
  if (devices.length !== 0) Page.device = devices[0];

  try {
    await midi.requestAccess();
  } catch (error) {
    alert(error);
    return;
  }

  // イベントリスナー登録
  document
    .querySelector("#detail select[data-field=device]")
    .addEventListener("change", (e) => {
      const [deviceName, deviceManufacturer] = JSON.parse(e.target.value);
      Page.device = midi.findDevice(deviceName, deviceManufacturer);
    });
  document
    .querySelector("#detail input[data-field=keyName]")
    .addEventListener("input", (e) => {
      Page.selectedMIDIElement.name = e.target.value;
      Page.updateDetail(Page.selectedMIDIElement);
    });
  document
    .querySelector("#detail input[data-field=scriptName]")
    .addEventListener("input", (e) => {
      Page.selectedMIDIElement.scriptName = e.target.value;
      Page.updateDetail(Page.selectedMIDIElement);
    });
  document
    .querySelector("#detail textarea[data-field=script]")
    .addEventListener("input", (e) => {
      Page.selectedMIDIElement.scriptCode = e.target.value;
      Page.updateDetail(Page.selectedMIDIElement);
    });
});

function getKeyByStatus(status) {
  return (
    Object.keys(MIDIMessageType).find(
      (key) => MIDIMessageType[key] === status
    ) || null
  );
}

/**
 * Common functions
 */
function hex(val, len = 2) {
  return val.toString(16).toUpperCase().padStart(len, "0");
}
