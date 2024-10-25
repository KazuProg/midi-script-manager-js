"use strict";

let currentDevice = null;
let currentMessageType = MIDIMessageType.ControlChange;

let midi;

const UI = {
  details: {},
  keyMaps: [],
  init() {
    document.querySelectorAll("[data-field]").forEach((el) => {
      const property = el.getAttribute("data-field");
      const tagName = el.tagName.toLowerCase();
      const isEditableElement = tagName === "input" || tagName === "textarea";
      Object.defineProperty(this.details, property, {
        set(value) {
          if (isEditableElement) {
            el.value = value;
          } else {
            el.innerText = value;
          }
        },
        configurable: true,
        enumerable: true,
      });
      if (isEditableElement) {
        Object.defineProperty(this.details, `${property}Disabled`, {
          set(value) {
            el.disabled = value;
          },
          configurable: true,
          enumerable: true,
        });
      }
    });

    //keyMapButtons
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
          showDetails(null, null, i);
        }
      };
      keyMapsContainer.appendChild(btn);
      this.keyMaps.push({
        _button: btn,
        set keyName(value) {
          btn.querySelector(".key-name").innerText = value;
        },
        set scriptName(value) {
          btn.querySelector(".script-name").innerText = value;
        },
        set disabled(value) {
          btn.disabled = value;
        },
      });
    }

    this.keyMap.selectedKey = 0;
  },
  keyMap: {
    _selectedKey: 0,
    get selectedKey() {
      return this._selectedKey;
    },
    set selectedKey(value) {
      UI.keyMaps[this._selectedKey]._button.classList.remove("selected");
      UI.keyMaps[value]._button.classList.add("selected");
      this._selectedKey = value;
    },
    set selectedValue(value) {
      const target = UI.keyMaps[this._selectedKey]._button;
      target.style.background = `#ff8800${(value * 2)
        .toString(16)
        .padStart(2, "0")}`;
    },
  },
};

window.addEventListener("load", async () => {
  // 画面初期化
  UI.init();

  midi = new MIDIScriptManager({
    onMessage: (device, messageType, channel, data1, data2) => {
      currentMessageType = messageType;
      showDevice(device);
      UI.keyMaps[data1].disabled = false;
      showDetails(messageType, channel, data1, data2);
    },
    onDeviceChange: (device) => {
      showDevice(device);
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
        currentDevice,
        currentMessageType,
        UI.keyMap.selectedKey,
        e.target.value
      );
      updateDetail(detail);
    });
  document
    .querySelector("#detail input[data-field=scriptName]")
    .addEventListener("input", (e) => {
      const detail = midi.setScriptName(
        currentDevice,
        currentMessageType,
        UI.keyMap.selectedKey,
        e.target.value
      );
      updateDetail(detail);
    });
  document
    .querySelector("#detail textarea[data-field=script]")
    .addEventListener("input", (e) => {
      const detail = midi.setScript(
        currentDevice,
        currentMessageType,
        UI.keyMap.selectedKey,
        e.target.value
      );
      updateDetail(detail);
    });

  function updateDetail(detail) {
    UI.keyMaps[UI.keyMap.selectedKey].keyName = detail.keyName;
    UI.keyMaps[UI.keyMap.selectedKey].scriptName = "----";
    if (detail.script) {
      UI.keyMaps[UI.keyMap.selectedKey].scriptName = detail.scriptName;
      UI.details.scriptNameDisabled = false;
    } else {
      UI.details.scriptName = "";
      UI.details.scriptNameDisabled = true;
    }
  }
});

function showDevice(device) {
  currentDevice = device;

  UI.details.device = device ? `${device.name} (${device.manufacturer})` : "";

  for (let i = 0; i <= 0x7f; i++) {
    const keyInfo = midi.getKeyInfo(currentDevice, currentMessageType, i);
    UI.keyMaps[i].disabled = !keyInfo.enabled;
    UI.keyMaps[i].keyName = keyInfo.keyName;
    UI.keyMaps[i].scriptName = keyInfo.scriptName || "----";
  }
}

function showDetails(status, channel, number, value = null) {
  UI.keyMap.selectedKey = number;
  UI.keyMap.selectedValue = value;

  const keyInfo = midi.getKeyInfo(
    currentDevice,
    currentMessageType,
    UI.keyMap.selectedKey
  );

  UI.details.message =
    status != null ? `0x${hex(status)} (${getKeyByStatus(status)})` : "";
  UI.details.channel = channel != null ? "0x" + hex(channel) : "";
  UI.details.data1 = number != null ? "0x" + hex(number) : "";
  UI.details.data2 = value != null ? "0x" + hex(value) : "";
  UI.details.keyName = keyInfo.keyName;
  UI.details.script = keyInfo.script;
  UI.details.scriptName = keyInfo.scriptName;

  UI.details.keyNameDisabled = false;
  UI.details.scriptDisabled = false;
  if (keyInfo.script) {
    UI.details.scriptNameDisabled = false;
  } else {
    UI.details.scriptNameDisabled = true;
  }
}

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
