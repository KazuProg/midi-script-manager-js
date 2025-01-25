"use strict";

const MIDIMessageType = MIDIScriptManager.MessageTypes;
let midi;
let currentDevice = null;
let latestElement = null;

document.addEventListener("receivedScriptTemplate", (e) => {
  ScriptEditor.setTemplates(e.detail);
});

window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);
  let serviceName = params.get("service");
  if (serviceName === null) {
    alert("WARNING: Service name is not specified.");
    serviceName = "ScriptEditor";
  }
  document.querySelector("#service-name").innerText = serviceName;
  midi = new MIDIScriptManager(serviceName, {
    onMessage: (device, element, midiData) => {
      latestElement = element;
      updateKeymaps(device);
      highlightKeymap(element);
      if (ScriptEditor.currentMIDIElement === element) {
        ScriptEditor.UIElements.controlValue.innerText = midiData.data2;
      }
    },
    onDeviceChange: (device) => {
      updateKeymaps(device);
    },
  });

  try {
    await midi.requestAccess();
  } catch (error) {
    alert(error);
    throw error;
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ScriptEditor.close();
    }
    if (e.key === "F2") {
      if (ScriptEditor.currentMIDIElement === null) {
        ScriptEditor.show(latestElement);
      }
    }
  });

  ScriptEditor.init();
});

function updateKeymaps(device) {
  currentDevice = device;
  document.querySelector(
    "#device-name"
  ).innerText = `${device.manufacturer} ${device.name}`;
  const tableElem = document.querySelector("tbody#keymap-list");
  tableElem.innerHTML = "";
  for (const keymap of device.elements) {
    const tr = document.createElement("tr");
    tr.id = "midi-" + keymap.midiID;
    tr.innerHTML = `
          <td>${controlName(keymap)}</td>
          <td>${keymap.name}</td>
          <td>${keymap.scriptName || ""}</td>
        `;
    tr.addEventListener("click", (e) => {
      const midiID = tr.id.substr(5);
      const elem = currentDevice.findElementById(midiID);
      ScriptEditor.show(elem);
    });
    tableElem.appendChild(tr);
  }
}

function controlName(keymap) {
  let type = "";
  switch (keymap.type) {
    case MIDIMessageType.Note:
      type = "Note";
      break;
    case MIDIMessageType.CC:
      type = "CC";
      break;
  }
  return `${type}#${keymap.channel.toString(16).toUpperCase()} ${
    keymap.defaultName
  }`;
}

function highlightKeymap(element) {
  const tr = document.querySelector(`#midi-${element.midiID}`);
  tr.scrollIntoView({
    behavior: "smooth", // スムーズにスクロール
    block: "center", // 垂直方向で中心に配置
    inline: "nearest", // 水平方向は変更しない
  });
  tr.classList.add("highlight");
  setTimeout(() => tr.classList.remove("highlight"), 1000);
}

function importKeymap() {
  FileHandler.readJson().then((data) => {
    try {
      midi.importKeymapObject(data.content);
      updateKeymaps(currentDevice);
    } catch (error) {
      alert(error.message);
    }
  });
}

function exportKeymap() {
  FileHandler.downloadJson(
    `${currentDevice.serviceName}_${currentDevice.manufacturer} ${currentDevice.name}.json`,
    currentDevice.toJSON(),
    true
  );
}

/**
 * Common functions
 */
function hex(val, len = 2) {
  return val.toString(16).toUpperCase().padStart(len, "0");
}
