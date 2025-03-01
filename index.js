document.addEventListener("DOMContentLoaded", async () => {
  logDebug("⏳ Waiting for Libsodium...");
  await sodium.ready;
  logDebug("✅ Libsodium is ready!");

  // Debugging: Check if elements exist
  console.log("Checking if elements exist...");
  ["encryptBtn", "decryptBtn", "inputText", "outputText", "keyInput", "fileInput"]
    .forEach(id => {
      if (!document.getElementById(id)) {
        console.error(`❌ ERROR: ${id} not found!`);
        logDebug(`❌ ERROR: ${id} not found!`);
      }
    });

  // Attach event listeners (only once)
  document.getElementById("encryptBtn").addEventListener("click", handleEncrypt);
  document.getElementById("decryptBtn").addEventListener("click", handleDecrypt);
  document.getElementById("copyOutput").addEventListener("click", handleCopy);
  document.getElementById("pasteInput").addEventListener("click", handlePaste);
  document.getElementById("encryptFileBtn").addEventListener("click", handleFileEncrypt);
  document.getElementById("decryptFileBtn").addEventListener("click", handleFileDecrypt);
  document.getElementById("toggleKey").addEventListener("change", function () {
  const keyInput = document.getElementById("keyInput");
  keyInput.type = this.checked ? "text" : "password";
});

  logDebug("✅ Event listeners added!");
});

// Logging function for debugging
function logDebug(message) {
  /*
  const output = document.getElementById("outputText");
  console.log(message);  // Show logs in console too
  if (output) {
    output.value += `[DEBUG] ${message}\n`;
    output.scrollTop = output.scrollHeight; // Auto-scroll to latest log
  }
  */
}

// Show errors in the output box
function showError(error) {
  logDebug(`❌ Error: ${error.message || error}`);
}

// Resize output box based on content
function resizeOutputBox() {
  const output = document.getElementById("outputText");
  if (output) {
    output.style.height = "auto";
    output.style.height = output.scrollHeight + "px";
  }
}

// Encrypt text using Libsodium
function handleEncrypt() {
  try {
    const text = document.getElementById("inputText").value;
    const key = document.getElementById("keyInput").value;
    if (!text || !key) throw new Error("Text & key are required!");

    const keyBytes = sodium.crypto_generichash(32, sodium.from_string(key));
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = sodium.crypto_secretbox_easy(sodium.from_string(text), nonce, keyBytes);

    const result = sodium.to_base64(nonce) + "::" + sodium.to_base64(encrypted);
    document.getElementById("outputText").value = result;
    resizeOutputBox();
    logDebug("✅ Encryption successful!");
  } catch (error) {
    showError(error);
  }
}

// Decrypt text using Libsodium
function handleDecrypt() {
  try {
    const encryptedText = document.getElementById("inputText").value;
    const key = document.getElementById("keyInput").value;
    if (!encryptedText || !key) throw new Error("Ciphertext & key are required!");

    const [nonceB64, cipherB64] = encryptedText.split("::");
    if (!nonceB64 || !cipherB64) throw new Error("Invalid encrypted format!");

    const keyBytes = sodium.crypto_generichash(32, sodium.from_string(key));
    const nonce = sodium.from_base64(nonceB64);
    const cipher = sodium.from_base64(cipherB64);

    const decrypted = sodium.crypto_secretbox_open_easy(cipher, nonce, keyBytes);
    if (!decrypted) throw new Error("Decryption failed!");

    document.getElementById("outputText").value = sodium.to_string(decrypted);
    resizeOutputBox();
    logDebug("✅ Decryption successful!");
  } catch (error) {
    showError(error);
  }
}

// Copy output text
function handleCopy() {
  navigator.clipboard.writeText(document.getElementById("outputText").value)
    .then(() => logDebug("📋 Copied to clipboard!"))
    .catch(error => showError(error));
}

// Paste into input text
function handlePaste() {
  navigator.clipboard.readText()
    .then(text => {
      document.getElementById("inputText").value = text;
      logDebug("📋 Pasted from clipboard!");
    })
    .catch(error => showError(error));
}

