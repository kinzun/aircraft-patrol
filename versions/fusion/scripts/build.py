"""Build the aircraft fusion game. Use --patrol for the standalone flight toy."""
from pathlib import Path
import argparse
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--patrol', action='store_true')
if not parser.parse_args().patrol:
    subprocess.run([sys.executable, str(ROOT / 'scripts/build-six.py')], check=True)
    sources = json.loads((ROOT / 'scripts/browser-scripts.json').read_text())
    html = (ROOT / 'src/ui/template.html').read_text().replace(
        '/* INLINE_STYLES */', (ROOT / 'src/ui/styles.css').read_text())
    anchor = '</body>'
    target = ROOT / 'index.html'
else:
    src = ROOT / 'src/patrol'
    sources = [src / name for name in ('world.js', 'flight.js', 'airframe.js', 'cockpit.js', 'main.js')]
    html = (src / 'template.html').read_text().replace('/* STYLE */', (src / 'style.css').read_text())
    anchor = '<!-- SCRIPTS -->'
    target = ROOT / 'build/patrol.html'
    target.parent.mkdir(exist_ok=True)

scripts = '\n'.join('<script>\n' + (ROOT / path).read_text() + '\n</script>' for path in sources)
target.write_text(html.replace(anchor, scripts + ('\n</body>' if anchor == '</body>' else '')))
print('Built', target.name)
