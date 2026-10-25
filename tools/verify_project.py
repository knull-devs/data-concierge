#!/usr/bin/env python3
"""Dependency-free sanity checks for the Date Concierge static auth preview."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicate_ids = set()
        self.labels = []
        self.refs = []
        self.forms = []
        self.current_form = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                self.duplicate_ids.add(attrs['id'])
            self.ids.add(attrs['id'])
        if tag == 'label' and attrs.get('for'):
            self.labels.append(attrs['for'])
        if tag == 'link' and attrs.get('href'):
            ref = attrs['href']
            if ref.startswith('/') and not ref.startswith('//'):
                self.refs.append(ref)
        if tag == 'script' and attrs.get('src'):
            ref = attrs['src']
            if ref.startswith('/'):
                self.refs.append(ref)
        if tag == 'form':
            self.forms.append(attrs)

errors = []
required = [
    'index.html', 'register.html', 'assets/css/auth.css', 'assets/js/auth.js',
    'favicon.svg', 'vercel.json', 'README.md', '.gitignore'
]
for rel in required:
    if not (ROOT / rel).is_file():
        errors.append(f'Missing required file: {rel}')

for page in ('index.html', 'register.html'):
    p = ROOT / page
    if not p.is_file():
        continue
    parser = PageParser()
    parser.feed(p.read_text(encoding='utf-8'))
    if not parser.forms:
        errors.append(f'{page}: no form found')
    if parser.duplicate_ids:
        errors.append(f'{page}: duplicate IDs: {sorted(parser.duplicate_ids)}')
    for label_id in parser.labels:
        if label_id not in parser.ids:
            errors.append(f'{page}: label references missing field ID {label_id}')
    for ref in parser.refs:
        target = ROOT / ref.lstrip('/')
        if not target.is_file():
            errors.append(f'{page}: missing referenced local asset {ref}')
    if page == 'index.html' and 'login-form' not in {f.get('id') for f in parser.forms}:
        errors.append('index.html: login form id missing')
    if page == 'register.html' and 'registration-form' not in {f.get('id') for f in parser.forms}:
        errors.append('register.html: registration form id missing')

for rel in ('index.html','register.html','assets/css/auth.css','assets/js/auth.js'):
    p=ROOT/rel
    if p.is_file():
        content=p.read_text(encoding='utf-8')
        if re.search(r'\bpfbc-|form_join_user|form_login_user', content, re.I):
            errors.append(f'{rel}: found upstream framework-specific reference')

js = ROOT/'assets/js/auth.js'
if js.is_file() and 'localStorage' in js.read_text(encoding='utf-8'):
    errors.append('auth.js: preview must not persist authentication form data')

if errors:
    print('FAIL')
    for item in errors:
        print(f'- {item}')
    sys.exit(1)
print('PASS: required files and local references exist')
print('PASS: standalone login and registration forms found')
print('PASS: no upstream framework-specific class names in frontend')
print('PASS: preview does not persist credentials')
