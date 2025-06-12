const cover = document.getElementById('cover');
const mainContent = document.getElementById('main-content');
const videoElement = document.getElementById('video');
const outputCanvas = document.getElementById('outputCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const outputCtx = outputCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const status = document.getElementById('status');
const colorPicker = document.getElementById('color-picker');
const brushSizeSlider = document.getElementById('brush-size');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');

let tracking = false;
let lastPos = null;
let eraseRadius = 40;
let clearTimer = null;
let history = [];

// Show cover page
setTimeout(() => {
  cover.classList.add('fade-out');
  setTimeout(() => {
    cover.style.display = 'none';
    mainContent.style.display = 'block';
  }, 1000);
}, 3000);

function resizeCanvases() {
  outputCanvas.width = drawCanvas.width = videoElement.videoWidth;
  outputCanvas.height = drawCanvas.height = videoElement.videoHeight;
}

function saveState() {
  history.push(drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
  if (history.length > 20) history.shift();
}

function saveDrawing() {
  const link = document.createElement('a');
  link.download = 'drawing.png';
  link.href = drawCanvas.toDataURL();
  link.click();
}

function isFingerUp(landmarks, tip, mcp) {
  return landmarks[tip].y < landmarks[mcp].y;
}

function areFingersClosed(landmarks) {
  return [[4, 3], [8, 5], [12, 9], [16, 13], [20, 17]].every(([tip, mcp]) => landmarks[tip].y > landmarks[mcp].y);
}

function areAllFingersUp(landmarks) {
  return [[4, 3], [8, 5], [12, 9], [16, 13], [20, 17]].every(([tip, mcp]) => isFingerUp(landmarks, tip, mcp));
}

function areTwoFingersUp(landmarks) {
  return isFingerUp(landmarks, 8, 5) && isFingerUp(landmarks, 12, 9);
}

function onResults(results) {
  if (!tracking) return;

  outputCtx.save();
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.translate(outputCanvas.width, 0);
  outputCtx.scale(-1, 1);
  outputCtx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(outputCtx, landmarks, HAND_CONNECTIONS, { color: 'white', lineWidth: 2 });

      const indexTipX = (1 - landmarks[8].x) * outputCanvas.width;
      const indexTipY = landmarks[8].y * outputCanvas.height;

      if (areFingersClosed(landmarks)) {
        status.innerText = 'Status: Erasing...';
        drawCtx.save();
        drawCtx.beginPath();
        drawCtx.arc(indexTipX, indexTipY, eraseRadius, 0, 2 * Math.PI);
        drawCtx.clip();
        drawCtx.clearRect(indexTipX - eraseRadius, indexTipY - eraseRadius, eraseRadius * 2, eraseRadius * 2);
        drawCtx.restore();
      } else if (areAllFingersUp(landmarks)) {
        status.innerText = 'Status: Clearing in 2s...';
        if (!clearTimer) {
          clearTimer = setTimeout(() => {
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            clearTimer = null;
          }, 2000);
        }
      } else {
        clearTimeout(clearTimer);
        clearTimer = null;

        if (!areTwoFingersUp(landmarks)) {
          if (isFingerUp(landmarks, 8, 5)) {
            status.innerText = 'Status: Drawing...';
            if (lastPos) {
              saveState();
              drawCtx.strokeStyle = colorPicker.value;
              drawCtx.lineWidth = brushSizeSlider.value;
              drawCtx.beginPath();
              drawCtx.moveTo(lastPos.x, lastPos.y);
              drawCtx.lineTo(indexTipX, indexTipY);
              drawCtx.stroke();
            }
            lastPos = { x: indexTipX, y: indexTipY };
          } else {
            lastPos = null;
            status.innerText = 'Status: Idle';
          }
        } else {
          status.innerText = 'Status: Two fingers up (paused)';
          lastPos = null;
        }
      }
    }
  }
  outputCtx.restore();
}

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    if (tracking) await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

videoElement.addEventListener('loadeddata', resizeCanvases);

startBtn.onclick = () => {
  tracking = true;
  status.innerText = 'Status: Ready for gestures...';
  camera.start();
};

endBtn.onclick = () => {
  tracking = false;
  camera.stop();
  status.innerText = 'Status: Stopped. Ready to restart.';
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  videoElement.style.display = 'none';
  lastPos = null;
  clearTimeout(clearTimer);
  clearTimer = null;
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'z') {
    if (tracking) {
      drawCtx.putImageData(history.pop() || drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height), 0, 0);
    }
  }
});
