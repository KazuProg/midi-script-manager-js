class PostMessageHandler {
  #origin;
  #senderId;

  constructor(origin, senderId) {
    this.#origin = origin;
    this.#senderId = senderId;
  }

  load() {
    return new Promise((resolve, reject) => {
      const listener = (event) => {
        if (event.origin !== this.#origin) return;
        if (event.data.sender && event.data.sender === this.#senderId) {
          window.removeEventListener("message", listener);
          resolve(event.data.data);
        }
      };
      window.addEventListener("message", listener);
      window.opener.postMessage(
        {
          sender: this.#senderId,
          data: "requestData",
        },
        this.#origin
      );
    });
  }

  save(value) {
    window.opener.postMessage(
      {
        sender: this.#senderId,
        data: value,
      },
      this.#origin
    );
  }
}

export default PostMessageHandler;
