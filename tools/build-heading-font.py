"""Build a static Alimama ShuHeiTi subset for Chinese titles and info attribution.

Usage:
    npm run build
    python tools/build-heading-font.py [path-to-AlimamaShuHeiTi-Bold.otf]

The subset covers Chinese page-hero h1 elements and text marked with
the alimama-shuhei class.
"""

import glob
import hashlib
import os
import shutil
import sys
import tempfile
from html.parser import HTMLParser

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
FONT_DIR = os.path.join(ROOT, 'css', 'fonts')
FONT_PREFIX = 'AlimamaShuHeiTi'
SOURCE_FONT = os.path.join(ROOT, 'tools', 'fonts', 'AlimamaShuHeiTi-Bold.otf')
CSS_OUT = os.path.join(ROOT, 'css', '_heading-font.generated.css')


class HeadingParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = ''
        self.hero_depth = 0
        self.capture_stack = []
        self.capture_text = []
        self.headings = []
        self.marked_texts = []
        self.capture_kind = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = attributes.get('class', '').split()
        if self.capture_stack:
            if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                           'link', 'meta', 'param', 'source', 'track', 'wbr'}:
                self.capture_stack.append(tag)
        elif tag == 'html':
            self.lang = attributes.get('lang', '')
        elif tag == 'header' and 'page-hero' in classes:
            self.hero_depth += 1
        elif tag == 'h1' and self.hero_depth:
            self.capture_stack = [tag]
            self.capture_text = []
            self.capture_kind = 'heading'
        elif 'alimama-shuhei' in classes:
            self.capture_stack = [tag]
            self.capture_text = []
            self.capture_kind = 'marked'

    def handle_data(self, data):
        if self.capture_stack:
            self.capture_text.append(data)

    def handle_endtag(self, tag):
        if self.capture_stack:
            for index in range(len(self.capture_stack) - 1, -1, -1):
                if self.capture_stack[index] == tag:
                    del self.capture_stack[index:]
                    if not self.capture_stack:
                        text = ''.join(self.capture_text).strip()
                        if text:
                            target = self.headings if self.capture_kind == 'heading' else self.marked_texts
                            target.append(text)
                        self.capture_kind = None
                    break
        if tag == 'header' and self.hero_depth:
            self.hero_depth -= 1


def collect_heading_chars():
    chars = set()
    for base, _, files in os.walk(DIST):
        for filename in files:
            if not filename.endswith('.html'):
                continue
            path = os.path.join(base, filename)
            parser = HeadingParser()
            with open(path, encoding='utf-8') as source:
                parser.feed(source.read())
            if parser.lang.startswith('zh'):
                for heading in parser.headings:
                    chars.update(heading)
            for marked_text in parser.marked_texts:
                chars.update(marked_text)
    if not chars:
        raise SystemExit('No Chinese page headings found under dist/. Run npm run build first.')
    return ''.join(sorted(chars))


def main():
    if len(sys.argv) > 2:
        raise SystemExit(__doc__.strip())
    source_path = os.path.abspath(sys.argv[1]) if len(sys.argv) == 2 else SOURCE_FONT
    if not os.path.isfile(source_path):
        raise SystemExit(f'Font file not found: {source_path}')

    chars = collect_heading_chars()
    os.makedirs(FONT_DIR, exist_ok=True)

    with tempfile.TemporaryDirectory() as work_dir:
        output_path = os.path.join(work_dir, 'subset.woff2')

        font = TTFont(source_path, recalcTimestamp=False)
        if 'fvar' in font:
            raise SystemExit('Expected a static bold font, but the source is variable.')
        if font['OS/2'].usWeightClass != 700:
            raise SystemExit(f"Expected font weight 700; found {font['OS/2'].usWeightClass}")
        font.close()

        subset.main([
            source_path,
            '--text=' + chars,
            '--flavor=woff2',
            '--output-file=' + output_path,
            '--layout-features=*',
        ])

        result = TTFont(output_path)
        cmap = result.getBestCmap() or {}
        missing = {char for char in chars if ord(char) not in cmap}
        if missing:
            raise SystemExit(f'Subset is missing heading characters: {sorted(missing)}')
        if 'fvar' in result:
            raise SystemExit('The output font is still variable; expected a static font.')
        result.close()

        digest = hashlib.sha256(open(output_path, 'rb').read()).hexdigest()[:8]
        filename = f'{FONT_PREFIX}.{digest}.woff2'
        destination = os.path.join(FONT_DIR, filename)
        staged_path = destination + '.tmp'
        try:
            shutil.copyfile(output_path, staged_path)
            os.replace(staged_path, destination)
        finally:
            if os.path.exists(staged_path):
                os.remove(staged_path)

        css_text = (
            "/* Generated by tools/build-heading-font.py; do not edit. */\n"
            "@font-face {\n"
            "    font-family: 'Alimama ShuHeiTi';\n"
            f"    src: url('fonts/{filename}') format('woff2');\n"
            "    font-style: normal;\n"
            "    font-weight: 700;\n"
            "    font-display: swap;\n"
            "}\n"
        )
        css_tmp = CSS_OUT + '.tmp'
        try:
            with open(css_tmp, 'w', encoding='utf-8', newline='\n') as css_file:
                css_file.write(css_text)
            os.replace(css_tmp, CSS_OUT)
        finally:
            if os.path.exists(css_tmp):
                os.remove(css_tmp)

        for old_path in glob.glob(os.path.join(FONT_DIR, FONT_PREFIX + '.*.woff2')):
            if os.path.abspath(old_path) != os.path.abspath(destination):
                os.remove(old_path)

    print(f'Generated {os.path.relpath(destination, ROOT)}')
    print(f'Heading characters: {len(chars)}')
    print(f'Updated {os.path.relpath(CSS_OUT, ROOT)}')


if __name__ == '__main__':
    main()
