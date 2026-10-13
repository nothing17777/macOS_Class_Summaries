#!/usr/bin/env python3
"""Static server for the class_summaries desktop, plus upload/rescan endpoints.

Binds to 127.0.0.1 only. Writes are confined to the project folder, limited to
document extensions, and reject path traversal and hidden paths.
"""
import http.server, socketserver, os, sys, json, re, urllib.parse, subprocess, email.parser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = os.path.join(ROOT, '.finder', 'scan.py')
ALLOWED = {'.pdf','.html','.htm','.docx','.doc','.md','.markdown','.txt','.rtf','.pptx','.ppt',
           '.xlsx','.csv','.epub','.tex','.pages','.key','.numbers','.png','.jpg','.jpeg','.webp'}
MAX_BYTES = 80 * 1024 * 1024

def safe_name(name):
    name = os.path.basename(name or '').replace('\x00', '')
    name = re.sub(r'[/\\:]+', '-', name).strip().lstrip('.')
    return name[:160] or 'untitled'

def safe_dir(rel):
    """Resolve a user-supplied folder to an absolute path inside ROOT, or None."""
    rel = (rel or '').strip().strip('/')
    if not rel:
        return ROOT
    parts = [p for p in rel.split('/') if p != '']
    # reject traversal and hidden segments outright rather than silently rewriting
    if any(p in ('.', '..') or p.startswith('.') for p in parts):
        return None
    path = os.path.realpath(os.path.join(ROOT, *parts))
    if path != ROOT and not path.startswith(ROOT + os.sep):
        return None
    return path

def rescan():
    try:
        subprocess.run([sys.executable, SCAN], capture_output=True, timeout=30)
    except Exception:
        pass

def parse_multipart(body, boundary):
    """Minimal multipart/form-data parser: [{name, filename, value}]."""
    out = []
    sep = b'--' + boundary
    for chunk in body.split(sep):
        if chunk in (b'', b'--', b'--\r\n') or not chunk.strip(b'-\r\n'):
            continue
        chunk = chunk.lstrip(b'\r\n')
        head, _, value = chunk.partition(b'\r\n\r\n')
        if not _:
            continue
        headers = email.parser.BytesParser().parsebytes(head)
        disp = headers.get('Content-Disposition', '')
        name = re.search(r'name="([^"]*)"', disp)
        fname = re.search(r'filename="([^"]*)"', disp)
        out.append({'name': name.group(1) if name else '',
                    'filename': fname.group(1) if fname else '',
                    'value': value[:-2] if value.endswith(b'\r\n') else value})
    return out

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if '__' in (self.path or ''):
            super().log_message(fmt, *args)

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        route = urllib.parse.urlparse(self.path).path
        if route == '/__rescan':
            rescan(); return self._json(200, {'ok': True})
        if route == '/__mkdir':
            n = int(self.headers.get('Content-Length') or 0)
            try: data = json.loads(self.rfile.read(n) or b'{}')
            except Exception: return self._json(400, {'error': 'bad json'})
            d = safe_dir(data.get('path'))
            if not d: return self._json(400, {'error': 'bad path'})
            os.makedirs(d, exist_ok=True); rescan()
            return self._json(200, {'ok': True, 'path': os.path.relpath(d, ROOT)})
        if route != '/__upload':
            return self._json(404, {'error': 'no such endpoint'})

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._json(413, {'error': 'file too large'})
        ctype = self.headers.get('Content-Type', '')
        if not ctype.startswith('multipart/form-data'):
            return self._json(400, {'error': 'expected multipart/form-data'})

        m = re.search(r'boundary="?([^";]+)"?', ctype)
        if not m:
            return self._json(400, {'error': 'missing multipart boundary'})
        parts = parse_multipart(self.rfile.read(length), m.group(1).encode())

        dest = safe_dir(next((p['value'].decode('utf-8', 'replace')
                              for p in parts if p['name'] == 'folder' and not p['filename']), ''))
        if not dest:
            return self._json(400, {'error': 'bad folder'})
        os.makedirs(dest, exist_ok=True)

        saved, skipped = [], []
        for part in parts:
            if not part['filename']:
                continue
            name = safe_name(part['filename'])
            ext = os.path.splitext(name)[1].lower()
            if ext not in ALLOWED:
                skipped.append({'name': name, 'why': 'unsupported type'}); continue
            data = part['value']
            if len(data) > MAX_BYTES:
                skipped.append({'name': name, 'why': 'too large'}); continue
            target = os.path.join(dest, name)
            stem, e = os.path.splitext(name); n = 2
            while os.path.exists(target):
                target = os.path.join(dest, f'{stem} {n}{e}'); n += 1
            with open(target, 'wb') as f:
                f.write(data)
            saved.append(os.path.relpath(target, ROOT))
        rescan()
        return self._json(200, {'ok': True, 'saved': saved, 'skipped': skipped})

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    with Server(('127.0.0.1', port), Handler) as httpd:
        print(f'Serving {os.path.basename(ROOT)} at http://localhost:{port}  (Ctrl-C to stop)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')
