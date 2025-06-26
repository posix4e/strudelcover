import sys

try:
    import torch  # noqa: F401
    import librosa  # noqa: F401
    import numpy  # noqa: F401

    print("OK")
except ImportError as e:
    print(f"MISSING: {e.name}")
    sys.exit(1)
