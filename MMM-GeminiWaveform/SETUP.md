# MMM-GeminiWaveform Setup Instructions

## Critical Setup Step: Create .env File

**IMPORTANT**: The module won't work without creating a `.env` file with your Gemini API key!

1. Navigate to the python-backend directory:
   ```bash
   cd ~/MagicMirror/modules/MMM-GeminiWaveform/python-backend
   ```

2. Create a `.env` file:
   ```bash
   echo "GEMINI_API_KEY=your_actual_api_key_here" > .env
   ```

3. Replace `your_actual_api_key_here` with your actual Gemini API key from:
   https://makersuite.google.com/app/apikey

## Running the Module

After creating the .env file, restart MagicMirror:

```bash
cd ~/MagicMirror
npm start
```

The module should now:
1. Start the `gemini_waveform_bridge.py` script (not just waveform_server.py)
2. Connect to Gemini AI using your API key
3. Display waveform animations when Gemini speaks

## Troubleshooting

If the waveform doesn't animate:
1. Check the terminal for "ERROR: Missing .env file" message
2. Verify your API key is correct
3. Check Python backend logs for any Gemini API errors
