"""从原版素材生成可离线打开的 Patrol 单文件页面。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "patrol"
SCRIPT_ORDER = ("world.js", "flight.js", "airframe.js", "cockpit.js", "main.js")

template = (SOURCE / "template.html").read_text(encoding="utf-8")
styles = (SOURCE / "style.css").read_text(encoding="utf-8")
scripts = []
for name in SCRIPT_ORDER:
    code = (SOURCE / name).read_text(encoding="utf-8")
    scripts.append("<script>\n" + code + "\n</script>")

html = template.replace("/* STYLE */", styles).replace("<!-- SCRIPTS -->", "\n".join(scripts))
(ROOT / "index.html").write_bytes(html.encode("utf-8"))
print("Built index.html")
