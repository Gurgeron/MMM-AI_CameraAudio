#!/bin/bash
# Installation script for MMM-GeminiWaveform

echo "Installing MMM-GeminiWaveform..."

# Check if we're in the right directory
if [ ! -f "MMM-GeminiWaveform.js" ]; then
    echo "Error: Please run this script from the MMM-GeminiWaveform directory"
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Set up Python virtual environment
echo "Setting up Python environment..."
cd python-backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  No .env file found!"
    echo "Please create python-backend/.env with your Gemini API key:"
    echo "GEMINI_API_KEY=your_api_key_here"
    echo ""
fi

# Make Python scripts executable
chmod +x gemini_waveform_bridge.py
chmod +x waveform_server.py

# Return to module root
cd ..

# Check if user wants to install systemd service
echo ""
read -p "Install systemd service for automatic startup? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Get the actual paths
    MM_PATH=$(cd ../../ && pwd)
    MODULE_PATH="$MM_PATH/modules/MMM-GeminiWaveform"
    
    # Update service file with correct paths
    sed "s|/home/pi/MagicMirror|$MM_PATH|g" gemini-waveform.service > /tmp/gemini-waveform.service
    
    # Install service
    sudo cp /tmp/gemini-waveform.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable gemini-waveform.service
    
    echo "Systemd service installed!"
    echo "Start with: sudo systemctl start gemini-waveform"
    echo "Check status: sudo systemctl status gemini-waveform"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Add your GEMINI_API_KEY to python-backend/.env"
echo "2. Add the module to your MagicMirror config.js"
echo "3. Start the Python backend (or use systemd service)"
echo "4. Restart MagicMirror"
echo ""
echo "For more information, see README.md"
