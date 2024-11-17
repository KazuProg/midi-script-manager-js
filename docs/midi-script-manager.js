!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).MIDIScriptManager=t()}(this,(function(){"use strict";const e={NoteOff:128,NoteOn:144,ControlChange:176};class t{static MessageTypes=e;static scriptOrigin;#e={};#t=null;#i=null;constructor(e={}){this.#e={localStorageKey:"midi-scripts",executeScript:!1,onMessage:null,onDeviceChange:null,...e};const t=new URLSearchParams(window.location.search);if(this.#i=t.get("targetOrigin"),window.opener&&this.#i){this.#e.localStorageKey=null;const e=t=>{t.origin===this.#i&&t.data.sender&&"MIDIScriptManager"===t.data.sender&&(window.removeEventListener("message",e),console.log(t.data.data),this.#s(t.data.data),this.#e.onDeviceChange(this.#t[0]))};window.addEventListener("message",e),window.opener.postMessage({sender:"MIDIScriptManager",data:"window.loaded"},this.#i),window.opener.addEventListener("beforeunload",(()=>{window.close()}))}else this.#e.localStorageKey?(window.addEventListener("storage",(e=>{e.key===this.#e.localStorageKey&&this.#s(JSON.parse(e.newValue)||[])})),this.#s(JSON.parse(localStorage.getItem(this.#e.localStorageKey))||[])):this.#t=[]}async requestAccess(){if(!navigator.requestMIDIAccess)throw new Error("Web MIDI API is not supported in this browser.");try{const e=await navigator.requestMIDIAccess();e.onstatechange=e=>{"input"===e.port.type&&this.#a(e.port)},e.inputs.forEach((e=>{this.#a(e)}))}catch(e){throw new Error(`Failed to request MIDI access: ${e.message}`)}}findDevice(e,t){return this.#t.find((i=>i.name===e&&i.manufacturer===t))}reset(){this.#e.localStorageKey&&confirm("Settings will be reset. Are you sure you want to proceed?")&&(localStorage.removeItem(this.#e.localStorageKey),location.reload())}openCustomScriptEditor(){const e=`${t.scriptOrigin}/midi-script-manager-js/custom-script-editor/`,i=new URLSearchParams({targetOrigin:location.origin}),s=window.open(`${e}?${i.toString()}`,"CustomScriptEditor","width=960,height=540");window.addEventListener("message",(e=>{if(e.origin===t.scriptOrigin&&"MIDIScriptManager"===e.data.sender){const i=e.data.data;if("window.loaded"===i)return void s.postMessage({sender:"MIDIScriptManager",data:JSON.parse(JSON.stringify(this.#t))},t.scriptOrigin);this.#s(i),this.#n()}}))}#a(e){if("connected"!==e.state)return;e.onmidimessage=this.#r.bind(this);let t=new i(e.name,e.manufacturer,this.#n.bind(this));this.findDevice(t.name,t.manufacturer)?t=this.findDevice(t.name,t.manufacturer):(this.#t.push(t),this.#n()),this.#e.onDeviceChange&&this.#e.onDeviceChange(t)}#r(e){const[t,i,s]=e.data,a=240&t,n=15&t,r=this.findDevice(e.target.name,e.target.manufacturer);if(!r)throw new Error("Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen.");const o=this.findDevice(r.name,r.manufacturer)?.getKeyMap(a);if(!o)throw new Error("Variable 'MIDIScriptManager.#midiDevices' is not initialized. This should never happen.");if(o[i].isAvailable||o[i].setAvailable(),this.#e.onMessage){const r={raw:e.data,status:t,data1:i,data2:s,messageType:a,channel:n};this.#e.onMessage(o[i],r)}this.#e.executeScript&&o[i].executeScript({status:t,data1:i,data2:s,messageType:a,channel:n,number:i,value:s,val:s/127})}#s(e){this.#t=[];for(const t of e)this.#t.push(new i(t.device.name,t.device.manufacturer,this.#n.bind(this),t.keymap))}#n(){this.#e.localStorageKey&&localStorage.setItem(this.#e.localStorageKey,JSON.stringify(this.#t)),window.opener&&this.#i&&window.opener.postMessage({sender:"MIDIScriptManager",data:this.#t},this.#i)}}class i{#o;#c;#l;#h;#d;constructor(t,i,a,n=null){if(this.#o=t,this.#c=i,this.#d=a,this.#l=Array.from({length:128},((t,i)=>new s(this,e.NoteOn,i,this.#d))),this.#h=Array.from({length:128},((t,i)=>new s(this,e.ControlChange,i,this.#d))),n){for(const t in n.note)n.note[t]&&(this.#l[t]=new s(this,e.NoteOn,t,this.#d,n.note[t]));for(const t in n.cc)n.cc[t]&&(this.#h[t]=new s(this,e.ControlChange,t,this.#d,n.cc[t]))}}get name(){return this.#o}get manufacturer(){return this.#c}get noteKeyMap(){return this.#l}get ccKeyMap(){return this.#h}getKeyMap(t){switch(t){case e.NoteOff:case e.NoteOn:return this.#l;case e.ControlChange:return this.#h}return null}toJSON(){return{device:{name:this.#o,manufacturer:this.#c},keymap:{note:this.#l,cc:this.#h}}}}class s{#u;#p;#m;#g=!1;#o=null;#v=null;#f=null;#d;constructor(e,t,i,s,a=null){this.#u=e,this.#p=t,this.#m=i,a&&(this.#g=!0,this.#o=a?.name||null,this.#v=a?.script?.name||null,this.#f=a?.script?.code||null),this.#d=s}get device(){return this.#u}get midiNumber(){return this.#m}get isAvailable(){return this.#g}get name(){return null!==this.#o?this.#o:this.#w()}get isDefaultName(){return null===this.#o}get scriptName(){return this.#v}get scriptCode(){return this.#f}set name(e){""===(e=e.trim())&&(e=null),this.#o=e,this.#d()}set scriptName(e){""===(e=e.trim())&&(e=null),this.#v=e,this.#d()}set scriptCode(e){""===(e=e.trim())?(this.#v=null,this.#f=null):this.#f=e.trim(),this.#d()}setAvailable(){this.#g=!0,this.#d()}executeScript(e={}){if(this.#f)try{new Function(...Object.keys(e),this.#f)(...Object.values(e))}catch(e){console.error("An error occurred while executing the custom script:",e)}}toJSON(){if(this.#g){const e={};return this.#o&&(e.name=this.#o,this.#f&&(e.script={name:this.#v,code:this.#f})),e}return null}#w(){let t;switch(this.#p){case e.NoteOff:case e.NoteOn:t=this.#M(this.#m);break;case e.ControlChange:t=`0x${this.#m.toString(16).toUpperCase().padStart(2,"0")}`}return t}#M(e){const t="C|C#|D|D#|E|F|F#|G|G#|A|A#|B".split("|"),i=Math.floor(e/12)-1;return`${t[e%12]}${i}`}}if(document.currentScript&&document.currentScript.src){const e=document.currentScript.src,i=new URL(e).origin;t.scriptOrigin=i}else t.scriptOrigin="https://kazuprog.github.io";return t}));