// polyfills.js
// CRITICAL: This MUST be the first import in your app
import 'react-native-get-random-values';

// Get the Buffer module
const BufferModule = require('buffer');
const Buffer = BufferModule.Buffer;
const SlowBuffer = BufferModule.SlowBuffer || Buffer;

// Polyfill global scope
if (typeof global === 'undefined') {
  global = window;
}

// Monkey-patch Buffer encoding support BEFORE anything else
const encodingOps = require('buffer').INSPECT_MAX_BYTES;

// Override internal encoding operations
const originalIsEncoding = Buffer.isEncoding;
Buffer.isEncoding = function(encoding) {
  const enc = String(encoding).toLowerCase().replace(/[-_]/g, '');
  if (enc === 'utf16le' || enc === 'utf16le') {
    return true;
  }
  return originalIsEncoding ? originalIsEncoding.call(this, encoding) : false;
};

// Patch Buffer constructor
const OriginalBuffer = Buffer;
function PatchedBuffer(arg, encodingOrOffset, length) {
  if (typeof arg === 'string' && (encodingOrOffset === 'utf-16le' || encodingOrOffset === 'utf16le')) {
    // Convert string to utf-16le manually
    const buf = OriginalBuffer.allocUnsafe(arg.length * 2);
    for (let i = 0; i < arg.length; i++) {
      const code = arg.charCodeAt(i);
      buf[i * 2] = code & 0xff;
      buf[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return buf;
  }
  return new OriginalBuffer(arg, encodingOrOffset, length);
}

// Copy all static methods
Object.setPrototypeOf(PatchedBuffer, OriginalBuffer);
Object.setPrototypeOf(PatchedBuffer.prototype, OriginalBuffer.prototype);
for (const key in OriginalBuffer) {
  if (OriginalBuffer.hasOwnProperty(key)) {
    PatchedBuffer[key] = OriginalBuffer[key];
  }
}

// Patch Buffer.from
const originalFrom = OriginalBuffer.from;
PatchedBuffer.from = Buffer.from = function(value, encodingOrOffset, length) {
  if (typeof value === 'string' && (encodingOrOffset === 'utf-16le' || encodingOrOffset === 'utf16le')) {
    const buf = OriginalBuffer.allocUnsafe(value.length * 2);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      buf[i * 2] = code & 0xff;
      buf[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return buf;
  }
  return originalFrom.apply(OriginalBuffer, arguments);
};

// Patch Buffer.prototype.toString
const originalToString = OriginalBuffer.prototype.toString;
OriginalBuffer.prototype.toString = function(encoding, start, end) {
  if (encoding === 'utf-16le' || encoding === 'utf16le') {
    const slice = this.slice(start || 0, end || this.length);
    let str = '';
    for (let i = 0; i < slice.length - 1; i += 2) {
      const code = slice[i] | (slice[i + 1] << 8);
      str += String.fromCharCode(code);
    }
    return str;
  }
  return originalToString.apply(this, arguments);
};

// Patch Buffer.prototype.write
const originalWrite = OriginalBuffer.prototype.write;
OriginalBuffer.prototype.write = function(string, offset, length, encoding) {
  if (encoding === 'utf-16le' || encoding === 'utf16le') {
    offset = offset || 0;
    const maxLength = Math.min(this.length - offset, string.length * 2);
    for (let i = 0; i < maxLength / 2; i++) {
      const code = string.charCodeAt(i);
      this[offset + i * 2] = code & 0xff;
      this[offset + i * 2 + 1] = (code >> 8) & 0xff;
    }
    return maxLength;
  }
  return originalWrite.apply(this, arguments);
};

// Set the patched Buffer globally
global.Buffer = PatchedBuffer;
BufferModule.Buffer = PatchedBuffer;

// Also patch SlowBuffer
if (SlowBuffer) {
  global.SlowBuffer = PatchedBuffer;
  BufferModule.SlowBuffer = PatchedBuffer;
}

// Polyfill process
if (!global.process) {
  global.process = require('process');
}
global.process.env = global.process.env || {};
global.process.version = 'v16.0.0';
global.process.browser = true;

// Polyfill TextEncoder/TextDecoder
const textEncoding = require('text-encoding');
global.TextEncoder = textEncoding.TextEncoder;
global.TextDecoder = textEncoding.TextDecoder;

// Polyfill btoa/atob
if (!global.btoa) {
  global.btoa = function(str) {
    return PatchedBuffer.from(str, 'binary').toString('base64');
  };
}

if (!global.atob) {
  global.atob = function(str) {
    return PatchedBuffer.from(str, 'base64').toString('binary');
  };
}

// Ensure stream is available
if (!global.stream) {
  global.stream = require('readable-stream');
}

console.log('✅ Polyfills loaded with deep UTF-16LE encoding support');
console.log('✅ Buffer.isEncoding("utf-16le"):', PatchedBuffer.isEncoding('utf-16le'));

export { PatchedBuffer as Buffer };