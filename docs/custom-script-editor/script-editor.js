class _ScriptEditor {
  #UIElements;
  #MIDIElement = null;
  #isChanged = false;
  #isClickEditor = false;

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
    e.name.addEventListener("input", this.#onChange.bind(this));
    e.scriptName.addEventListener("input", this.#onChange.bind(this));
    e.scriptCode.addEventListener("input", this.#onChange.bind(this));

    this.#UIElements = e;
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

  #onChange() {
    this.#isChanged = true;
  }

  show(element) {
    this.#MIDIElement = element;
    this.#UIElements.controlName.innerText = controlName(element);
    this.#UIElements.name.value = element.name;
    this.#UIElements.controlValue.innerText = "";
    this.#UIElements.scriptName.value = element.scriptName;
    this.#UIElements.scriptCode.value = element.scriptCode;
    this.#isChanged = false;
    this.#UIElements.overlay.classList.remove("hidden");
    this.#UIElements.name.focus();
  }

  saveAndClose() {
    this.#MIDIElement.name = this.#UIElements.name.value;
    this.#MIDIElement.scriptName = this.#UIElements.scriptName.value;
    this.#MIDIElement.scriptCode = this.#UIElements.scriptCode.value;
    this.#isChanged = false;
    updateKeymaps(currentDevice);
    this.close();
  }

  discardAndClose() {
    this.#isChanged = false;
    this.close();
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
