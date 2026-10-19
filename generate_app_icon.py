import os
import sys


def generate_icon_pyqt():
    from PyQt6 import QtCore, QtGui, QtWidgets

    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication(sys.argv)
    os.makedirs("assets", exist_ok=True)
    size = 512

    pixmap = QtGui.QPixmap(size, size)
    pixmap.fill(QtCore.Qt.GlobalColor.transparent)

    painter = QtGui.QPainter(pixmap)
    painter.setRenderHint(QtGui.QPainter.RenderHint.Antialiasing)
    center_x, center_y = size / 2.0, size / 2.0

    # ------------------------------------------------------------------
    # 1. Base Squircle Frame (Inference Lab Dark Surface)
    # ------------------------------------------------------------------
    badge_path = QtGui.QPainterPath()
    badge_path.addRoundedRect(
        28.0, 28.0, float(size - 56), float(size - 56), 116.0, 116.0
    )

    bg_grad = QtGui.QLinearGradient(0, 0, size, size)
    bg_grad.setColorAt(0.0, QtGui.QColor("#111827"))
    bg_grad.setColorAt(0.4, QtGui.QColor("#0b0f17"))
    bg_grad.setColorAt(1.0, QtGui.QColor("#030712"))
    painter.fillPath(badge_path, bg_grad)

    badge_pen = QtGui.QPen(QtGui.QColor("#059669"), 4.0)  # Neon Emerald Accent
    painter.setPen(badge_pen)
    painter.drawPath(badge_path)

    # Subtle inner glow
    inner_glow = QtGui.QPen(QtGui.QColor(16, 185, 129, 40), 8.0)
    painter.setPen(inner_glow)
    painter.drawPath(badge_path)

    # ------------------------------------------------------------------
    # 2. Token Speed Telemetry Arc (TTFT / Throughput Gauge)
    # ------------------------------------------------------------------
    gauge_rect = QtCore.QRectF(64.0, 64.0, size - 128.0, size - 128.0)

    # Track Background
    track_pen = QtGui.QPen(
        QtGui.QColor("#1f2937"),
        8.0,
        QtCore.Qt.PenStyle.SolidLine,
        QtCore.Qt.PenCapStyle.RoundCap,
    )
    painter.setPen(track_pen)
    painter.drawArc(gauge_rect, 35 * 16, 290 * 16)

    # Active Telemetry Sweep (Emerald -> Cyan -> Violet / Reasoning)
    active_grad = QtGui.QConicalGradient(QtCore.QPointF(center_x, center_y), -45.0)
    active_grad.setColorAt(0.0, QtGui.QColor("#10b981"))  # Emerald (Speed)
    active_grad.setColorAt(0.5, QtGui.QColor("#06b6d4"))  # Cyan (Decode)
    active_grad.setColorAt(1.0, QtGui.QColor("#a855f7"))  # Purple (Reasoning)

    active_pen = QtGui.QPen(
        QtGui.QBrush(active_grad),
        9.0,
        QtCore.Qt.PenStyle.SolidLine,
        QtCore.Qt.PenCapStyle.RoundCap,
    )
    painter.setPen(active_pen)
    painter.drawArc(gauge_rect, 60 * 16, 220 * 16)

    # Orbiting Token Pulse Particle
    painter.setPen(QtCore.Qt.PenStyle.NoPen)
    painter.setBrush(QtGui.QColor(16, 185, 129, 60))
    painter.drawEllipse(QtCore.QPointF(center_x + 152, center_y - 102), 18.0, 18.0)
    painter.setBrush(QtGui.QColor("#34d399"))
    painter.drawEllipse(QtCore.QPointF(center_x + 152, center_y - 102), 8.0, 8.0)

    # Radial ITL Latency Tick Marks
    tick_pen = QtGui.QPen(
        QtGui.QColor("#374151"),
        3.0,
        QtCore.Qt.PenStyle.SolidLine,
        QtCore.Qt.PenCapStyle.RoundCap,
    )
    painter.setPen(tick_pen)
    for angle in [-40, -15, 10, 170, 195, 220]:
        painter.save()
        painter.translate(center_x, center_y)
        painter.rotate(angle)
        painter.drawLine(158, 0, 174, 0)
        painter.restore()

    # ------------------------------------------------------------------
    # 3. Stacked Isometric Token & VLM Matrix Blocks
    # ------------------------------------------------------------------
    def draw_matrix_cube(
        origin_x,
        origin_y,
        w=70,
        h=34,
        depth=24,
        primary_color="#065f46",
        top_color="#10b981",
        edge_color="#047857",
    ):
        # Top Face
        top = QtGui.QPainterPath()
        top.moveTo(origin_x, origin_y - depth)
        top.lineTo(origin_x + w, origin_y - depth)
        top.lineTo(origin_x + w - 16, origin_y)
        top.lineTo(origin_x - 16, origin_y)
        top.closeSubpath()
        painter.fillPath(top, QtGui.QColor(top_color))

        # Front Face
        front = QtGui.QPainterPath()
        front.moveTo(origin_x - 16, origin_y)
        front.lineTo(origin_x + w - 16, origin_y)
        front.lineTo(origin_x + w - 16, origin_y + h)
        front.lineTo(origin_x - 16, origin_y + h)
        front.closeSubpath()
        painter.fillPath(front, QtGui.QColor(primary_color))

        # Grooves / Matrix Circuit Traces
        groove_pen = QtGui.QPen(QtGui.QColor(edge_color), 2.0)
        painter.setPen(groove_pen)
        for gx in [origin_x + 6, origin_x + 24, origin_x + 44]:
            painter.drawLine(
                int(gx - 16), int(origin_y + 4), int(gx - 16), int(origin_y + h - 4)
            )

        # Outlines
        outline_pen = QtGui.QPen(QtGui.QColor("#022c22"), 2.0)
        painter.setPen(outline_pen)
        painter.drawPath(top)
        painter.drawPath(front)

    # Base Tier: Foundation Models & Endpoints
    draw_matrix_cube(
        164,
        310,
        w=78,
        h=38,
        primary_color="#064e3b",
        top_color="#059669",
        edge_color="#047857",
    )
    draw_matrix_cube(
        252,
        310,
        w=78,
        h=38,
        primary_color="#064e3b",
        top_color="#059669",
        edge_color="#047857",
    )
    draw_matrix_cube(
        340,
        310,
        w=62,
        h=38,
        primary_color="#022c22",
        top_color="#065f46",
        edge_color="#047857",
    )

    # Mid Tier: Multimodal / VLM Layer (Cyan)
    draw_matrix_cube(
        208,
        256,
        w=78,
        h=38,
        primary_color="#0e7490",
        top_color="#06b6d4",
        edge_color="#0891b2",
    )
    draw_matrix_cube(
        296,
        256,
        w=78,
        h=38,
        primary_color="#0e7490",
        top_color="#06b6d4",
        edge_color="#0891b2",
    )

    # Top Tier: Reasoning & Thinking Core (Purple / Violet)
    draw_matrix_cube(
        252,
        202,
        w=78,
        h=38,
        primary_color="#7c3aed",
        top_color="#a855f7",
        edge_color="#9333ea",
    )

    # ------------------------------------------------------------------
    # 4. Energy Speed Strike (Benchmark Lightning / TTFT Flash)
    # ------------------------------------------------------------------
    bolt = QtGui.QPainterPath()
    bolt_points = [
        QtCore.QPointF(280, 118),  # Top tip
        QtCore.QPointF(210, 230),  # Left elbow
        QtCore.QPointF(258, 230),  # Mid shelf
        QtCore.QPointF(234, 345),  # Bottom strike tip
        QtCore.QPointF(328, 212),  # Right elbow
        QtCore.QPointF(276, 212),  # Return notch
    ]
    bolt.moveTo(bolt_points[0])
    for pt in bolt_points[1:]:
        bolt.lineTo(pt)
    bolt.closeSubpath()

    bolt_grad = QtGui.QLinearGradient(210, 118, 328, 345)
    bolt_grad.setColorAt(0.0, QtGui.QColor("#fef08a"))  # Light Amber
    bolt_grad.setColorAt(0.5, QtGui.QColor("#10b981"))  # Neon Emerald
    bolt_grad.setColorAt(1.0, QtGui.QColor("#06b6d4"))  # Cyan Flash
    painter.fillPath(bolt, bolt_grad)

    bolt_border = QtGui.QPen(
        QtGui.QColor("#ffffff"),
        3.5,
        QtCore.Qt.PenStyle.SolidLine,
        QtCore.Qt.PenCapStyle.RoundCap,
    )
    painter.setPen(bolt_border)
    painter.drawPath(bolt)

    painter.end()

    # ------------------------------------------------------------------
    # 5. Export Assets (PNG & Windows Multi-Resolution ICO)
    # ------------------------------------------------------------------
    png_path = os.path.join("assets", "app_icon.png")
    ico_path = os.path.join("assets", "app_icon.ico")

    pixmap.save(png_path, "PNG")
    print(f"✓ Generated High-Res PNG: {png_path}")

    # Build multi-resolution icon
    icon = QtGui.QIcon()
    for s in [16, 24, 32, 48, 64, 128, 256]:
        scaled = pixmap.scaled(
            s,
            s,
            QtCore.Qt.AspectRatioMode.KeepAspectRatio,
            QtCore.Qt.TransformationMode.SmoothTransformation,
        )
        icon.addPixmap(scaled)

    pixmap_256 = pixmap.scaled(
        256,
        256,
        QtCore.Qt.AspectRatioMode.KeepAspectRatio,
        QtCore.Qt.TransformationMode.SmoothTransformation,
    )
    pixmap_256.save(ico_path, "ICO")
    print(f"✓ Generated Windows ICO: {ico_path}")


