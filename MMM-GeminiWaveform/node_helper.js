/* MagicMirror² Module: MMM-GeminiWaveform
 * Node Helper
 * 
 * By Your Name
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const WebSocket = require("ws");
const { spawn } = require("child_process");
const path = require("path");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        
        this.config = null;
        this.ws = null;
        this.pythonProcess = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "CONFIG") {
            this.config = payload;
            this.startPythonBackend();
            this.connectWebSocket();
        }
    },

    startPythonBackend: function() {
        if (this.pythonProcess) {
            return; // Already running
        }

        // IMPORTANT: Run gemini_waveform_bridge.py which integrates Gemini AI with WebSocket
        // waveform_server.py alone doesn't have Gemini integration!
        const pythonScript = path.join(__dirname, "python-backend", "gemini_waveform_bridge.py");
        const pythonPath = path.join(__dirname, "python-backend", "venv", "bin", "python");
        
        // Check if venv exists, otherwise use system python
        const fs = require("fs");
        const pythonExecutable = fs.existsSync(pythonPath) ? pythonPath : "python3";
        
        // Check if .env file exists for API key
        const envPath = path.join(__dirname, "python-backend", ".env");
        if (!fs.existsSync(envPath)) {
            console.error("ERROR: Missing .env file with GEMINI_API_KEY in python-backend directory!");
            console.error("Create python-backend/.env with: GEMINI_API_KEY=your_api_key_here");
            return;
        }
        
        console.log(`Starting Python backend: ${pythonExecutable} ${pythonScript}`);
        
        // Pass video configuration via environment variables
        const envVars = {
            ...process.env,
            GEMINI_VIDEO_MODE: this.config.videoMode || "camera",
            GEMINI_CAMERA_INDEX: String(this.config.cameraIndex ?? 0),
            GEMINI_HEADLESS: "1" // ensure headless when launched via MagicMirror
        };

        this.pythonProcess = spawn(pythonExecutable, [pythonScript], {
            cwd: path.join(__dirname, "python-backend"),
            env: envVars
        });

        this.pythonProcess.stdout.on("data", (data) => {
            console.log(`Python stdout: ${data}`);
        });

        this.pythonProcess.stderr.on("data", (data) => {
            console.error(`Python stderr: ${data}`);
        });

        this.pythonProcess.on("close", (code) => {
            console.log(`Python process exited with code ${code}`);
            this.pythonProcess = null;
            
            // Attempt to restart after a delay
            setTimeout(() => {
                if (this.config) {
                    this.startPythonBackend();
                }
            }, 5000);
        });
    },

    connectWebSocket: function() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        const wsUrl = `ws://${this.config.pythonHost}:${this.config.pythonPort}`;
        console.log(`Connecting to WebSocket: ${wsUrl}`);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on("open", () => {
                console.log("WebSocket connected");
                this.reconnectAttempts = 0;
                this.sendSocketNotification("CONNECTION_STATUS", { connected: true });
                
                // Send initial configuration
                this.ws.send(JSON.stringify({
                    type: "config",
                    data: {
                        updateInterval: this.config.updateInterval,
                        animationSpeed: this.config.animationSpeed
                    }
                }));
            });

            this.ws.on("message", (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === "waveform") {
                        this.sendSocketNotification("WAVEFORM_DATA", message.data);
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            });

            this.ws.on("close", () => {
                console.log("WebSocket disconnected");
                this.sendSocketNotification("CONNECTION_STATUS", { connected: false });
                this.scheduleReconnect();
            });

            this.ws.on("error", (error) => {
                console.error("WebSocket error:", error.message);
                this.sendSocketNotification("CONNECTION_STATUS", { connected: false });
            });

        } catch (error) {
            console.error("Failed to create WebSocket:", error);
            this.scheduleReconnect();
        }
    },

    scheduleReconnect: function() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
        
        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connectWebSocket();
        }, delay);
    },

    stop: function() {
        console.log("Stopping node helper for: " + this.name);
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
});