function updateProgressBar(processed, total, startTime) {
  const progressBar = document.getElementById("progressBar");
  const progressInfo = document.getElementById("progressInfo");

  const percentage = ((processed / total) * 100).toFixed(2);
  progressBar.style.width = percentage + "%";
  progressBar.innerText = percentage + "%";

  const elapsedTime = (performance.now() - startTime) / 1000; // in seconds
  const speed = (processed / elapsedTime / 1_000_000).toFixed(2); // MB/s
  const remainingTime = ((total - processed) / (processed / elapsedTime)).toFixed(1); // in seconds

  progressInfo.innerText = `Speed: ${speed} MB/s | ETA: ${remainingTime}s`;
}

// Encrypt 
async function handleFileEncrypt() {
  try {
    logDebug("🔒 Starting file encryption...");
    const fileInput = document.getElementById("fileInput").files[0];
    const key = document.getElementById("keyInput").value;
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    if (!fileInput || !key) throw new Error("File & key required!");

    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        logDebug(`📂 Selected file: ${fileInput.name}, Size: ${fileInput.size} bytes`);
        const fileData = new Uint8Array(event.target.result);
        const fileSize = fileData.length;
        const sodiumNonceSize = sodium.crypto_secretbox_NONCEBYTES;
        const keyBytes = sodium.crypto_generichash(32, sodium.from_string(key));

        let encryptedChunks = [];
        let offset = 0;
        let totalProcessed = 0;
        let CHUNK_SIZE = 5_600_000-16; // Ensure consistency with decryption

        // Show progress bar
        progressBar.style.display = "block";
        //progressText.style.display = "block";
        progressBar.value = 0;
        progressBar.max = fileSize;
        const startTime = performance.now();
        let processed = 0;

        while (offset < fileSize) {
          await new Promise(resolve => setTimeout(resolve, 0)); // Prevent UI freeze

          const chunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
          const chunk = fileData.slice(offset, offset + chunkSize);
          offset += chunkSize;

          const nonce = sodium.randombytes_buf(sodiumNonceSize);
          const encryptedChunk = sodium.crypto_secretbox_easy(chunk, nonce, keyBytes);

          encryptedChunks.push(nonce, encryptedChunk);
          totalProcessed += chunkSize;

          logDebug(`📦 Encrypted chunk: ${encryptedChunk.length + nonce.length} bytes (Total processed: ${totalProcessed} bytes)`);
          processed += chunkSize;
          updateProgressBar(processed, fileSize, startTime);

          // Update progress bar
          //progressBar.value = totalProcessed;
          //progressText.innerText = `${Math.round((totalProcessed / fileSize) * 100)}%`;
        }

        // Hide progress bar after completion
        progressBar.style.display = "none";
        progressInfo.style.display = "none";

        const encryptedFile = new Blob(encryptedChunks, { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(encryptedFile);
        link.download = fileInput.name + ".enc";
        link.click();
        logDebug("✅ File encrypted & ready for download!");
      } catch (error) {
        showError("❌ Encryption error: " + error.message);
      }
    };
    reader.readAsArrayBuffer(fileInput);
  } catch (error) {
    showError("❌ Error: " + error.message);
  }
}
/*

async function handleFileDecrypt() {
  try {
    logDebug("🔍 Starting file decryption...");
    const fileInput = document.getElementById("fileInput").files[0];
    const key = document.getElementById("keyInput").value;
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    if (!fileInput || !key) throw new Error("File & key required!");

    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        logDebug(`📂 Selected file: ${fileInput.name}, Size: ${fileInput.size} bytes`);
        const fileData = new Uint8Array(event.target.result);
        const fileSize = fileData.length;
        const sodiumNonceSize = sodium.crypto_secretbox_NONCEBYTES;
        const keyBytes = sodium.crypto_generichash(32, sodium.from_string(key));

        let decryptedChunks = [];
        let offset = 0;
        let totalProcessed = 0;
        let CHUNK_SIZE = 5_600_000;

// Show progress bar
        progressBar.style.display = "block";
//progressText.style.display = "block";
        progressBar.value = 0;
        progressBar.max = fileSize;
        const startTime = performance.now();
        let processed = 0;

        while (offset < fileSize) {
          await new Promise(resolve => setTimeout(resolve, 0)); // Prevent UI freeze

          if (offset + sodiumNonceSize > fileSize) {
            throw new Error(`Invalid chunk at offset ${offset}: Missing nonce`);
          }

// Extract nonce
          const nonce = fileData.slice(offset, offset + sodiumNonceSize);
          offset += sodiumNonceSize;

// Extract encrypted chunk
          const remainingSize = fileSize - offset;
          const chunkSize = Math.min(CHUNK_SIZE, remainingSize);
          const encryptedChunk = fileData.slice(offset, offset + chunkSize);
          offset += encryptedChunk.length;
          totalProcessed += chunkSize + sodiumNonceSize;

          logDebug(`📦 Decrypting chunk: ${chunkSize} bytes (Total processed: ${totalProcessed} bytes)`);

// Decrypt chunk
          const decrypted = sodium.crypto_secretbox_open_easy(encryptedChunk, nonce, keyBytes);
          if (!decrypted) {
            throw new Error(`Decryption failed at chunk offset ${offset}`);
          }

          decryptedChunks.push(decrypted);

// Update progress bar
/*
          progressBar.value = totalProcessed;
          progressText.innerText = `${Math.round((totalProcessed / fileSize) * 100)}%`;
        }

        processed += chunkSize;
        updateProgressBar(processed, fileSize, startTime);

// Hide progress bar after completion
        progressBar.style.display = "none";
        progressText.style.display = "none";

        const decryptedFile = new Blob(decryptedChunks, { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(decryptedFile);
        link.download = fileInput.name.replace(".enc", "");
        link.click();
        logDebug("✅ File decrypted & ready for download!");
      } catch (error) {
        showError("❌ Decryption error: " + error.message);
      }
    };
    reader.readAsArrayBuffer(fileInput);
  } catch (error) {
    showError("❌ Error: " + error.message);
  }
}*/


