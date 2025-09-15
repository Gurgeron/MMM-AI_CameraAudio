#!/usr/bin/env python3
"""
Bridge between Gemini audio and MagicMirror² waveform module.
This integrates the existing gcode.py with WebSocket streaming.
"""

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path

import websockets
import numpy as np
import pyaudio

# Import from current directory (no path manipulation needed)
from gcode import AudioLoop, client, MODEL, CONFIG, FORMAT, CHANNELS, RECEIVE_SAMPLE_RATE
from waveform_server import WaveformServer

logger = logging.getLogger(__name__)


class GeminiWaveformBridge(AudioLoop):
    """Extended AudioLoop that streams waveform data via WebSocket."""
    
    def __init__(self, waveform_server, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.waveform_server = waveform_server
        self.pya = pyaudio.PyAudio()  # Initialize PyAudio instance
        
        # Force headless UI by default so no local window opens when running the
        # bridge. Can be overridden with GEMINI_HEADLESS=0.
        if os.environ.get("GEMINI_HEADLESS", "1") == "1":
            class _HeadlessUI:
                def __init__(self):
                    self.is_running = True
                async def run(self):
                    while self.is_running:
                        await asyncio.sleep(3600)
                def close(self):
                    self.is_running = False
            self.waveform_ui = _HeadlessUI()
        
    async def play_audio(self):
        """Override play_audio to capture and stream waveform data."""
        stream = await asyncio.to_thread(
            self.pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
        )
        while True:
            bytestream = await self.audio_in_queue.get()
            
            # Update waveform with audio data
            if self.waveform_server.waveform_ui:
                self.waveform_server.waveform_ui.update_audio(bytestream)
            
            # Play audio
            await asyncio.to_thread(stream.write, bytestream)


async def run_gemini_with_waveform():
    """Run Gemini audio loop with waveform streaming."""
    # Create WebSocket server
    waveform_server = WaveformServer(host='0.0.0.0', port=8765)
    
    # Create Gemini bridge
    # Read video configuration from environment (set by node_helper)
    video_mode = os.environ.get("GEMINI_VIDEO_MODE", "camera")
    camera_index = int(os.environ.get("GEMINI_CAMERA_INDEX", "0"))
    
    logger.info(f"Starting GeminiWaveformBridge with video_mode={video_mode}, camera_index={camera_index}")

    audio_loop = GeminiWaveformBridge(
        waveform_server=waveform_server,
        video_mode=video_mode,
        camera_index=camera_index
    )
    
    # Start both services in parallel
    try:
        # Create tasks for both services
        server_task = asyncio.create_task(waveform_server.start())
        
        # Give server time to start
        await asyncio.sleep(1)
        
        # Start Gemini audio loop
        gemini_task = asyncio.create_task(audio_loop.run())
        
        # Wait for both tasks (they should run forever)
        await asyncio.gather(server_task, gemini_task)
    except asyncio.CancelledError:
        logger.info("Services stopped")
        # Cancel both tasks on shutdown
        server_task.cancel()
        gemini_task.cancel()
        await asyncio.gather(server_task, gemini_task, return_exceptions=True)


async def main():
    """Main entry point with signal handling."""
    loop = asyncio.get_running_loop()
    
    # Shutdown handler
    shutdown_event = asyncio.Event()
    
    def handle_shutdown():
        logger.info("Shutdown signal received")
        shutdown_event.set()
        for task in asyncio.all_tasks(loop):
            if task != asyncio.current_task():
                task.cancel()
    
    # Register signal handlers
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_shutdown)
    
    try:
        await run_gemini_with_waveform()
    except asyncio.CancelledError:
        logger.info("Main task cancelled")
    except Exception as e:
        logger.error(f"Error in main: {e}")
        raise


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
