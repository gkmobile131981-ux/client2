/// <reference types="vite/client" />

declare module 'barcode-detector/polyfill';

declare module 'zxing-wasm/reader/zxing_reader.wasm?url' {
  const wasmUrl: string;
  export default wasmUrl;
}

