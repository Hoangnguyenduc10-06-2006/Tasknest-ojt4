#!/usr/bin/env python3
"""Real Work + Notification databases and HTTP services; Identity is a local contract stub.
No .env, existing database or mail provider is used. Build affected Java modules first.
"""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('foundation', Path(__file__).with_name('test-project-foundation.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if __name__ == '__main__':
    module.main(workspace=True)
