import { terser } from "rollup-plugin-terser";

const isProduction = process.env.NODE_ENV === "production";

export default {
  input: "src/midi-script-manager.js",
  output: [
    {
      file: "docs/midi-script-manager.js",
      format: "umd",
      name: "MIDIScriptManager",
      sourcemap: !isProduction,
      plugins: isProduction ? [terser()] : [],
    },
  ],
  plugins: [],
  watch: {
    include: "src/**",
  },
};
