#!/usr/bin/env python3
"""
WebSocket server for streaming waveform data to MagicMirror² module.
This bridges the Python Gemini API code with the JavaScript frontend.
"""

import asyncio
import json
import logging
import signal
import sys
import time
from pathlib import Path

import websockets
from websockets.server import WebSocketServerProtocol
import numpy as np

# Add parent directory to path to import existing modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from waveform_ui import WaveformUI
from gcode import AudioLoop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WaveformServer:
    """WebSocket server that streams waveform data from the Gemini audio."""
    
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.waveform_ui = None
        self.audio_loop = None
        self.update_interval = 0.016  # 60fps by default
        
    async def register(self, websocket: WebSocketServerProtocol) -> None:
        """Register a new client connection."""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
        
        # Send initial state
        await self.send_to_client(websocket, {
            "type": "waveform",
            "data": {
                "amplitude": 0.0,
                "phase": 0.0,
                "connected": True
            }
        })
        
    async def unregister(self, websocket: WebSocketServerProtocol) -> None:
        """Unregister a client connection."""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
        
    async def send_to_client(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        """Send a message to a specific client."""
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            await self.unregister(websocket)
        except Exception as e:
            logger.error(f"Error sending to client: {e}")
            
    async def broadcast(self, message: dict) -> None:
        """Broadcast a message to all connected clients."""
        if self.clients:
            # Create tasks for all sends
            tasks = [self.send_to_client(client, message) for client in self.clients.copy()]
            await asyncio.gather(*tasks, return_exceptions=True)
            
    async def handle_client(self, websocket: WebSocketServerProtocol) -> None:
        """Handle a client connection.
        Note: Newer versions of `websockets` pass only the websocket connection
        object to the handler (no `path` argument). This signature matches that
        behavior to avoid runtime `TypeError` when a client connects.
        """
        await self.register(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(websocket, data)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
        finally:
            await self.unregister(websocket)
            
    async def handle_message(self, websocket: WebSocketServerProtocol, data: dict) -> None:
        """Handle incoming messages from clients."""
        msg_type = data.get("type")
        
        if msg_type == "config":
            # Update configuration
            config = data.get("data", {})
            if "updateInterval" in config:
                self.update_interval = config["updateInterval"] / 1000.0  # Convert ms to seconds
                logger.info(f"Update interval set to {self.update_interval}s")
                
        elif msg_type == "ping":
            # Respond to ping
            await self.send_to_client(websocket, {"type": "pong"})
            
    async def waveform_update_loop(self) -> None:
        """Main loop that broadcasts waveform data to all clients."""
        logger.info("Starting waveform update loop")
        
        # Initialize waveform UI in headless mode
        class HeadlessWaveformUI:
            """A headless version that just tracks waveform data without rendering."""
            def __init__(self):
                self.current_amplitude = 0.0
                self.target_amplitude = 0.0
                self.wave_phase = 0.0
                self.wave_speed = 0.35
                self.idle_amplitude = 0.06
                self._last_audio_time = 0.0
                self.is_running = True
                
            def update_audio(self, audio_data):
                """Update amplitude from audio data."""
                if audio_data:
                    self._last_audio_time = time.time()
                    # Calculate amplitude from audio data
                    amp = np.abs(np.frombuffer(audio_data, dtype=np.int16)).mean() / 32768.0
                    self.target_amplitude = amp
                    
            async def run(self):
                """Headless run loop - just updates values."""
                while self.is_running:
                    # Smooth amplitude
                    self.current_amplitude += (self.target_amplitude - self.current_amplitude) * 0.18
                    
                    # Check for idle state
                    idle_dt = time.time() - self._last_audio_time
                    if idle_dt > 0.25:
                        # Apply idle amplitude
                        idle_amp = self.idle_amplitude * (0.6 + 0.4 * np.sin(self.wave_phase * 0.6))
                        self.current_amplitude = max(self.current_amplitude, idle_amp)
                        self.target_amplitude *= 0.96
                        
                    # Update phase
                    self.wave_phase += self.wave_speed
                    
                    await asyncio.sleep(0.016)
                    
            def close(self):
                self.is_running = False
        
        self.waveform_ui = HeadlessWaveformUI()
        
        # Start the headless waveform update
        waveform_task = asyncio.create_task(self.waveform_ui.run())
        
        try:
            while True:
                # Broadcast current waveform state
                await self.broadcast({
                    "type": "waveform",
                    "data": {
                        "amplitude": self.waveform_ui.current_amplitude,
                        "phase": self.waveform_ui.wave_phase,
                        "timestamp": time.time()
                    }
                })
                
                await asyncio.sleep(self.update_interval)
                
        except asyncio.CancelledError:
            logger.info("Waveform update loop cancelled")
            self.waveform_ui.close()
            await waveform_task
            raise
            
    def get_waveform_updater(self):
        """Return a function that can be called to update waveform with audio data."""
        def update_audio(audio_data):
            if self.waveform_ui:
                self.waveform_ui.update_audio(audio_data)
        return update_audio
        
    async def start(self) -> None:
        """Start the WebSocket server."""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        # Start the waveform update loop
        update_task = asyncio.create_task(self.waveform_update_loop())
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info(f"WebSocket server listening on ws://{self.host}:{self.port}")
            try:
                await asyncio.Future()  # Run forever
            except asyncio.CancelledError:
                logger.info("Server shutdown requested")
                update_task.cancel()
                await update_task


async def main():
    """Main entry point."""
    server = WaveformServer()
    
    # Handle shutdown gracefully
    loop = asyncio.get_running_loop()
    
    def handle_shutdown():
        logger.info("Shutdown signal received")
        for task in asyncio.all_tasks(loop):
            task.cancel()
    
    # Register signal handlers
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_shutdown)
    
    try:
        await server.start()
    except asyncio.CancelledError:
        logger.info("Server stopped")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    try:
        import numpy  # Check if numpy is available
        asyncio.run(main())
    except ImportError:
        logger.error("NumPy is required. Please install it: pip install numpy")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
