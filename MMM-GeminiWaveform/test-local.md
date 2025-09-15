# Testing MMM-GeminiWaveform on Local MagicMirror

## Quick Test Steps

### 1. Copy the Module
```bash
# Assuming your MagicMirror is at ~/MagicMirror
cp -r /Users/gur.geron/Desktop/Cursor/GeminiAPI3/MMM-GeminiWaveform ~/MagicMirror/modules/

# Or if MagicMirror is elsewhere, replace the path:
# cp -r /Users/gur.geron/Desktop/Cursor/GeminiAPI3/MMM-GeminiWaveform /path/to/your/MagicMirror/modules/
```

### 2. Install Dependencies
```bash
cd ~/MagicMirror/modules/MMM-GeminiWaveform
npm install
```

### 3. Set Up Python Backend
```bash
cd python-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Add to MagicMirror Config
Edit `~/MagicMirror/config/config.js` and add this to the modules array:

```javascript
{
    module: "MMM-GeminiWaveform",
    position: "bottom_center",  // or "top_right", "middle_center", etc.
    config: {
        width: 400,
        height: 150,
        showDebug: true  // Enable to see connection status
    }
}
```

### 5. Start the Python Backend
In one terminal:
```bash
cd ~/MagicMirror/modules/MMM-GeminiWaveform/python-backend
source venv/bin/activate
python gemini_waveform_bridge.py
```

You should see:
```
Starting WebSocket server on localhost:8765
WebSocket server listening on ws://localhost:8765
```

### 6. Start MagicMirror
In another terminal:
```bash
cd ~/MagicMirror
npm start
```

Or if you use pm2:
```bash
pm2 restart MagicMirror
```

## What You Should See

1. MagicMirror starts up
2. The waveform module appears at the position you specified
3. A white line gently waving (idle animation)
4. When you interact with Gemini (type messages), the waveform responds to audio
5. If `showDebug: true`, you'll see "Status: Connected" below the waveform

## Quick Troubleshooting

### If waveform doesn't appear:
1. Check browser console (Cmd+Option+I in Electron): Look for WebSocket errors
2. Check Python backend is running and shows "WebSocket server listening"
3. Make sure the module is in the correct position in config.js

### If "Disconnected" shows:
1. Python backend might not be running
2. Port 8765 might be blocked
3. Try restarting both Python backend and MagicMirror

### Test the Waveform Standalone
You can test just the waveform visualization:
```bash
cd ~/MagicMirror/modules/MMM-GeminiWaveform/python-backend
python waveform_server.py
```

Then open a browser to test WebSocket:
- Open browser console
- Run: `new WebSocket('ws://localhost:8765')`
- Should connect without errors

## Development Mode Testing

For easier development, you can run MagicMirror in dev mode:
```bash
cd ~/MagicMirror
npm start dev
```

This opens developer tools automatically for debugging.
