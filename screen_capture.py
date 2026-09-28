import time
import mss
from PIL import Image


class ScreenCapture:
    def __init__(self):
        self.sct = mss.mss()

        # Primary monitor
        self.monitor = self.sct.monitors[1]

        self.width = self.monitor["width"]
        self.height = self.monitor["height"]

        print("Screen Capture Engine initialized")
        print(f"Resolution: {self.width}x{self.height}")

    def capture(self):
        """
        Capture the primary Windows monitor.

        Returns:
            PIL.Image.Image
        """

        screenshot = self.sct.grab(self.monitor)

        image = Image.frombytes(
            "RGB",
            screenshot.size,
            screenshot.rgb
        )

        return image

    def close(self):
        self.sct.close()


if __name__ == "__main__":

    print("=" * 45)
    print("ScreenPen - Phase 1")
    print("Desktop Screen Capture Test")
    print("=" * 45)

    capture_engine = ScreenCapture()

    try:
        print("\nCapturing desktop...")

        image = capture_engine.capture()

        output_file = "screen_capture_test.jpg"

        image.save(
            output_file,
            "JPEG",
            quality=85
        )

        print(f"Capture saved: {output_file}")
        print(
            f"Captured size: "
            f"{image.width}x{image.height}"
        )

    finally:
        capture_engine.close()

    print("\nPhase 1 capture test completed.")