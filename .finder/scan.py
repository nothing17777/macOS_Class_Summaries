#!/usr/bin/env python3
"""Scan the class_summaries tree and emit manifest.json for the Finder app."""
import json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.finder', '.git', '__pycache__', '.DS_Store'}
SKIP_FILES = {'index.html', 'open-mac.command', 'README.md'}
DOC_EXTS = {'.pdf', '.html', '.htm', '.docx', '.doc', '.md', '.markdown', '.txt',
            '.rtf', '.pptx', '.ppt', '.xlsx', '.csv', '.epub', '.tex', '.pages', '.key', '.numbers'}

def walk(rel):
    absd = os.path.join(ROOT, rel) if rel else ROOT
    items = []
    for name in sorted(os.listdir(absd), key=str.lower):
        if name.startswith('.') or name in SKIP_DIRS:
            continue
        p = os.path.join(absd, name)
        r = os.path.join(rel, name) if rel else name
        if os.path.isdir(p):
            kids = walk(r)
            items.append({'name': name, 'path': r, 'kind': 'folder', 'children': kids,
                          'count': len(kids), 'mtime': os.path.getmtime(p)})
        else:
            ext = os.path.splitext(name)[1].lower()
            if ext not in DOC_EXTS or (not rel and name in SKIP_FILES):
                continue
            st = os.stat(p)
            items.append({'name': name, 'path': r, 'kind': 'file', 'ext': ext.lstrip('.'),
                          'size': st.st_size, 'mtime': st.st_mtime})
    return items

tree = walk('')
out = {'generated': time.time(), 'root': os.path.basename(ROOT), 'items': tree}
dest = os.path.join(ROOT, '.finder', 'manifest.json')
with open(dest, 'w') as f:
    json.dump(out, f, indent=1)
n = sum(1 for _ in json.dumps(tree).split('"kind": "file"')) - 1
print(f'manifest written: {dest} ({n} documents)')
