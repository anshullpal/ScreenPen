import sys
import asyncio
import json
import io
import threading
import queue
import math
import socket
import qrcode
from urllib.parse import urlencode
import ssl
import ipaddress
from pathlib import Path
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import websockets
from screen_stream import ScreenCapture

from PySide6.QtCore import (
    Qt,
    QPoint,
    QTimer,
    QRect
)

from PySide6.QtGui import (
    QPainter,
    QPen,
    QColor,
    QPixmap 
)

from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QLabel,
    QPushButton,
    QVBoxLayout
)

# =========================================================
# GLOBAL INPUT QUEUE
# =========================================================

input_queue = queue.Queue()

# =========================================================
# NETWORK
# =========================================================

def get_local_ip():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except Exception:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("1.1.1.1", 80))
            ip = sock.getsockname()[0]
            sock.close()
            return ip
        except Exception:
            return "127.0.0.1"

CERT_DIR = Path("certificates")
CA_CERT_FILE = CERT_DIR / "screenpen_ca.crt"
CA_KEY_FILE = CERT_DIR / "screenpen_ca.key"
SERVER_CERT_FILE = CERT_DIR / "screenpen_server.crt"
SERVER_KEY_FILE = CERT_DIR / "screenpen_server.key"


def create_private_key():
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )


def save_private_key(key, path):
    path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        )
    )


def load_private_key(path):
    return serialization.load_pem_private_key(
        path.read_bytes(),
        password=None
    )


def create_certificate(ip):
    CERT_DIR.mkdir(exist_ok=True)

    if not CA_KEY_FILE.exists() or not CA_CERT_FILE.exists():
        ca_key = create_private_key()

        ca_subject = x509.Name([
            x509.NameAttribute(
                NameOID.COUNTRY_NAME,
                "US"
            ),
            x509.NameAttribute(
                NameOID.ORGANIZATION_NAME,
                "ScreenPen"
            ),
            x509.NameAttribute(
                NameOID.COMMON_NAME,
                "ScreenPen Local CA"
            )
        ])

        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_subject)
            .issuer_name(ca_subject)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(
                datetime.now(timezone.utc)
            )
            .not_valid_after(
                datetime.now(timezone.utc)
                + timedelta(days=3650)
            )
            .add_extension(
                x509.BasicConstraints(
                    ca=True,
                    path_length=None
                ),
                critical=True
            )
            .sign(
                ca_key,
                hashes.SHA256()
            )
        )

        save_private_key(
            ca_key,
            CA_KEY_FILE
        )

        CA_CERT_FILE.write_bytes(
            ca_cert.public_bytes(
                serialization.Encoding.PEM
            )
        )

    ca_key = load_private_key(
        CA_KEY_FILE
    )

    ca_cert = x509.load_pem_x509_certificate(
        CA_CERT_FILE.read_bytes()
    )

    server_key = create_private_key()

    server_subject = x509.Name([
        x509.NameAttribute(
            NameOID.ORGANIZATION_NAME,
            "ScreenPen"
        ),
        x509.NameAttribute(
            NameOID.COMMON_NAME,
            ip
        )
    ])

    server_cert = (
        x509.CertificateBuilder()
        .subject_name(server_subject)
        .issuer_name(ca_cert.subject)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(
            datetime.now(timezone.utc)
            - timedelta(minutes=1)
        )
        .not_valid_after(
            datetime.now(timezone.utc)
            + timedelta(days=825)
        )
        .add_extension(
            x509.SubjectAlternativeName([
                x509.IPAddress(
                    ipaddress.ip_address(ip)
                )
            ]),
            critical=False
        )
        .add_extension(
            x509.BasicConstraints(
                ca=False,
                path_length=None
            ),
            critical=True
        )
        .sign(
            ca_key,
            hashes.SHA256()
        )
    )

    save_private_key(
        server_key,
        SERVER_KEY_FILE
    )

    SERVER_CERT_FILE.write_bytes(
        server_cert.public_bytes(
            serialization.Encoding.PEM
        )
    )

    return (
        SERVER_CERT_FILE,
        SERVER_KEY_FILE
    )