def generate_icon_fallback():
    """Generates an icon using Pillow if PyQt6 is not available."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print(
            "Install PyQt6 or Pillow to generate the icon: `pip install PyQt6` or `pip install pillow`"
        )
        return

    os.makedirs("assets", exist_ok=True)
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded squircle
    draw.rounded_rectangle(
        [28, 28, size - 28, size - 28],
        radius=116,
        fill="#0b0f17",
        outline="#10b981",
        width=5,
    )

    # Telemetry Arc
    draw.arc([64, 64, size - 64, size - 64], start=35, end=290, fill="#38bdf8", width=8)

    # Center Matrix Box
    draw.rectangle([180, 200, 332, 340], fill="#1e293b", outline="#a855f7", width=4)

    # Energy lightning
    bolt = [(280, 130), (210, 230), (260, 230), (235, 340), (325, 210), (275, 210)]
    draw.polygon(bolt, fill="#facc15", outline="#ffffff")

    png_path = os.path.join("assets", "app_icon.png")
    ico_path = os.path.join("assets", "app_icon.ico")
    img.save(png_path, "PNG")

    img.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"✓ Generated PNG & ICO using Pillow: {ico_path}")


if __name__ == "__main__":
    try:
        generate_icon_pyqt()
    except Exception as e:
        print(f"PyQt6 generation note ({e}), attempting Pillow fallback...")
        generate_icon_fallback()
