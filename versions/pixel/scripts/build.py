"""Build the offline PATROL air combat game."""
from pathlib import Path
import argparse
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--patrol', action='store_true', help='write a copy to build/patrol.html')
target = ROOT / ('build/patrol.html' if parser.parse_args().patrol else 'index.html')
subprocess.run([sys.executable, str(ROOT / 'scripts/build-six.py')], check=True)
sources = json.loads((ROOT / 'scripts/browser-scripts.json').read_text())
src = ROOT / 'src/patrol'
html = (src / 'template.html').read_text().replace('/* STYLE */', (src / 'style.css').read_text())
scripts = '\n'.join('<script>\n' + (ROOT / path).read_text() + '\n</script>' for path in sources)
target.write_text(html.replace('<!-- SCRIPTS -->', scripts))
print('Built', target.name)