def generate_connection_qr():
    ip = get_local_ip()
    if ip.startswith("127."):
        print("No usable LAN IP detected.")
        return None
    connection_data = "screenpen://connect?" + urlencode({
        "host": ip,
        "control": 8765,
        "screen": 8766
    })
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4
    )
    qr.add_data(connection_data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white")

# =========================================================
# WEBSOCKET SERVER
# =========================================================

async def websocket_handler(websocket):
    print("Tablet connected!")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                input_queue.put(data)
            except json.JSONDecodeError:
                print("Invalid JSON received")
    except websockets.exceptions.ConnectionClosed:
        print("Tablet disconnected")
    except Exception as error:
        print("WebSocket error:", error)

async def websocket_server():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        certfile=SERVER_CERT_FILE,
        keyfile=SERVER_KEY_FILE
    )
    async with websockets.serve(
        websocket_handler,
        "0.0.0.0",
        8765,
        ssl=ssl_context
    ):
        print("Secure WebSocket server running on port 8765 (WSS)")
        await asyncio.Future()

def start_websocket_server():
    asyncio.run(websocket_server())
    
# =========================================================
# SCREEN STREAM SERVER
# =========================================================

async def screen_stream_handler(websocket):
    print("Screen stream client connected!")

    capture_engine = ScreenCapture()

    try:
        while True:
            jpeg_data = capture_engine.capture_jpeg()

            await websocket.send(jpeg_data)

            await asyncio.sleep(0.1)

    except websockets.exceptions.ConnectionClosed:
        print("Screen stream client disconnected")

    except Exception as error:
        print("Screen stream error:", error)

    finally:
        capture_engine.close()


async def screen_stream_server():
    ssl_context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_SERVER
    )
    ssl_context.load_cert_chain(
        certfile=SERVER_CERT_FILE,
        keyfile=SERVER_KEY_FILE
    )
    async with websockets.serve(
        screen_stream_handler,
        "0.0.0.0",
        8766,
        ssl=ssl_context
    ):
        print(
            "Secure screen stream server "
            "running on port 8766 (WSS)"
        )
        await asyncio.Future()


def start_screen_stream_server():
    asyncio.run(
        screen_stream_server()
    )

# =========================================================
# SCREENPEN
# =========================================================

