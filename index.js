/*
Copyright fr000gs
Licensed under GNU AGPL 3.0
made for my personal use
*/
import { fromByteArray, toByteArray } from "./b64.js";
import { ECB } from "./ecb.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function pkcs7Pad(text, blockSize = 16) {
  const textBytes = encoder.encode(text);
  const padLength = blockSize - (textBytes.length % blockSize) || blockSize;
  const padded = new Uint8Array(textBytes.length + padLength);
  padded.set(textBytes);
  padded.fill(padLength, textBytes.length);
  return padded;
}

function pkcs7Unpad(paddedBytes) {
  const padLength = paddedBytes[paddedBytes.length - 1];
  if (padLength < 1 || padLength > 16) {
    throw new Error("Invalid padding");
  }
  for (let i = paddedBytes.length - padLength; i < paddedBytes.length; i++) {
    if (paddedBytes[i] !== padLength) {
      throw new Error("Invalid padding");
    }
  }
  return paddedBytes.slice(0, paddedBytes.length - padLength);
}

function cut16(text) {
  return text.slice(0, 16).padEnd(16);
}

function aesecbenc(text, key) {
  try {
    const paddedTextBytes = pkcs7Pad(text, 16);
    const keyBytes = new TextEncoder().encode(key);
    const aesEcb = new ECB(keyBytes);
    const encryptedBytes = new Uint8Array(paddedTextBytes.length);
    for (let i = 0; i < paddedTextBytes.length; i += 16) {
      const block = paddedTextBytes.slice(i, i + 16);
      const encryptedBlock = new Uint8Array(16);
      aesEcb.encrypt(block, encryptedBlock);
      encryptedBytes.set(encryptedBlock, i);
    }

    return fromByteArray(encryptedBytes);
  } catch (error) {
    document.getElementById("encdec").value = "Decryption error: " + error.message;
    return "";
  }
}

function aesecbdec(encryptedBytes, key) {
  try {
    const keyBytes = new TextEncoder().encode(key);
    const aesEcb = new ECB(keyBytes);
    const decryptedPaddedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i += 16) {
      const block = encryptedBytes.slice(i, i + 16);
      const decryptedBlock = new Uint8Array(16);
      aesEcb.decrypt(block, decryptedBlock);
      decryptedPaddedBytes.set(decryptedBlock, i);
    }

    return new TextDecoder().decode(pkcs7Unpad(decryptedPaddedBytes)); // Remove padding
  } catch (error) {
    document.getElementById("encdec").value = "Decryption error: " + error.message;
    return "";
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function handleEncryption() {
  try {
    const inputText = document.getElementById("inputtext").value;
    const key = cut16(document.getElementById("key").value);
    const encryptedText = aesecbenc(inputText, key);

    const outputArea = document.getElementById("encdec");
    outputArea.value = encryptedText;
    autoResize(outputArea);
  } catch (error) {
    document.getElementById("encdec").value = "Decryption error: " + error.message;
  }
}

function handleDecryption() {
  try {
    const inputText = document.getElementById("inputtext").value;
    const key = cut16(document.getElementById("key").value);
    const decryptedText = aesecbdec(toByteArray(inputText), key);

    const outputArea = document.getElementById("encdec");
    outputArea.value = decryptedText;
    autoResize(outputArea);
  } catch (error) {
    document.getElementById("encdec").value = "Decryption error: " + error;
  }
}

function pasteInput() {
  navigator.clipboard.readText()
    .then(text => {
      document.getElementById("inputtext").value = text;
    })
    .catch(err => {
      document.getElementById("encdec").value = "Error: Unable to paste!";
    });
}

// Add event listener for Paste button

function copyOutput() {
  const output = document.getElementById("encdec").value;
  navigator.clipboard.writeText(output)
    .then(() => console.log("Copied to clipboard!"))
    .catch(err => alert("Copy failed:", err));
}


function setupEventListeners() {
  document.getElementById("encbtn").addEventListener("click", handleEncryption);
  document.getElementById("decbtn").addEventListener("click", handleDecryption);
  document.getElementById("copyoutput").addEventListener("click", copyOutput);
document.getElementById("pastebtn").addEventListener("click", pasteInput);

  /*
  document.getElementById("encbtn").addEventListener("click", aesecbenc);
  document.getElementById("decbtn").addEventListener("click", aesecbdec);
  document.getElementById("copyoutput").addEventListener("click", copyOutput);
  */


  //auto resize code starts

  document.getElementById('encbtn').addEventListener('click', () => {
    setTimeout(() => autoResize(document.getElementById('encdec')), 10);
  });

  document.getElementById('decbtn').addEventListener('click', () => {
    setTimeout(() => autoResize(document.getElementById('encdec')), 10);
  });
  document.querySelectorAll('textarea').forEach(textarea => {
    textarea.addEventListener('input', function () {
      autoResize(this);
    });
    autoResize(textarea); // Resize on load if pre-filled
  });
}

document.addEventListener("DOMContentLoaded", setupEventListeners);
