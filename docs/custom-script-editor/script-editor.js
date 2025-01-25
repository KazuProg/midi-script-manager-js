class _ScriptEditor {
  #UIElements;
  #MIDIElement = null;
  #defaultPlaceholder = "Enter script here...";
  #isChanged = false;
  #isClickEditor = false;
  #templates = [];

  init() {
    const rootElem = document.querySelector("#script-editor");
    const e = {
      overlay: rootElem,
      popup: rootElem.querySelector(".container"),
      controlName: rootElem.querySelector(".control-name"),
      name: rootElem.querySelector("[data-field=name]"),
      controlValue: rootElem.querySelector(".control-value"),
      scriptName: rootElem.querySelector("[data-field=scriptName]"),
      scriptCode: rootElem.querySelector("[data-field=script]"),
    };

    e.overlay.addEventListener("click", this.#onOverlayClick.bind(this));
    e.popup.addEventListener("click", this.#onPopupClick.bind(this));
    e.name.addEventListener("input", this.#onNameChange.bind(this));
    e.scriptName.addEventListener("focus", this.#onScriptNameFocus.bind(this));
    e.scriptName.addEventListener("input", this.#onScriptNameChange.bind(this));
    e.scriptCode.addEventListener("focus", this.#onScriptCodeFocus.bind(this));
    e.scriptCode.addEventListener("input", this.#onScriptCodeChange.bind(this));

    this.#UIElements = e;
  }

  setTemplates(templates) {
    if (templates) {
      this.#templates = templates;
      const listParent = document.querySelector("#script-template");
      for (const template of this.#templates) {
        const option = document.createElement("option");
        option.value = template.name;
        listParent.appendChild(option);
      }
    }
  }

  get UIElements() {
    return this.#UIElements;
  }

  get currentMIDIElement() {
    return this.#MIDIElement;
  }

  #onOverlayClick() {
    if (!this.#isClickEditor) {
      this.close();
    }
  }

  #onPopupClick() {
    this.#isClickEditor = true;
    setTimeout(() => {
      this.#isClickEditor = false;
    }, 10);
  }

  #onNameChange() {
    this.#isChanged = true;
  }

  #onScriptNameFocus() {
    // スクリプトが入力されていたら候補を表示しない
    if (this.#UIElements.scriptCode.value !== "") {
      return;
    }

    const currentValue = this.UIElements.scriptName.value;
    this.UIElements.scriptName.value = "";
    setTimeout(() => {
      this.UIElements.scriptName.value = currentValue;
    }, 10);
  }

  #onScriptNameChange() {
    this.#isChanged = true;
    const scriptName = this.#UIElements.scriptName.value;
    const template = this.#templates.find((t) => t.name === scriptName);

    this.#UIElements.scriptCode.placeholder = template
      ? template.code
      : this.#defaultPlaceholder;

    this.#onScriptCodeChange();
  }

  #onScriptCodeChange() {
    this.#isChanged = true;
    if (this.#UIElements.scriptCode.value === "") {
      this.#UIElements.scriptName.setAttribute("list", "script-template");
    } else {
      this.#UIElements.scriptName.removeAttribute("list", "script-template");
    }
  }

  #onScriptCodeFocus() {
    const elem = this.#UIElements.scriptCode;
    if (elem.value === "" && elem.placeholder !== this.#defaultPlaceholder) {
      elem.value = elem.placeholder;
      this.#onScriptCodeChange();
    }
  }

  show(element) {
    this.#MIDIElement = element;
    this.#UIElements.controlName.innerText = controlName(element);
    this.#UIElements.name.value = element.name;
    this.#UIElements.controlValue.innerText = "";
    this.#UIElements.scriptName.value = element.scriptName;
    this.#UIElements.scriptCode.value = element.scriptCode;
    this.#UIElements.scriptCode.placeholder = this.#defaultPlaceholder;
    this.#isChanged = false;
    this.#UIElements.overlay.classList.remove("hidden");
    this.#UIElements.name.focus();
    this.#onScriptNameChange();
    // this.#onScriptCodeChange(); // this.#onScriptNameChangeで呼ばれる
  }

  saveAndClose() {
    this.#MIDIElement.name = this.#UIElements.name.value;
    this.#MIDIElement.scriptName = this.#UIElements.scriptName.value;
    if (
      this.#UIElements.scriptCode.value === "" &&
      this.#UIElements.scriptCode.placeholder !== this.#defaultPlaceholder
    ) {
      this.#MIDIElement.scriptCode = this.#UIElements.scriptCode.placeholder;
    } else {
      this.#MIDIElement.scriptCode = this.#UIElements.scriptCode.value;
    }
    this.#isChanged = false;
    updateKeymaps(currentDevice);
    this.close();
  }

  discardAndClose() {
    this.#isChanged = false;
    this.close();
  }

  deleteAndClose() {
    if (confirm("スクリプトを削除しますか？")) {
      this.#UIElements.scriptName.value = "";
      this.#UIElements.scriptCode.value = "";
      this.#onScriptNameChange();
      this.saveAndClose();
    }
  }

  close() {
    if (this.#MIDIElement) {
      if (!this.#isChanged || confirm("変更を保存せずに閉じますか？")) {
        this.#MIDIElement = null;
        this.#UIElements.overlay.classList.add("hidden");
      }
    }
  }
}

const ScriptEditor = new _ScriptEditor();
