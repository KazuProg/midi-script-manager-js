const MIDIMessageTypes = {
  Note: "n",
  ControlChange: "c",
  CC: "c",
  RawNoteOff: 0x80,
  RawNoteOn: 0x90,
  RawControlChange: 0xb0,
};

export default MIDIMessageTypes;
