#!/usr/bin/env python3
"""Isolated member/invitation integration checks. Never reads .env or sends real email."""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('mail', Path(__file__).with_name('test-auth-mail.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if __name__ == '__main__':
    module.main(members=True)
