import asyncio
import io
import time

import mss
from PIL import Image
import websockets


# =========================================================
# CONFIGURATION
# =========================================================

STREAM_HOST = "0.0.0.0"
STREAM_PORT = 8766

TARGET_FPS = 10

MAX_WIDTH = 1280
MAX_HEIGHT = 720

JPEG_QUALITY = 60


# =========================================================
# SCREEN CAPTURE
# =========================================================

class ScreenCapture:

    def __init__(self):

        self.sct = mss.mss()

        # Primary monitor
        self.monitor = self.sct.monitors[1]

        self.width = self.monitor["width"]
        self.height = self.monitor["height"]

        print(
            f"Screen capture initialized: "
            f"{self.width}x{self.height}"
        )

    def capture_jpeg(self):

        screenshot = self.sct.grab(
            self.monitor
        )

        image = Image.frombytes(
            "RGB",
            screenshot.size,
            screenshot.rgb
        )

        # ---------------------------------------------
        # Resize while preserving aspect ratio
        # ---------------------------------------------

        scale = min(
            MAX_WIDTH / image.width,
            MAX_HEIGHT / image.height,
            1.0
        )

        if scale < 1.0:

            new_width = int(
                image.width * scale
            )

            new_height = int(
                image.height * scale
            )

            image = image.resize(
                (
                    new_width,
                    new_height
                ),
                Image.Resampling.LANCZOS
            )

        # ---------------------------------------------
        # JPEG compression
        # ---------------------------------------------

        buffer = io.BytesIO()

        image.save(
            buffer,
            format="JPEG",
            quality=JPEG_QUALITY,
            optimize=True
        )

        return buffer.getvalue()


    def close(self):

        self.sct.close()


# =========================================================
# STREAM SERVER
# =========================================================

capture = ScreenCapture()

clients = set()


async def stream_client(websocket):

    clients.add(websocket)

    print(
        "Screen stream client connected."
    )

    try:

        frame_interval = 1.0 / TARGET_FPS

        while True:

            start_time = time.perf_counter()

            frame = capture.capture_jpeg()

            await websocket.send(frame)

            elapsed = (
                time.perf_counter()
                - start_time
            )

            delay = max(
                0,
                frame_interval - elapsed
            )

            await asyncio.sleep(delay)

    except websockets.exceptions.ConnectionClosed:

        print(
            "Screen stream client disconnected."
        )

    except Exception as error:

        print(
            "Screen stream error:",
            error
        )

    finally:

        clients.discard(websocket)


# =========================================================
# SERVER
# =========================================================

async def main():

    print(
        "========================================"
    )

    print(
        "ScreenPen Screen Stream"
    )

    print(
        "========================================"
    )

    print(
        f"Server: "
        f"wss://0.0.0.0:{STREAM_PORT}"
    )

    print(
        f"Target FPS: {TARGET_FPS}"
    )

    print(
        f"Maximum resolution: "
        f"{MAX_WIDTH}x{MAX_HEIGHT}"
    )

    print(
        f"JPEG quality: "
        f"{JPEG_QUALITY}"
    )

    print(
        "========================================"
    )

    async with websockets.serve(
        stream_client,
        STREAM_HOST,
        STREAM_PORT,
        max_size=None
    ):

        print(
            "Screen stream server started."
        )

        await asyncio.Future()


# =========================================================
# START
# =========================================================

if __name__ == "__main__":

    try:

        asyncio.run(
            main()
        )

    except KeyboardInterrupt:

        print(
            "\nScreen stream stopped."
        )

    finally:

        capture.close()