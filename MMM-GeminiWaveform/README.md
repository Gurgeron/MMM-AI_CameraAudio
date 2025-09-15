# MMM-GeminiWaveform

A [MagicMirror²](https://magicmirror.builders/) module that displays a beautiful animated waveform visualization for Google Gemini AI audio responses.

![Waveform Preview](preview.png)

## Features

- 🌊 **Smooth Waveform Animation** - Beautiful white line with organic wave motion
- 🎤 **Real-time Audio Visualization** - Responds to Gemini AI voice output amplitude
- 💫 **Idle Animation** - Gentle breathing effect when no audio is playing
- ✨ **Glow Effects** - Dynamic glow for louder audio
- 🔄 **Auto-reconnect** - Handles connection drops gracefully
- ⚡ **60 FPS Animation** - Smooth, fluid motion

## Screenshots

The module displays a white waveform that animates based on the audio output from Gemini AI:
- At rest: gentle wave motion
- During speech: dynamic amplitude-based animation
- High volume: glowing effect

## Dependencies

### MagicMirror² Side
- MagicMirror² version 2.8.0 or higher
- Node.js WebSocket support (ws package)

### Python Backend
- Python 3.8 or higher
- Google Gemini API key
- Required Python packages (see installation)

## Installation

1. **Clone this repository** into your MagicMirror modules folder:
```bash
cd ~/MagicMirror/modules
git clone https://github.com/yourusername/MMM-GeminiWaveform.git
cd MMM-GeminiWaveform
```

2. **Install Node.js dependencies**:
```bash
npm install
```

3. **Set up Python backend**:
```bash
cd python-backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. **Configure API key** (REQUIRED):
Create a `.env` file in the `python-backend` directory:
```bash
echo "GEMINI_API_KEY=your_actual_api_key_here" > python-backend/.env
```
Replace `your_actual_api_key_here` with your actual API key from https://makersuite.google.com/app/apikey

## Configuration

Add the module to your `config/config.js` file:

```javascript
{
    module: "MMM-GeminiWaveform",
    position: "bottom_center",  // Or any position you prefer
    config: {
        width: 300,             // Canvas width in pixels
        height: 100,            // Canvas height in pixels
        updateInterval: 16,     // Update rate in ms (16 = 60fps)
        pythonHost: "localhost", // Python backend host
        pythonPort: 8765,       // Python backend port
        waveColor: "#ffffff",   // Main waveform color
        glowColor: "#ffffff",   // Glow effect color
        idleAmplitude: 0.06,    // Amplitude when idle
        animationSpeed: 0.35,   // Wave animation speed
        showDebug: false        // Show connection status
    }
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `width` | Width of the waveform canvas in pixels | `300` |
| `height` | Height of the waveform canvas in pixels | `100` |
| `updateInterval` | Update interval in milliseconds (16 = 60fps) | `16` |
| `pythonHost` | Hostname where Python backend is running | `"localhost"` |
| `pythonPort` | WebSocket port for Python backend | `8765` |
| `waveColor` | Color of the waveform line (CSS color) | `"#ffffff"` |
| `glowColor` | Color of the glow effect (CSS color) | `"#ffffff"` |
| `idleAmplitude` | Wave amplitude when no audio (0-1) | `0.06` |
| `animationSpeed` | Speed of wave animation | `0.35` |
| `showDebug` | Show connection status below waveform | `false` |

## Running the Module

### Option 1: Manual Start (for testing)

1. **Start the Python backend** (if testing manually):
```bash
cd ~/MagicMirror/modules/MMM-GeminiWaveform/python-backend
source venv/bin/activate
python gemini_waveform_bridge.py
```
Note: MagicMirror will automatically start this script, so manual start is only needed for testing.

2. **Start MagicMirror** (in another terminal):
```bash
cd ~/MagicMirror
npm start
```

### Option 2: Automatic Start with systemd (recommended)

Create a systemd service to automatically start the Python backend:

1. Create service file:
```bash
sudo nano /etc/systemd/system/gemini-waveform.service
```

2. Add the following content:
```ini
[Unit]
Description=Gemini Waveform Backend for MagicMirror
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/MagicMirror/modules/MMM-GeminiWaveform/python-backend
Environment="PATH=/home/pi/MagicMirror/modules/MMM-GeminiWaveform/python-backend/venv/bin"
ExecStart=/home/pi/MagicMirror/modules/MMM-GeminiWaveform/python-backend/venv/bin/python gemini_waveform_bridge.py
Environment="PYTHONPATH=/home/pi/MagicMirror/modules/MMM-GeminiWaveform/python-backend"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gemini-waveform.service
sudo systemctl start gemini-waveform.service
```

4. Check service status:
```bash
sudo systemctl status gemini-waveform.service
```

## Troubleshooting

### No waveform displayed
- Check if Python backend is running: `sudo systemctl status gemini-waveform`
- Verify WebSocket connection in browser console
- Ensure `showDebug: true` in config to see connection status

### Python backend won't start
- Check API key is set correctly in `.env` file
- Verify all Python dependencies are installed
- Check logs: `sudo journalctl -u gemini-waveform -f`

### Audio issues
- Ensure your system has audio output configured
- Check PyAudio installation: `python -c "import pyaudio"`
- On Raspberry Pi, you may need: `sudo apt-get install portaudio19-dev`

### WebSocket connection fails
- Check firewall settings
- Verify port 8765 is not in use: `netstat -an | grep 8765`
- Try changing the port in both config and Python backend

## How It Works

1. **Python Backend**: Runs the Gemini AI client and captures audio output
2. **WebSocket Bridge**: Streams waveform amplitude data to the frontend
3. **MagicMirror Module**: Renders the waveform using HTML5 Canvas
4. **Real-time Updates**: 60fps animation with smooth interpolation

## Development

### Project Structure
```
MMM-GeminiWaveform/
├── MMM-GeminiWaveform.js      # Main module file
├── node_helper.js              # Node.js backend handler
├── MMM-GeminiWaveform.css      # Module styles
├── package.json                # Node dependencies
├── README.md                   # This file
└── python-backend/             # Python Gemini integration
    ├── gemini_waveform_bridge.py
    ├── waveform_server.py
    ├── requirements.txt
    └── .env                    # API key configuration
```

### Contributing
Pull requests are welcome! Please ensure:
- Code follows existing style
- Update documentation for new features
- Test on actual MagicMirror installation

## License

MIT License - see LICENSE file for details

## Credits

- Built for [MagicMirror²](https://magicmirror.builders/)
- Uses [Google Gemini API](https://ai.google.dev/)
- Waveform animation inspired by audio visualization techniques

## Support

- Report issues on [GitHub Issues](https://github.com/yourusername/MMM-GeminiWaveform/issues)
- For MagicMirror² help, visit the [forum](https://forum.magicmirror.builders/)
- For Gemini API questions, see [Google AI documentation](https://ai.google.dev/)