class ScreenPen(QWidget):

    def __init__(self):
        super().__init__()

        # -------------------------------------------------
        # WINDOW
        # -------------------------------------------------

        self.setWindowTitle(
            "ScreenPen Overlay"
        )

        self.setWindowFlags(
            Qt.FramelessWindowHint
            |
            Qt.WindowStaysOnTopHint
            |
            Qt.Tool
        )

        self.setAttribute(
            Qt.WA_TranslucentBackground,
            True
        )

        self.setAttribute(
            Qt.WA_NoSystemBackground,
            True
        )

        self.setAttribute(
            Qt.WA_TransparentForMouseEvents,
            True
        )

        screen = QApplication.primaryScreen()

        self.setGeometry(
            screen.geometry()
        )

        # -------------------------------------------------
        # TOOL STATE
        # -------------------------------------------------

        self.current_tool = "pen"

        self.current_color = QColor(
            255,
            0,
            0
        )

        self.current_size = 5

        self.eraser_size = 20

        # -------------------------------------------------
        # OBJECT STORAGE
        # -------------------------------------------------

        self.objects = []

        self.next_object_id = 1

        # -------------------------------------------------
        # CURRENT DRAWING
        # -------------------------------------------------

        self.drawing = False

        self.start_point = QPoint()

        self.current_point = QPoint()

        self.current_stroke = None

        # -------------------------------------------------
        # MOVE STATE
        # -------------------------------------------------

        self.moving = False

        self.moving_object_id = None

        # -------------------------------------------------
        # OVERLAY
        # -------------------------------------------------

        self.overlay_enabled = True

        # -------------------------------------------------
        # INPUT TIMER
        # -------------------------------------------------

        self.timer = QTimer()

        self.timer.timeout.connect(
            self.process_input
        )

        self.timer.start(5)

    # =====================================================
    # PROCESS INPUT
    # =====================================================

    def process_input(self):

        while True:

            try:

                data = input_queue.get_nowait()

            except queue.Empty:

                break

            self.handle_input(
                data
            )

    # =====================================================
    # HANDLE INPUT
    # =====================================================

    def handle_input(
        self,
        data
    ):

        if not isinstance(data, dict):

            return

        data_type = data.get(
            "type"
        )

        # -------------------------------------------------
        # COMMAND
        # -------------------------------------------------

        if data_type == "command":

            self.handle_command(
                data.get("command"),
                data.get("value"),
                data
            )

            return

        # -------------------------------------------------
        # POINTER
        # -------------------------------------------------

        if data_type == "pointer":

            self.handle_pointer(
                data
            )

    # =====================================================
    # COMMANDS
    # =====================================================

    def handle_command(
        self,
        command,
        value=None,
        data=None
    ):

        # -------------------------------------------------
        # TOOL
        # -------------------------------------------------

        if (
            isinstance(command, str)
            and
            command.startswith("tool:")
        ):

            self.current_tool = (
                command.split(
                    ":",
                    1
                )[1]
            )

            self.moving = False

            self.moving_object_id = None

            print(
                "Tool:",
                self.current_tool
            )

            return

        # -------------------------------------------------
        # COLOR
        # -------------------------------------------------

        if command == "color":

            if value:

                try:

                    self.current_color = QColor(
                        value
                    )

                except Exception:

                    pass

            return

        # -------------------------------------------------
        # SIZE
        # -------------------------------------------------

        if command == "size":

            try:

                self.current_size = float(
                    value
                )

            except Exception:

                pass

            return

        # -------------------------------------------------
        # ERASER SIZE
        # -------------------------------------------------

        if command == "eraser_size":

            try:

                self.eraser_size = float(
                    value
                )

            except Exception:

                pass

            return

        # -------------------------------------------------
        # CLEAR
        # -------------------------------------------------

        if command == "clear":

            self.objects.clear()

            self.current_stroke = None

            self.drawing = False

            self.moving = False

            self.moving_object_id = None

            self.update()

            return

        # -------------------------------------------------
        # UNDO
        # -------------------------------------------------

        if command == "undo":

            if self.objects:

                self.objects.pop()

                self.update()

            return

        # -------------------------------------------------
        # EXIT
        # -------------------------------------------------

        if command == "exit":

            QApplication.quit()

            return

        # -------------------------------------------------
        # OVERLAY
        # -------------------------------------------------

        if command == "overlay":

            if value is not None:

                self.overlay_enabled = bool(
                    value
                )

                self.update()

            return

        # -------------------------------------------------
        # MOVE
        # -------------------------------------------------

        if command == "move":

            object_id = data.get(
                "objectId"
            )

            dx_ratio = data.get(
                "dxRatio",
                0
            )

            dy_ratio = data.get(
                "dyRatio",
                0
            )

            self.move_object(
                object_id,
                dx_ratio,
                dy_ratio
            )

            return

        # -------------------------------------------------
        # MOVE END
        # -------------------------------------------------

        if command == "move_end":

            self.moving = False

            self.moving_object_id = None

            self.update()

            return

    # =====================================================
    # POINTER HANDLING
    # =====================================================

    def handle_pointer(
        self,
        data
    ):

        action = data.get(
            "action"
        )

        x_ratio = data.get(
            "x",
            0
        )

        y_ratio = data.get(
            "y",
            0
        )

        try:

            x = float(
                x_ratio
            ) * self.width()

            y = float(
                y_ratio
            ) * self.height()

        except Exception:

            return

        point = QPoint(
            int(x),
            int(y)
        )

        if action == "down":

            self.pointer_down(
                point,
                data
            )

        elif action == "move":

            self.pointer_move(
                point,
                data
            )

        elif action == "up":

            self.pointer_up(
                point,
                data
            )

    # =====================================================
    # POINTER DOWN
    # =====================================================

    def pointer_down(
        self,
        point,
        data=None
    ):

        self.start_point = point

        self.current_point = point

        if self.current_tool in (
            "pen",
            "highlighter",
            "eraser"
        ):

            self.drawing = True

            self.current_stroke = {
                "id": self.next_object_id,
                "type": "stroke",
                "tool": self.current_tool,
                "color": self.current_color.name(),
                "size": self.current_size,
                "points": [
                    point
                ]
            }

            self.next_object_id += 1

            self.objects.append(
                self.current_stroke
            )

            self.update()

            return

        if self.current_tool in (
            "arrow",
            "rectangle",
            "circle"
        ):

            self.drawing = True

            self.current_stroke = {
                "id": self.next_object_id,
                "type": self.current_tool,
                "color": self.current_color.name(),
                "size": self.current_size,
                "start": point,
                "end": point
            }

            self.next_object_id += 1

            self.objects.append(
                self.current_stroke
            )

            self.update()

            return

    # =====================================================
    # POINTER MOVE
    # =====================================================

    def pointer_move(
        self,
        point,
        data=None
    ):

        if not self.drawing:

            return

        self.current_point = point

        if not self.current_stroke:

            return

        if self.current_stroke.get(
            "type"
        ) == "stroke":

            self.current_stroke[
                "points"
            ].append(
                point
            )

        else:

            self.current_stroke[
                "end"
            ] = point

        self.update()

    # =====================================================
    # POINTER UP
    # =====================================================

    def pointer_up(
        self,
        point,
        data=None
    ):

        if not self.drawing:

            return

        self.current_point = point

        if self.current_stroke:

            if self.current_stroke.get(
                "type"
            ) == "stroke":

                self.current_stroke[
                    "points"
                ].append(
                    point
                )

            else:

                self.current_stroke[
                    "end"
                ] = point

        self.drawing = False

        self.current_stroke = None

        self.update()

    # =====================================================
    # MOVE OBJECT
    # =====================================================

    def move_object(
        self,
        object_id,
        dx_ratio,
        dy_ratio
    ):

        if object_id is None:

            return

        try:

            dx = (
                float(dx_ratio)
                *
                self.width()
            )

            dy = (
                float(dy_ratio)
                *
                self.height()
            )

        except Exception:

            return

        target = None

        for obj in self.objects:

            if (
                obj.get("id")
                ==
                object_id
            ):

                target = obj

                break

        if target is None:

            return

        if target.get(
            "type"
        ) == "stroke":

            points = target.get(
                "points",
                []
            )

            for index, point in enumerate(
                points
            ):

                points[index] = QPoint(
                    int(point.x() + dx),
                    int(point.y() + dy)
                )

        else:

            start = target.get(
                "start"
            )

            end = target.get(
                "end"
            )

            if start is not None:

                target["start"] = QPoint(
                    int(start.x() + dx),
                    int(start.y() + dy)
                )

            if end is not None:

                target["end"] = QPoint(
                    int(end.x() + dx),
                    int(end.y() + dy)
                )

        self.update()

    # =====================================================
    # PAINT EVENT
    # =====================================================

    def paintEvent(
        self,
        event
    ):

        if not self.overlay_enabled:

            return

        painter = QPainter(
            self
        )

        painter.setRenderHint(
            QPainter.Antialiasing
        )

        for obj in self.objects:

            self.draw_object(
                painter,
                obj
            )

        if (
            self.drawing
            and
            self.current_stroke
        ):

            self.draw_object(
                painter,
                self.current_stroke,
                preview=True
            )

    # =====================================================
    # DRAW OBJECT
    # =====================================================

    def draw_object(
        self,
        painter,
        obj,
        preview=False
    ):

        object_type = obj.get(
            "type"
        )

        color = QColor(
            obj.get(
                "color",
                "#ff0000"
            )
        )

        size = float(
            obj.get(
                "size",
                5
            )
        )

        tool = obj.get(
            "tool",
            ""
        )

        if tool == "highlighter":

            color.setAlpha(
                100
            )

        elif tool == "eraser":

            color = QColor(
                0,
                0,
                0,
                0
            )

        pen = QPen(
            color,
            size,
            Qt.SolidLine,
            Qt.RoundCap,
            Qt.RoundJoin
        )

        painter.setPen(
            pen
        )

        if object_type == "stroke":

            points = obj.get(
                "points",
                []
            )

            if len(points) < 2:

                if points:

                    painter.drawPoint(
                        points[0]
                    )

                return

            for i in range(
                1,
                len(points)
            ):

                painter.drawLine(
                    points[i - 1],
                    points[i]
                )

            return

        start = obj.get(
            "start"
        )

        end = obj.get(
            "end"
        )

        if (
            start is None
            or
            end is None
        ):

            return

        if object_type == "arrow":

            self.draw_arrow(
                painter,
                start,
                end,
                color,
                size
            )

        elif object_type == "rectangle":

            painter.drawRect(
                QRect(
                    start,
                    end
                ).normalized()
            )

        elif object_type == "circle":

            painter.drawEllipse(
                QRect(
                    start,
                    end
                ).normalized()
            )

    # =====================================================
    # SHAPE PREVIEW
    # =====================================================

    def draw_shape_preview(
        self,
        painter
    ):

        pen = QPen(
            self.current_color,
            self.current_size,
            Qt.DashLine
        )

        painter.setPen(
            pen
        )

        if self.current_tool == "arrow":

            self.draw_arrow(
                painter,
                self.start_point,
                self.current_point,
                self.current_color,
                self.current_size
            )

        elif self.current_tool == "rectangle":

            painter.drawRect(
                QRect(
                    self.start_point,
                    self.current_point
                ).normalized()
            )

        elif self.current_tool == "circle":

            painter.drawEllipse(
                QRect(
                    self.start_point,
                    self.current_point
                ).normalized()
            )

    # =====================================================
    # ARROW
    # =====================================================

    def draw_arrow(
        self,
        painter,
        start,
        end,
        color,
        size
    ):

        pen = QPen(
            color,
            size,
            Qt.SolidLine,
            Qt.RoundCap,
            Qt.RoundJoin
        )

        painter.setPen(
            pen
        )

        painter.drawLine(
            start,
            end
        )

        p1, p2 = (
            self.get_arrow_head_points(
                start,
                end,
                size
            )
        )

        painter.drawLine(
            end,
            p1
        )

        painter.drawLine(
            end,
            p2
        )

    # =====================================================
    # ARROW HEAD
    # =====================================================

    def get_arrow_head_points(
        self,
        start,
        end,
        size
    ):

        dx = end.x() - start.x()

        dy = end.y() - start.y()

        length = math.sqrt(
            dx * dx +
            dy * dy
        )

        if length == 0:

            return (
                end,
                end
            )

        ux = dx / length

        uy = dy / length

        arrow_length = max(
            10,
            size * 4
        )

        arrow_width = arrow_length * 0.5

        base_x = (
            end.x()
            -
            ux * arrow_length
        )

        base_y = (
            end.y()
            -
            uy * arrow_length
        )

        p1 = QPoint(
            int(
                base_x
                +
                (-uy * arrow_width)
            ),
            int(
                base_y
                +
                (ux * arrow_width)
            )
        )

        p2 = QPoint(
            int(
                base_x
                -
                (-uy * arrow_width)
            ),
            int(
                base_y
                -
                (ux * arrow_width)
            )
        )

        return (
            p1,
            p2
        )