async function handleFileDecrypt() {
  try {
    logDebug("🔍 Starting file decryption...");
    const fileInput = document.getElementById("fileInput").files[0];
    const key = document.getElementById("keyInput").value;
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressInfo");

    if (!fileInput || !key) throw new Error("File & key required!");

    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        logDebug(`📂 Selected file: ${fileInput.name}, Size: ${fileInput.size} bytes`);
        const fileData = new Uint8Array(event.target.result);
        const fileSize = fileData.length;
        const sodiumNonceSize = sodium.crypto_secretbox_NONCEBYTES;
        const keyBytes = sodium.crypto_generichash(32, sodium.from_string(key));

        let decryptedChunks = [];
        let offset = 0;
        let processed = 0;
        const CHUNK_SIZE = 5_600_000;

        // Show progress bar
        progressBar.style.display = "block";
        progressText.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "Speed: 0 MB/s | ETA: --s";

        const startTime = performance.now();

        while (offset < fileSize) {
          await new Promise(resolve => setTimeout(resolve, 0)); // Prevent UI freeze

          if (offset + sodiumNonceSize > fileSize) {
            throw new Error(`Invalid chunk at offset ${offset}: Missing nonce`);
          }

          // Extract nonce
          const nonce = fileData.slice(offset, offset + sodiumNonceSize);
          offset += sodiumNonceSize;

          // Extract encrypted chunk
          const remainingSize = fileSize - offset;
          const chunkSize = Math.min(CHUNK_SIZE, remainingSize);
          const encryptedChunk = fileData.slice(offset, offset + chunkSize);
          offset += chunkSize;

          logDebug(`📦 Decrypting chunk: ${chunkSize} bytes (Processed: ${offset}/${fileSize})`);

          // Decrypt chunk
          let decrypted;
          try {
            decrypted = sodium.crypto_secretbox_open_easy(encryptedChunk, nonce, keyBytes);
            if (!decrypted) throw new Error("Decryption failed");
          } catch (err) {
            throw new Error(`Decryption failed at offset ${offset}: ${err.message}`);
          }

          decryptedChunks.push(decrypted);
          processed += chunkSize;

          // Update progress bar
          updateProgressBar(processed, fileSize, startTime);
        }

        // Hide progress bar after completion
        progressBar.style.display = "none";
        progressText.style.display = "none";

        // Create and download decrypted file
        const decryptedFile = new Blob(decryptedChunks, { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(decryptedFile);
        link.download = fileInput.name.replace(".enc", "");
        link.click();

        logDebug("✅ File decrypted & ready for download!");
      } catch (error) {
        showError("❌ Decryption error: " + error.message);
      }
    };
    reader.readAsArrayBuffer(fileInput);
  } catch (error) {
    showError("❌ Error: " + error.message);
  }
}
