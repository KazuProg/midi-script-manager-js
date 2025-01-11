"use strict";

const MIDIMessageType = MIDIScriptManager.MessageTypes;
let midi;
let currentDevice = null;
let latestElement = null;
let currentElement = null;
let isChanged = false;
let isClickEditor = false;

window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);
  let serviceName = params.get("service");
  if (serviceName === null) {
    alert("WARNING: Service name is not specified.");
    serviceName = "ScriptEditor";
  }
  midi = new MIDIScriptManager(serviceName, {
    onMessage: (device, element, midiData) => {
      latestElement = element;
      updateKeymaps(device);
      highlightKeymap(element);
      if (currentElement === element) {
        document.querySelector("#script-editor .control-value").innerText =
          midiData.data2;
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
      closeEditor();
    }
    if (e.key === "F2") {
      if (currentElement === null) {
        editElement(latestElement);
      }
    }
  });

  document.querySelector("#script-editor").addEventListener("click", () => {
    if (!isClickEditor) {
      closeEditor();
    }
  });
  document
    .querySelector("#script-editor .container")
    .addEventListener("click", () => {
      isClickEditor = true;
      setTimeout(() => {
        isClickEditor = false;
      }, 10);
    });
  document
    .querySelector("#script-editor [data-field=name]")
    .addEventListener("input", onChange);
  document
    .querySelector("#script-editor [data-field=scriptName]")
    .addEventListener("input", onChange);
  document
    .querySelector("#script-editor [data-field=script]")
    .addEventListener("input", onChange);

  function onChange() {
    isChanged = true;
  }
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
      editElement(elem);
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

function editElement(element) {
  currentElement = element;
  const editorElem = document.querySelector("#script-editor");
  editorElem.querySelector(".control-name").innerText = controlName(element);
  editorElem.querySelector("[data-field=name]").value = element.name;
  editorElem.querySelector(".control-value").innerText = "";
  editorElem.querySelector("[data-field=scriptName]").value =
    element.scriptName;
  editorElem.querySelector("[data-field=script]").value = element.scriptCode;
  isChanged = false;
  editorElem.classList.remove("hidden");
  editorElem.querySelector("[data-field=name]").focus();
}

function saveElementDetails() {
  const editorElem = document.querySelector("#script-editor");

  currentElement.name = editorElem.querySelector("[data-field=name]").value;
  currentElement.scriptName = editorElem.querySelector(
    "[data-field=scriptName]"
  ).value;
  currentElement.scriptCode = editorElem.querySelector(
    "[data-field=script]"
  ).value;
  isChanged = false;
  updateKeymaps(currentDevice);
  closeEditor();
}

function discardElementDetails() {
  isChanged = false;
  closeEditor();
}

function closeEditor() {
  if (currentElement) {
    if (!isChanged || confirm("変更を保存せずに閉じますか？")) {
      currentElement = null;
      document.querySelector("#script-editor").classList.add("hidden");
    }
  }
}

function importKeymap() {
  FileHandler.readJson().then((data) => {
    midi.importKeymapObject(data);
    updateKeymaps(currentDevice);
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