# =========================================================
# QR CONNECTION WINDOW
# =========================================================

class QRWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ScreenPen - Connect Tablet")
        self.setFixedSize(420, 540)
        self.setWindowFlags(
            Qt.Window
            | Qt.WindowStaysOnTopHint
        )
        self.qr_label = QLabel()
        self.ip_label = QLabel()
        self.refresh_button = QPushButton("Refresh QR")
        self.close_button = QPushButton("Close")
        layout = QVBoxLayout(self)
        title = QLabel("Connect Tablet")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(
            "font-size:24px;font-weight:bold;"
        )
        self.qr_label.setAlignment(Qt.AlignCenter)
        self.ip_label.setAlignment(Qt.AlignCenter)
        self.ip_label.setStyleSheet(
            "font-size:15px;"
        )
        self.refresh_button.clicked.connect(
            self.refresh_qr
        )
        self.close_button.clicked.connect(
            self.close
        )
        layout.addWidget(title)
        layout.addWidget(self.qr_label)
        layout.addWidget(self.ip_label)
        layout.addWidget(self.refresh_button)
        layout.addWidget(self.close_button)
        self.refresh_qr()

    def refresh_qr(self):
        image = generate_connection_qr()
        if image is None:
            self.qr_label.setText(
                "Unable to detect LAN IP"
            )
            self.ip_label.setText(
                "Connect your PC to a network and try again."
            )
            return
        ip = get_local_ip()
        self.ip_label.setText(
            f"PC IP: {ip}\n"
            "Control: 8765   Screen: 8766"
        )
        image = image.convert("RGB")
        image.save("screenpen_qr.png")
        pixmap = QPixmap("screenpen_qr.png")
        self.qr_label.setPixmap(
            pixmap.scaled(
                330,
                330,
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            )
        )

# =========================================================
# APPLICATION
# =========================================================

app = QApplication(sys.argv)

local_ip = get_local_ip()
create_certificate(local_ip)

window = ScreenPen()
qr_window = QRWindow()

server_thread = threading.Thread(
    target=start_websocket_server,
    daemon=True
)

server_thread.start()

screen_stream_thread = threading.Thread(
    target=start_screen_stream_server,
    daemon=True
)

screen_stream_thread.start()

window.show()
qr_window.show()

print("========================================")
print("ScreenPen started")
print("Tablet input ready")
print("PC IP:", get_local_ip())
print("QR connection window ready")
print("Pen size:", window.current_size)
print("Eraser size:", window.eraser_size)
print("Object movement support: ON")
print("========================================")

exit_code = app.exec()

sys.exit(
    exit_code
)