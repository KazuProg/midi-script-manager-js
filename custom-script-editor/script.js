"use strict";

let deviceDetail = {};
let selectedKey = 0;
let currentDevice = null;
let currentMessageType = MIDIMessageType.ControlChange;

let midi;

window.addEventListener("load", async () => {
  midi = new MIDIScriptManager({
    onMessage: (device, messageType, channel, data1, data2) => {
      currentMessageType = messageType;
      showDevice(device);
      showDetails(messageType, channel, data1, data2);
    },
    onDeviceChange: (device) => {
      showDevice(device);
    },
  });

  // デバイス情報表示を簡略化するオブジェクト作成
  document.querySelectorAll("[data-field]").forEach((el) => {
    const property = el.getAttribute("data-field");
    deviceDetail[property] = (value) => {
      if (
        el.tagName.toLowerCase() === "input" ||
        el.tagName.toLowerCase() === "textarea"
      ) {
        el.value = value;
      } else {
        el.innerText = value;
      }
    };
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
        selectedKey,
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
        selectedKey,
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
        selectedKey,
        e.target.value
      );
      updateDetail(detail);
    });

  function updateDetail(detail) {
    const keyBtn = document.querySelectorAll("#keymap > button")[selectedKey];
    keyBtn.querySelector(".keyname").innerText = detail.keyName;
    keyBtn.querySelector(".confname").innerText = "----";
    if (detail.script) {
      keyBtn.querySelector(".confname").innerText = detail.scriptName;
      document.querySelector(
        "#detail [data-field=scriptName]"
      ).disabled = false;
    } else {
      document.querySelector("#detail [data-field=scriptName]").value = "";
      document.querySelector("#detail [data-field=scriptName]").disabled = true;
    }
  }
});

function showDevice(device) {
  currentDevice = device;

  deviceDetail.device(device ? `${device.name} (${device.manufacturer})` : "");

  // KeyMap作成＆keys配列初期化
  const keymapElem = document.querySelector("#keymap");
  keymapElem.innerHTML = "";
  for (let i = 0; i <= 0x7f; i++) {
    const keyInfo = midi.getKeyInfo(currentDevice, currentMessageType, i);

    let btn = document.createElement("button");
    btn.innerHTML =
      `<span class="keyname">${keyInfo.keyName}</span>` +
      `<hr />` +
      `<span class="confname">${keyInfo.scriptName || "----"}</span>`;
    btn.disabled = !keyInfo.enabled;
    btn.onclick = (e) => {
      if (!e.target.disabled) {
        showDetails(null, null, i);
      }
    };
    keymapElem.appendChild(btn);
  }
}

function showDetails(status, channel, number, value = null) {
  const keyBtns = document.querySelectorAll("#keymap > button");
  keyBtns[selectedKey].classList.remove("active");
  selectedKey = number;
  keyBtns[selectedKey].disabled = false;
  keyBtns[selectedKey].classList.add("active");

  keyBtns[selectedKey].style.background = `#ff8800${(value * 2)
    .toString(16)
    .padStart(2, "0")}`;

  const keyInfo = midi.getKeyInfo(
    currentDevice,
    currentMessageType,
    selectedKey
  );
  deviceDetail.message(
    status != null ? `0x${hex(status)} (${getKeyByStatus(status)})` : ""
  );
  deviceDetail.channel(channel != null ? "0x" + hex(channel) : "");
  deviceDetail.data1(number != null ? "0x" + hex(number) : "");
  deviceDetail.data2(value != null ? "0x" + hex(value) : "");
  deviceDetail.keyName(keyInfo.keyName);
  deviceDetail.script(keyInfo.script);
  deviceDetail.scriptName(keyInfo.scriptName);

  document.querySelector("#detail [data-field=keyName]").disabled = false;
  document.querySelector("#detail [data-field=script]").disabled = false;
  if (keyInfo.script) {
    document.querySelector("#detail [data-field=scriptName]").disabled = false;
  } else {
    document.querySelector("#detail [data-field=scriptName]").disabled = true;
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
