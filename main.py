import sys
import asyncio
import json
import threading
import queue
import math

import websockets

from PySide6.QtCore import (
    Qt,
    QPoint,
    QTimer,
    QRect
)

from PySide6.QtGui import (
    QPainter,
    QPen,
    QColor
)

from PySide6.QtWidgets import (
    QApplication,
    QWidget
)


# =========================================================
# GLOBAL INPUT QUEUE
# =========================================================

input_queue = queue.Queue()


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

    async with websockets.serve(
        websocket_handler,
        "0.0.0.0",
        8765
    ):

        print(
            "WebSocket server running on port 8765"
        )

        await asyncio.Future()


def start_websocket_server():

    asyncio.run(
        websocket_server()
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

            # Tool change exits movement mode.

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
        # BRUSH SIZE
        # -------------------------------------------------

        if command == "size":

            try:

                self.current_size = max(
                    1,
                    min(
                        50,
                        int(value)
                    )
                )

            except (
                TypeError,
                ValueError
            ):

                pass

            return

        # -------------------------------------------------
        # ERASER SIZE
        # -------------------------------------------------

        if command == "eraser_size":

            try:

                self.eraser_size = max(
                    5,
                    min(
                        100,
                        int(value)
                    )
                )

            except (
                TypeError,
                ValueError
            ):

                pass

            return

        # -------------------------------------------------
        # UNDO
        # -------------------------------------------------

        if command == "undo":

            if self.objects:

                removed = self.objects.pop()

                print(
                    "Undo:",
                    removed.get("type"),
                    removed.get("id")
                )

                self.update()

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

            print(
                "Canvas cleared"
            )

            return

        # -------------------------------------------------
        # MOVE OBJECT
        # -------------------------------------------------

        if command == "move":

            if not isinstance(
                data,
                dict
            ):

                return

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

            # ---------------------------------------------
            # CONVERT NORMALIZED DELTA
            # ---------------------------------------------

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

            except (
                TypeError,
                ValueError
            ):

                print(
                    "Invalid MOVE values:",
                    dx_ratio,
                    dy_ratio
                )

                return

            # ---------------------------------------------
            # FIND OBJECT
            # ---------------------------------------------

            obj = self.find_object(
                object_id
            )

            if obj is None:

                print(
                    "MOVE ERROR - object not found:",
                    object_id
                )

                print(
                    "Existing object IDs:",
                    [
                        obj.get("id")
                        for obj in self.objects
                    ]
                )

                return

            # ---------------------------------------------
            # DEBUG LOG
            # ---------------------------------------------

            print(
                "MOVE:",
                object_id,
                "dx=",
                dx,
                "dy=",
                dy,
                "type=",
                obj.get("type")
            )

            # ---------------------------------------------
            # MOVE
            # ---------------------------------------------

            self.move_object(
                object_id,
                dx,
                dy
            )

            self.moving = True

            self.moving_object_id = object_id

            return

        # -------------------------------------------------
        # MOVE END
        # -------------------------------------------------

        if command == "move_end":

            print(
                "MOVE END:",
                self.moving_object_id
            )

            self.moving = False

            self.moving_object_id = None

            return

        # -------------------------------------------------
        # TOGGLE OVERLAY
        # -------------------------------------------------

        if command == "toggle_overlay":

            if self.overlay_enabled:

                self.overlay_enabled = False

                self.hide()

            else:

                self.overlay_enabled = True

                self.show()

                self.raise_()

            return

        # -------------------------------------------------
        # EXIT
        # -------------------------------------------------

        if command == "exit":

            QApplication.quit()

            return

    # =====================================================
    # CONVERT TABLET POINT
    # =====================================================

    def convert_point(
        self,
        data
    ):

        x = data.get("x")

        y = data.get("y")

        width = data.get(
            "canvasWidth"
        )

        height = data.get(
            "canvasHeight"
        )

        if (
            x is None
            or
            y is None
            or
            not width
            or
            not height
        ):

            return None

        try:

            screen_x = (
                float(x)
                /
                float(width)
            ) * self.width()

            screen_y = (
                float(y)
                /
                float(height)
            ) * self.height()

        except (
            TypeError,
            ValueError,
            ZeroDivisionError
        ):

            return None

        return QPoint(
            int(screen_x),
            int(screen_y)
        )

    # =====================================================
    # POINTER HANDLER
    # =====================================================

    def handle_pointer(
        self,
        data
    ):

        point = self.convert_point(
            data
        )

        if point is None:

            return

        event_type = data.get(
            "event"
        )

        # -------------------------------------------------
        # POINTER DOWN
        # -------------------------------------------------

        if event_type == "down":

            self.drawing = True

            self.start_point = QPoint(
                point
            )

            self.current_point = QPoint(
                point
            )

            # ---------------------------------------------
            # PEN / HIGHLIGHTER
            # ---------------------------------------------

            if self.current_tool in (
                "pen",
                "highlighter"
            ):

                self.current_stroke = {

                    "type":
                        self.current_tool,

                    "id":
                        self.next_object_id,

                    "points":
                        [
                            QPoint(point)
                        ],

                    "color":
                        QColor(
                            self.current_color
                        ),

                    "size":
                        self.current_size
                }

                self.next_object_id += 1

                self.update()

                return

            # ---------------------------------------------
            # ERASER
            # ---------------------------------------------

            if self.current_tool == "eraser":

                self.erase_at(
                    point
                )

                self.update()

                return

            # ---------------------------------------------
            # SHAPES
            # ---------------------------------------------

            if self.current_tool in (
                "arrow",
                "rectangle",
                "circle"
            ):

                self.update()

                return

        # -------------------------------------------------
        # POINTER MOVE
        # -------------------------------------------------

        if event_type == "move":

            if not self.drawing:

                return

            self.current_point = QPoint(
                point
            )

            # ---------------------------------------------
            # PEN / HIGHLIGHTER
            # ---------------------------------------------

            if self.current_stroke:

                self.current_stroke[
                    "points"
                ].append(
                    QPoint(point)
                )

                self.update()

                return

            # ---------------------------------------------
            # ERASER
            # ---------------------------------------------

            if self.current_tool == "eraser":

                self.erase_at(
                    point
                )

                self.update()

                return

            # ---------------------------------------------
            # SHAPES
            # ---------------------------------------------

            self.update()

            return

        # -------------------------------------------------
        # POINTER UP
        # -------------------------------------------------

        if event_type == "up":

            if not self.drawing:

                return

            self.current_point = QPoint(
                point
            )

            # ---------------------------------------------
            # PEN / HIGHLIGHTER
            # ---------------------------------------------

            if self.current_stroke:

                self.current_stroke[
                    "points"
                ].append(
                    QPoint(point)
                )

                self.objects.append(
                    self.current_stroke
                )

                print(
                    "Created:",
                    self.current_stroke.get("type"),
                    self.current_stroke.get("id")
                )

                self.current_stroke = None

            # ---------------------------------------------
            # ARROW
            # ---------------------------------------------

            elif self.current_tool == "arrow":

                object_id = (
                    self.next_object_id
                )

                self.objects.append({

                    "type":
                        "arrow",

                    "id":
                        object_id,

                    "start":
                        QPoint(
                            self.start_point
                        ),

                    "end":
                        QPoint(point),

                    "color":
                        QColor(
                            self.current_color
                        ),

                    "size":
                        self.current_size
                })

                self.next_object_id += 1

                print(
                    "Created:",
                    "arrow",
                    object_id
                )

            # ---------------------------------------------
            # RECTANGLE
            # ---------------------------------------------

            elif self.current_tool == "rectangle":

                object_id = (
                    self.next_object_id
                )

                self.objects.append({

                    "type":
                        "rectangle",

                    "id":
                        object_id,

                    "rect":
                        QRect(
                            self.start_point,
                            point
                        ).normalized(),

                    "color":
                        QColor(
                            self.current_color
                        ),

                    "size":
                        self.current_size
                })

                self.next_object_id += 1

                print(
                    "Created:",
                    "rectangle",
                    object_id
                )

            # ---------------------------------------------
            # CIRCLE
            # ---------------------------------------------

            elif self.current_tool == "circle":

                object_id = (
                    self.next_object_id
                )

                self.objects.append({

                    "type":
                        "circle",

                    "id":
                        object_id,

                    "rect":
                        QRect(
                            self.start_point,
                            point
                        ).normalized(),

                    "color":
                        QColor(
                            self.current_color
                        ),

                    "size":
                        self.current_size
                })

                self.next_object_id += 1

                print(
                    "Created:",
                    "circle",
                    object_id
                )

            # ---------------------------------------------
            # ERASER
            # ---------------------------------------------

            elif self.current_tool == "eraser":

                self.erase_at(
                    point
                )

            self.drawing = False

            self.update()

    # =====================================================
    # FIND OBJECT
    # =====================================================

    def find_object(
        self,
        object_id
    ):

        for obj in self.objects:

            if obj.get("id") == object_id:

                return obj

        return None

    # =====================================================
    # MOVE OBJECT
    # =====================================================

    def move_object(
        self,
        object_id,
        dx,
        dy
    ):

        obj = self.find_object(
            object_id
        )

        if obj is None:

            return False

        try:

            dx = float(dx)

            dy = float(dy)

        except (
            TypeError,
            ValueError
        ):

            return False

        obj_type = obj.get(
            "type"
        )

        # -------------------------------------------------
        # PEN / HIGHLIGHTER
        # -------------------------------------------------

        if obj_type in (
            "pen",
            "highlighter"
        ):

            for point in obj.get(
                "points",
                []
            ):

                point.setX(
                    point.x()
                    +
                    int(round(dx))
                )

                point.setY(
                    point.y()
                    +
                    int(round(dy))
                )

        # -------------------------------------------------
        # ARROW
        # -------------------------------------------------

        elif obj_type == "arrow":

            obj["start"].setX(
                obj["start"].x()
                +
                int(round(dx))
            )

            obj["start"].setY(
                obj["start"].y()
                +
                int(round(dy))
            )

            obj["end"].setX(
                obj["end"].x()
                +
                int(round(dx))
            )

            obj["end"].setY(
                obj["end"].y()
                +
                int(round(dy))
            )

        # -------------------------------------------------
        # RECTANGLE / CIRCLE
        # -------------------------------------------------

        elif obj_type in (
            "rectangle",
            "circle"
        ):

            obj["rect"].translate(
                int(round(dx)),
                int(round(dy))
            )

        else:

            return False

        self.update()

        return True

    # =====================================================
    # ERASER
    # =====================================================

    def erase_at(
        self,
        point
    ):

        radius = max(
            5,
            self.eraser_size
        )

        remaining = []

        for obj in self.objects:

            if self.object_hit_by_eraser(
                obj,
                point,
                radius
            ):

                print(
                    "Erased:",
                    obj.get("type"),
                    obj.get("id")
                )

                continue

            remaining.append(
                obj
            )

        self.objects = remaining

    # =====================================================
    # OBJECT HIT TEST
    # =====================================================

    def object_hit_by_eraser(
        self,
        obj,
        point,
        radius
    ):

        obj_type = obj.get(
            "type"
        )

        # -------------------------------------------------
        # PEN / HIGHLIGHTER
        # -------------------------------------------------

        if obj_type in (
            "pen",
            "highlighter"
        ):

            points = obj.get(
                "points",
                []
            )

            stroke_size = obj.get(
                "size",
                5
            )

            if obj_type == "highlighter":

                stroke_size *= 4

            if len(points) == 1:

                return (
                    math.hypot(
                        point.x()
                        -
                        points[0].x(),

                        point.y()
                        -
                        points[0].y()
                    )
                    <=
                    radius +
                    stroke_size / 2
                )

            for i in range(
                1,
                len(points)
            ):

                if (
                    self.distance_to_segment(
                        point,
                        points[i - 1],
                        points[i]
                    )
                    <=
                    radius +
                    stroke_size / 2
                ):

                    return True

            return False

        # -------------------------------------------------
        # ARROW
        # -------------------------------------------------

        if obj_type == "arrow":

            start = obj["start"]

            end = obj["end"]

            size = obj.get(
                "size",
                5
            )

            if (
                self.distance_to_segment(
                    point,
                    start,
                    end
                )
                <=
                radius +
                size / 2
            ):

                return True

            p1, p2 = (
                self.get_arrow_head_points(
                    start,
                    end,
                    size
                )
            )

            return (
                self.distance_to_segment(
                    point,
                    end,
                    p1
                )
                <= radius

                or

                self.distance_to_segment(
                    point,
                    end,
                    p2
                )
                <= radius
            )

        # -------------------------------------------------
        # RECTANGLE
        # -------------------------------------------------

        if obj_type == "rectangle":

            return self.point_near_rectangle(
                point,
                obj["rect"],
                radius
            )

        # -------------------------------------------------
        # CIRCLE
        # -------------------------------------------------

        if obj_type == "circle":

            return self.point_near_circle(
                point,
                obj["rect"],
                radius
            )

        return False

    # =====================================================
    # RECTANGLE HIT
    # =====================================================

    def point_near_rectangle(
        self,
        point,
        rect,
        radius
    ):

        left = rect.left()

        right = rect.right()

        top = rect.top()

        bottom = rect.bottom()

        segments = [

            (
                QPoint(left, top),
                QPoint(right, top)
            ),

            (
                QPoint(right, top),
                QPoint(right, bottom)
            ),

            (
                QPoint(right, bottom),
                QPoint(left, bottom)
            ),

            (
                QPoint(left, bottom),
                QPoint(left, top)
            )
        ]

        for start, end in segments:

            if (
                self.distance_to_segment(
                    point,
                    start,
                    end
                )
                <= radius
            ):

                return True

        return False

    # =====================================================
    # CIRCLE HIT
    # =====================================================

    def point_near_circle(
        self,
        point,
        rect,
        radius
    ):

        center_x = (
            rect.left()
            +
            rect.width() / 2
        )

        center_y = (
            rect.top()
            +
            rect.height() / 2
        )

        rx = (
            abs(rect.width())
            /
            2
        )

        ry = (
            abs(rect.height())
            /
            2
        )

        if rx == 0 or ry == 0:

            return False

        dx = (
            point.x()
            -
            center_x
        )

        dy = (
            point.y()
            -
            center_y
        )

        normalized = math.sqrt(

            (
                dx * dx
                /
                (rx * rx)
            )

            +

            (
                dy * dy
                /
                (ry * ry)
            )
        )

        distance_from_edge = (

            abs(
                normalized - 1
            )

            *

            min(
                rx,
                ry
            )
        )

        return (
            distance_from_edge
            <=
            radius
        )

    # =====================================================
    # DISTANCE TO SEGMENT
    # =====================================================

    def distance_to_segment(
        self,
        point,
        start,
        end
    ):

        px = point.x()

        py = point.y()

        x1 = start.x()

        y1 = start.y()

        x2 = end.x()

        y2 = end.y()

        dx = x2 - x1

        dy = y2 - y1

        if (
            dx == 0
            and
            dy == 0
        ):

            return math.hypot(
                px - x1,
                py - y1
            )

        t = (

            (
                (px - x1) * dx
                +
                (py - y1) * dy
            )

            /

            (
                dx * dx
                +
                dy * dy
            )
        )

        t = max(
            0,
            min(
                1,
                t
            )
        )

        nearest_x = (
            x1 +
            t * dx
        )

        nearest_y = (
            y1 +
            t * dy
        )

        return math.hypot(
            px - nearest_x,
            py - nearest_y
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

        angle = math.atan2(

            end.y()
            -
            start.y(),

            end.x()
            -
            start.x()
        )

        length = (
            12 +
            size
        )

        angle1 = (
            angle
            +
            math.pi * 0.8
        )

        angle2 = (
            angle
            -
            math.pi * 0.8
        )

        p1 = QPoint(

            int(
                end.x()
                +
                length *
                math.cos(angle1)
            ),

            int(
                end.y()
                +
                length *
                math.sin(angle1)
            )
        )

        p2 = QPoint(

            int(
                end.x()
                +
                length *
                math.cos(angle2)
            ),

            int(
                end.y()
                +
                length *
                math.sin(angle2)
            )
        )

        return p1, p2

    # =====================================================
    # PAINT EVENT
    # =====================================================

    def paintEvent(
        self,
        event
    ):

        painter = QPainter(
            self
        )

        painter.setRenderHint(
            QPainter.Antialiasing
        )

        # -------------------------------------------------
        # STORED OBJECTS
        # -------------------------------------------------

        for obj in self.objects:

            self.draw_object(
                painter,
                obj
            )

        # -------------------------------------------------
        # CURRENT STROKE
        # -------------------------------------------------

        if self.current_stroke:

            self.draw_object(
                painter,
                self.current_stroke
            )

        # -------------------------------------------------
        # SHAPE PREVIEW
        # -------------------------------------------------

        if (
            self.drawing
            and
            self.current_tool in (
                "arrow",
                "rectangle",
                "circle"
            )
        ):

            self.draw_shape_preview(
                painter
            )

        painter.end()

    # =====================================================
    # DRAW OBJECT
    # =====================================================

    def draw_object(
        self,
        painter,
        obj
    ):

        obj_type = obj.get(
            "type"
        )

        # -------------------------------------------------
        # PEN / HIGHLIGHTER
        # -------------------------------------------------

        if obj_type in (
            "pen",
            "highlighter"
        ):

            points = obj.get(
                "points",
                []
            )

            if len(points) < 2:

                return

            color = QColor(
                obj.get(
                    "color",
                    self.current_color
                )
            )

            size = obj.get(
                "size",
                self.current_size
            )

            if obj_type == "highlighter":

                color.setAlpha(100)

                size *= 4

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

            for i in range(
                1,
                len(points)
            ):

                painter.drawLine(
                    points[i - 1],
                    points[i]
                )

        # -------------------------------------------------
        # ARROW
        # -------------------------------------------------

        elif obj_type == "arrow":

            self.draw_arrow(
                painter,
                obj["start"],
                obj["end"],
                obj.get(
                    "color",
                    self.current_color
                ),
                obj.get(
                    "size",
                    self.current_size
                )
            )

        # -------------------------------------------------
        # RECTANGLE
        # -------------------------------------------------

        elif obj_type == "rectangle":

            pen = QPen(
                obj.get(
                    "color",
                    self.current_color
                ),
                obj.get(
                    "size",
                    self.current_size
                )
            )

            painter.setPen(
                pen
            )

            painter.setBrush(
                Qt.NoBrush
            )

            painter.drawRect(
                obj["rect"]
            )

        # -------------------------------------------------
        # CIRCLE
        # -------------------------------------------------

        elif obj_type == "circle":

            pen = QPen(
                obj.get(
                    "color",
                    self.current_color
                ),
                obj.get(
                    "size",
                    self.current_size
                )
            )

            painter.setPen(
                pen
            )

            painter.setBrush(
                Qt.NoBrush
            )

            painter.drawEllipse(
                obj["rect"]
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


# =========================================================
# APPLICATION
# =========================================================

app = QApplication(
    sys.argv
)

window = ScreenPen()

server_thread = threading.Thread(
    target=start_websocket_server,
    daemon=True
)

server_thread.start()

window.show()

print(
    "========================================"
)

print(
    "ScreenPen started"
)

print(
    "Tablet input ready"
)

print(
    "Pen size:",
    window.current_size
)

print(
    "Eraser size:",
    window.eraser_size
)

print(
    "Object movement support: ON"
)

print(
    "========================================"
)

sys.exit(
    app.exec()
)