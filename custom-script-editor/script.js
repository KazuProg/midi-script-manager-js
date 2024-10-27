"use strict";

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
          Page.selectedKey = i;
        }
      };
      keyMapsContainer.appendChild(btn);
      this.keyMap.push(btn);
    }
  },
};

const Page = {
  _device: { name: null, manufacturer: null },
  _messageType: MIDIMessageType.ControlChange,
  _selectedKey: null,
  get device() {
    return this._device;
  },
  get messageType() {
    return this._messageType;
  },
  get selectedKey() {
    return this._selectedKey;
  },
  set device(value) {
    if (
      this._device.name === value.name &&
      this._device.manufacturer === value.manufacturer
    ) {
      return;
    }

    this._device = value;

    PageElements.detail.device.innerText = `${this.device.name} (${this.device.manufacturer})`;

    for (let i = 0; i <= 0x7f; i++) {
      const keyInfo = midi.getKeyInfo(this.device, this.messageType, i);
      Page._updateButton(keyInfo);
    }
  },
  set messageType(value) {
    this._messageType = value;
    //表示処理
  },
  set selectedKey(value) {
    if (this._selectedKey === value) return;
    if (Page.selectedKey !== null) {
      PageElements.keyMap[Page.selectedKey].classList.remove("selected");
    }
    this._selectedKey = value;

    const detailElem = PageElements.detail;
    detailElem.message.innerText = "";
    detailElem.channel.innerText = "";
    detailElem.data2.innerText = "";

    const keyInfo = midi.getKeyInfo(
      Page.device,
      Page.messageType,
      Page.selectedKey
    );
    Page.updateDetail(keyInfo);
  },
  updateDetail(keyInfo) {
    const detailElem = PageElements.detail;
    detailElem.data1.innerText = "0x" + hex(Page.selectedKey);
    detailElem.keyName.value = keyInfo.keyName;
    detailElem.scriptName.value = keyInfo.scriptName || "";
    detailElem.script.value = keyInfo.script || "";

    detailElem.keyName.disabled = false;
    detailElem.scriptName.disabled = !keyInfo.script; //TODO
    detailElem.script.disabled = false;

    Page._updateButton(keyInfo);
    const btn = PageElements.keyMap[Page.selectedKey];
    btn.classList.add("selected");
  },
  _updateButton(detail) {
    const btn = PageElements.keyMap[detail.key];
    btn.disabled = !detail.enabled;
    btn.querySelector(".key-name").innerText = detail.keyName;

    btn.querySelector(".script-name").innerText =
      detail.script === null ? "----" : detail.scriptName || "\u00A0";
  },
  showMessageDetail(status, channel, data1, data2) {
    Page.selectedKey = data1;

    const btn = PageElements.keyMap[Page.selectedKey];
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
    onMessage: (device, messageType, channel, data1, data2) => {
      Page.device = device;
      Page.messageType = messageType;
      Page.showMessageDetail(messageType, channel, data1, data2);
    },
    onDeviceChange: (device) => {
      Page.device = device;
    },
  });

  try {
    await midi.requestAccess();
  } catch (error) {
    alert(error);
    return;
  }

  // イベントリスナー登録
  document
    .querySelector("#detail input[data-field=keyName]")
    .addEventListener("input", (e) => {
      const detail = midi.setKeyName(
        Page.device,
        Page.messageType,
        Page.selectedKey,
        e.target.value
      );
      Page.updateDetail(detail);
    });
  document
    .querySelector("#detail input[data-field=scriptName]")
    .addEventListener("input", (e) => {
      const detail = midi.setScriptName(
        Page.device,
        Page.messageType,
        Page.selectedKey,
        e.target.value
      );
      Page.updateDetail(detail);
    });
  document
    .querySelector("#detail textarea[data-field=script]")
    .addEventListener("input", (e) => {
      const detail = midi.setScript(
        Page.device,
        Page.messageType,
        Page.selectedKey,
        e.target.value
      );
      Page.updateDetail(detail);
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
