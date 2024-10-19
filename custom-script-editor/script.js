"use strict";

let deviceDetail = {};
let selectedKey = 0;

const midi = new MIDIScriptManager({
  onMessage: (status, channel, data1, data2) => {
    showDetails(status, channel, data1, data2);
  },
});

window.addEventListener("load", async () => {
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
    const device = await midi.requestAccess();

    deviceDetail.device(`${device.name} (${device.manufacturer})`);
  } catch (error) {
    alert(error);
    return;
  }

  // KeyMap作成＆keys配列初期化
  const keymapElem = document.querySelector("#keymap");
  for (let i = 0; i <= 0x7f; i++) {
    const keyInfo = midi.getKeyInfo(i);

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

  // イベントリスナー登録
  document
    .querySelector("#detail input[data-field=keyName]")
    .addEventListener("input", (e) => {
      const detail = midi.setKeyName(selectedKey, e.target.value);
      updateDetail(detail);
    });
  document
    .querySelector("#detail input[data-field=scriptName]")
    .addEventListener("input", (e) => {
      const detail = midi.setScriptName(selectedKey, e.target.value);
      updateDetail(detail);
    });
  document
    .querySelector("#detail textarea[data-field=script]")
    .addEventListener("input", (e) => {
      const detail = midi.setScript(selectedKey, e.target.value);
      updateDetail(detail);
    });

  function updateDetail(detail) {
    const keyBtn = document.querySelectorAll("#keymap > button")[selectedKey];
    keyBtn.querySelector(".keyname").innerText = detail.name;
    keyBtn.querySelector(".confname").innerText = detail.scriptName || "----";
    if (detail.script) {
      document.querySelector(
        "#detail [data-field=scriptName]"
      ).disabled = false;
    } else {
      document.querySelector("#detail [data-field=scriptName]").value = "";
      document.querySelector("#detail [data-field=scriptName]").disabled = true;
    }
  }
});

function showDetails(status, channel, number, value = null) {
  const keyBtns = document.querySelectorAll("#keymap > button");
  keyBtns[selectedKey].classList.remove("active");
  selectedKey = number;
  keyBtns[selectedKey].disabled = false;
  keyBtns[selectedKey].classList.add("active");

  keyBtns[selectedKey].style.background = `#ff8800${(value * 2)
    .toString(16)
    .padStart(2, "0")}`;

  const keyInfo = midi.getKeyInfo(selectedKey);
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