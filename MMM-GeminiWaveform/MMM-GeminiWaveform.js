/* MagicMirror² Module: MMM-GeminiWaveform
 * 
 * By Your Name
 * MIT Licensed.
 * 
 * This module displays an animated waveform visualization for Gemini AI audio responses
 */

Module.register("MMM-GeminiWaveform", {
    // Default module config
    defaults: {
        width: 300,
        height: 100,
        updateInterval: 16,
        pythonHost: "localhost",
        pythonPort: 8765,
        waveColor: "#ffffff",
        glowColor: "#ffffff",
        idleAmplitude: 0.06,
        animationSpeed: 0.35,
        showDebug: false,
        videoMode: "camera",
        cameraIndex: 0
    },
    // Override start method
    start: function() {
        Log.info("Starting module: " + this.name);
        
        this.canvas = null;
        this.ctx = null;
        this.animationFrame = null;
        this.connected = false;
        
        // Waveform state
        this.wavePhase = 0;
        this.currentAmplitude = 0;
        this.targetAmplitude = 0;
        this.lastDataTime = Date.now();
        
        // Send initial config to node_helper
        this.sendSocketNotification("CONFIG", this.config);
        
        // Start animation loop
        this.animateWaveform();
    },

    // Override socket notification handler
    socketNotificationReceived: function(notification, payload) {
        if (notification === "WAVEFORM_DATA") {
            this.updateWaveformData(payload);
        } else if (notification === "CONNECTION_STATUS") {
            this.connected = payload.connected;
            if (!payload.connected && this.config.showDebug) {
                Log.error("MMM-GeminiWaveform: Lost connection to Python backend");
            }
        }
    },

    // Create the DOM for display
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "gemini-waveform-wrapper";
        
        // Create canvas element
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        this.canvas.className = "gemini-waveform-canvas";
        
        this.ctx = this.canvas.getContext("2d");
        
        wrapper.appendChild(this.canvas);
        
        // Add connection status if debug enabled
        if (this.config.showDebug) {
            const status = document.createElement("div");
            status.className = "gemini-waveform-status";
            status.innerHTML = `Status: <span class="${this.connected ? 'connected' : 'disconnected'}">${this.connected ? 'Connected' : 'Disconnected'}</span>`;
            wrapper.appendChild(status);
        }
        
        return wrapper;
    },

    // Add custom styles
    getStyles: function() {
        return ["MMM-GeminiWaveform.css"];
    },

    // Update waveform data from Python backend
    updateWaveformData: function(data) {
        if (data.amplitude !== undefined) {
            this.targetAmplitude = data.amplitude;
            this.lastDataTime = Date.now();
        }
        if (data.phase !== undefined) {
            this.wavePhase = data.phase;
        }
    },

    // Animation loop
    animateWaveform: function() {
        if (!this.ctx) {
            this.animationFrame = requestAnimationFrame(this.animateWaveform.bind(this));
            return;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update amplitude with smooth interpolation
        this.currentAmplitude += (this.targetAmplitude - this.currentAmplitude) * 0.18;

        // Check for idle state
        const timeSinceData = Date.now() - this.lastDataTime;
        let effectiveAmplitude = this.currentAmplitude;
        
        if (timeSinceData > 250) { // 250ms idle threshold
            // Apply idle amplitude with breathing effect
            const idleAmp = this.config.idleAmplitude * (0.6 + 0.4 * Math.sin(this.wavePhase * 0.6));
            effectiveAmplitude = Math.max(this.currentAmplitude, idleAmp);
            
            // Decay target amplitude
            this.targetAmplitude *= 0.96;
        }

        // Update wave phase
        this.wavePhase += this.config.animationSpeed;

        // Draw waveform
        this.drawWaveform(effectiveAmplitude);

        // Continue animation
        this.animationFrame = requestAnimationFrame(this.animateWaveform.bind(this));
    },

    // Draw the waveform
    drawWaveform: function(amplitude) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Calculate number of points
        const numPoints = Math.min(200, width);
        const margin = Math.max(12, 6 + amplitude * 6);
        
        // Create wave points
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const x = margin + t * (width - 2 * margin);
            
            // Multi-harmonic wave for organic motion
            const w1 = Math.sin(this.wavePhase + t * 4 * Math.PI) * 0.35;
            const w2 = Math.sin(this.wavePhase * 1.7 + t * 7 * Math.PI) * 0.22;
            const w3 = Math.sin(this.wavePhase * 0.8 + t * 2 * Math.PI) * 0.5;
            const wave = (w1 + w2 + w3) * amplitude;
            
            const y = height / 2 + wave * height * 0.28;
            points.push({x: x, y: y});
        }

        // Draw glow effect for high amplitude
        if (amplitude > 0.25) {
            ctx.strokeStyle = this.config.glowColor;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = (6 + amplitude * 6) * 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.filter = "blur(8px)";
            
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            ctx.filter = "none";
        }

        // Draw main waveform
        ctx.strokeStyle = this.config.waveColor;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 6 + amplitude * 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        
        // Draw end caps
        const capRadius = ctx.lineWidth / 2;
        ctx.fillStyle = this.config.waveColor;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, capRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(points[points.length - 1].x, points[points.length - 1].y, capRadius, 0, 2 * Math.PI);
        ctx.fill();
    },

    // Handle module suspension
    suspend: function() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    },

    // Handle module resume
    resume: function() {
        if (!this.animationFrame) {
            this.animateWaveform();
        }
    }
});
