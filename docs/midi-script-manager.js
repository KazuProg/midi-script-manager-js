!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).MIDIScriptManager=t()}(this,(function(){"use strict";const e={NoteOff:128,NoteOn:144,ControlChange:176};class t{#e;#t;#i;#s=!1;#a=null;#n=null;#r=null;#o;constructor(e,t,i,s,a=null){this.#e=e,this.#t=t,this.#i=i,a&&(this.#s=!0,this.#a=a?.name||null,this.#n=a?.script?.name||null,this.#r=a?.script?.code||null),this.#o=s}get device(){return this.#e}get midiNumber(){return this.#i}get isAvailable(){return this.#s}get name(){return null!==this.#a?this.#a:this.#c()}get isDefaultName(){return null===this.#a}get scriptName(){return this.#n}get scriptCode(){return this.#r}set name(e){""===(e=e.trim())&&(e=null),this.#a=e,this.#o()}set scriptName(e){""===(e=e.trim())&&(e=null),this.#n=e,this.#o()}set scriptCode(e){""===(e=e.trim())?(this.#n=null,this.#r=null):this.#r=e.trim(),this.#o()}setAvailable(){this.#s=!0,this.#o()}executeScript(e={}){if(this.#r)try{new Function(...Object.keys(e),this.#r)(...Object.values(e))}catch(e){console.error("An error occurred while executing the custom script:",e)}}toJSON(){if(this.#s){const e={};return this.#a&&(e.name=this.#a,this.#r&&(e.script={name:this.#n,code:this.#r})),e}return null}#c(){let t;switch(this.#t){case e.NoteOff:case e.NoteOn:t=this.#l(this.#i);break;case e.ControlChange:t=`0x${this.#i.toString(16).toUpperCase().padStart(2,"0")}`}return t}#l(e){const t="C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|"),i=Math.floor(e/12)-1;return`${t[e%12]}${i}`}}class i{#a;#h;#d;#u;#o;constructor(i,s,a,n=null){if(this.#a=i,this.#h=s,this.#o=a,this.#d=Array.from({length:128},((i,s)=>new t(this,e.NoteOn,s,this.#o))),this.#u=Array.from({length:128},((i,s)=>new t(this,e.ControlChange,s,this.#o))),n){for(const i in n.note)n.note[i]&&(this.#d[i]=new t(this,e.NoteOn,i,this.#o,n.note[i]));for(const i in n.cc)n.cc[i]&&(this.#u[i]=new t(this,e.ControlChange,i,this.#o,n.cc[i]))}}get name(){return this.#a}get manufacturer(){return this.#h}get noteKeyMap(){return this.#d}get ccKeyMap(){return this.#u}getKeyMap(t){switch(t){case e.NoteOff:case e.NoteOn:return this.#d;case e.ControlChange:return this.#u}return null}toJSON(){return{device:{name:this.#a,manufacturer:this.#h},keymap:{note:this.#d,cc:this.#u}}}}class s{static MessageTypes=e;static scriptOrigin;#p={};#m=[];#g=null;constructor(e={}){this.#p={localStorageKey:"midi-scripts",executeScript:!1,onMessage:null,onDeviceChange:null,...e};const t=new URLSearchParams(window.location.search);if(this.#g=t.get("targetOrigin"),window.opener&&this.#g){this.#p.localStorageKey=null;const e=t=>{t.origin===this.#g&&t.data.sender&&"MIDIScriptManager"===t.data.sender&&(window.removeEventListener("message",e),this.#v(t.data.data),this.#p.onDeviceChange(this.#m[0]))};window.addEventListener("message",e),window.opener.postMessage({sender:"MIDIScriptManager",data:"window.loaded"},this.#g),window.opener.addEventListener("beforeunload",(()=>{window.close()}))}else this.#p.localStorageKey&&(window.addEventListener("storage",(e=>{e.key===this.#p.localStorageKey&&this.#v(JSON.parse(e.newValue)||[])})),this.#v(JSON.parse(localStorage.getItem(this.#p.localStorageKey))||[]))}get devices(){return this.#m}async requestAccess(){if(!navigator.requestMIDIAccess)throw new Error("Web MIDI API is not supported in this browser.");try{const e=await navigator.requestMIDIAccess();e.onstatechange=e=>{"input"===e.port.type&&this.#f(e.port)},e.inputs.forEach((e=>{this.#f(e)}))}catch(e){throw new Error(`Failed to request MIDI access: ${e.message}`)}}findDevice(e,t){return this.#m.find((i=>i.name===e&&i.manufacturer===t))}reset(){this.#p.localStorageKey&&confirm("Settings will be reset. Are you sure you want to proceed?")&&(localStorage.removeItem(this.#p.localStorageKey),location.reload())}openCustomScriptEditor(){const e=`${s.scriptOrigin}/midi-script-manager-js/custom-script-editor/`,t=new URLSearchParams({targetOrigin:location.origin}),i=window.open(`${e}?${t.toString()}`,"CustomScriptEditor","width=960,height=540");window.addEventListener("message",(e=>{if(e.origin===s.scriptOrigin&&"MIDIScriptManager"===e.data.sender){const t=e.data.data;if("window.loaded"===t)return void i.postMessage({sender:"MIDIScriptManager",data:JSON.parse(JSON.stringify(this.#m))},s.scriptOrigin);this.#v(t),this.#w()}}))}#f(e){if("connected"!==e.state)return;e.onmidimessage=this.#M.bind(this);let t=new i(e.name,e.manufacturer,this.#w.bind(this));this.findDevice(t.name,t.manufacturer)?t=this.findDevice(t.name,t.manufacturer):(this.#m.push(t),this.#w()),this.#p.onDeviceChange&&this.#p.onDeviceChange(t)}#M(e){const[t,i,s]=e.data,a=240&t,n=15&t,r=this.findDevice(e.target.name,e.target.manufacturer);if(!r)throw new Error("Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen.");const o=this.findDevice(r.name,r.manufacturer)?.getKeyMap(a);if(!o)throw new Error("Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen.");if(o[i].isAvailable||o[i].setAvailable(),this.#p.onMessage){const r={raw:e.data,status:t,data1:i,data2:s,messageType:a,channel:n};this.#p.onMessage(o[i],r)}this.#p.executeScript&&o[i].executeScript({status:t,data1:i,data2:s,messageType:a,channel:n,number:i,value:s,val:s/127})}#v(e){this.#m=[];for(const t of e)this.#m.push(new i(t.device.name,t.device.manufacturer,this.#w.bind(this),t.keymap))}#w(){if(this.#p.localStorageKey&&localStorage.setItem(this.#p.localStorageKey,JSON.stringify(this.#m)),window.opener&&this.#g){const e=JSON.parse(JSON.stringify(this.#m));window.opener.postMessage({sender:"MIDIScriptManager",data:e},this.#g)}}}if(document.currentScript&&document.currentScript.src){const e=document.currentScript.src,t=new URL(e).origin;s.scriptOrigin=t}else s.scriptOrigin="https://kazuprog.github.io";return s}));
