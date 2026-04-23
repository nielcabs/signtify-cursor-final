document.addEventListener("DOMContentLoaded", () => {

    // Get references to all the HTML elements
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('overlay');
    const canvasCtx = canvasElement.getContext('2d');
    const startButton = document.getElementById('start-camera-button');
    const modal = document.getElementById('detection-modal');
    const closeButton = document.querySelector('.close-button');
    const predictionText = document.getElementById('predictionText');
    const mainContent = document.querySelector('.main-content');
    const header = document.querySelector('.header');

    // This is the URL of the Python server we just built
    const FLASK_SERVER_URL = 'http://127.0.0.1:5000/predict';

    // Global variables
    let holistic, camera;
    let sequence = [];
    const sequenceLength = 30; // Must match your sequence_length
    let predictionInterval;
    const predictionIntervalMs = 500; // Run prediction 2 times per second
    let isProcessing = false;

    // Helper function to extract keypoints (NO CHANGE)
    function extractKeypoints(results) {
        const pose = results.poseLandmarks ? results.poseLandmarks.map(res => [res.x, res.y, res.z, res.visibility]).flat() : new Array(33 * 4).fill(0);
        //const face = results.faceLandmarks ? results.faceLandmarks.map(res => [res.x, res.y, res.z]).flat() : new Array(468 * 3).fill(0);
        const lh = results.leftHandLandmarks ? results.leftHandLandmarks.map(res => [res.x, res.y, res.z]).flat() : new Array(21 * 3).fill(0);
        const rh = results.rightHandLandmarks ? results.rightHandLandmarks.map(res => [res.x, res.y, res.z]).flat() : new Array(21 * 3).fill(0);
        return [...lh, ...rh];
    }

    // Check if any hand is present in the recent frames
    function hasHandInSequence(seq) {
        const handIndicesStart = 33 * 4 + 468 * 3; // after pose and face
        const leftHandStart = handIndicesStart;
        const rightHandStart = leftHandStart + 21 * 3;
        for (let frame of seq) {
            const leftHand = frame.slice(leftHandStart, leftHandStart + 21 * 3);
            const rightHand = frame.slice(rightHandStart, rightHandStart + 21 * 3);
            // If any coordinate is non-zero, hand is detected
            if (leftHand.some(v => v !== 0) || rightHand.some(v => v !== 0)) {
                return true;
            }
        }
        return false;
    }

    // --- THIS IS THE NEW PREDICTION LOOP ---
    async function predictLoop() {
        if (isProcessing || sequence.length !== sequenceLength) {
            return; // Not ready to predict
        }
        if (!hasHandInSequence(sequence)) {
            predictionText.innerHTML = "No hands detected";
            return;
        }
        isProcessing = true;

        const currentSequence = [...sequence]; // Copy the sequence

        try {
            // Use 'fetch' to send the data to our Python server
            const response = await fetch(FLASK_SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sequence: currentSequence }), // Send the sequence
            });

            if (!response.ok) {
                console.error("Server error:", response.statusText);
                predictionText.innerHTML = "Server Error";
                return;
            }

            // Get the prediction back from the server
            const data = await response.json();

            if (data.prediction) {
                predictionText.innerHTML = data.prediction;
            }

        } catch (error) {
            // This happens if the server is not running
            console.error("Fetch error:", error);
            predictionText.innerHTML = "Offline"; // Show "Offline" if it can't connect
        } finally {
            isProcessing = false;
        }
    }

    // onResults (NO CHANGE)
    function onResults(results) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.scale(-1, 1);
        canvasCtx.translate(-canvasElement.width, 0);
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
        drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {color: '#CC0000', lineWidth: 5});
        drawLandmarks(canvasCtx, results.leftHandLandmarks, {color: '#00FF00', lineWidth: 2});
        drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {color: '#00CC00', lineWidth: 5});
        drawLandmarks(canvasCtx, results.rightHandLandmarks, {color: '#FF0000', lineWidth: 2});
        canvasCtx.restore();

        const keypoints = extractKeypoints(results);
        sequence.push(keypoints);
        sequence = sequence.slice(-sequenceLength); // Keep it at 30 frames
    }

    // --- THIS IS THE NEW LOAD FUNCTION ---
    async function loadModelsAndSetup() {
        try {
            predictionText.innerHTML = "Loading MediaPipe...";

            holistic = new Holistic({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }});

            holistic.setOptions({
                modelComplexity: 0, 
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            holistic.onResults(onResults);
            console.log("MediaPipe Holistic Model Loaded!");

            camera = new Camera(videoElement, {
                onFrame: async () => {
                    await holistic.send({image: videoElement});
                },
                width: 640,
                height: 480
            });

        } catch (error) {
            console.error("Error loading MediaPipe:", error);
            alert("Error loading MediaPipe. Check console (F12) for details.");
            return false;
        }
        return true;
    }

    // --- Button Clicks (NO CHANGE) ---
    startButton.addEventListener('click', async (e) => {
        e.preventDefault(); 
        modal.style.display = 'block'; 
        mainContent.style.filter = 'blur(5px)';
        header.style.filter = 'blur(5px)';

        const success = await loadModelsAndSetup();

        if (success) {
            camera.start(); 
            predictionText.innerHTML = "Detecting...";
            console.log("Camera started");

            if (predictionInterval) clearInterval(predictionInterval);
            predictionInterval = setInterval(predictLoop, predictionIntervalMs);
        }
    });

    closeButton.addEventListener('click', () => {
        if (camera) camera.stop(); 
        if (predictionInterval) clearInterval(predictionInterval); 

        modal.style.display = 'none'; 
        predictionText.innerHTML = "..."; 
        mainContent.style.filter = 'none';
        header.style.filter = 'none';
        sequence = []; 
        isProcessing = false;
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeButton.click(); 
        }
    });
});