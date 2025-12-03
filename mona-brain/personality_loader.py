"""Utilities to load Mona's personality from YAML configs."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import yaml

from personality import MonaPersonality, default_mona


def load_personality_from_yaml(path: Optional[str] = None) -> MonaPersonality:
    """Return a MonaPersonality, optionally loaded from a YAML file."""

    default_path = Path(__file__).with_name("personality.mona.yaml")
    env_path = os.getenv("PERSONALITY_CONFIG_PATH")
    config_path: Optional[Path]
    if path:
        config_path = Path(path).expanduser()
    elif env_path:
        config_path = Path(env_path).expanduser()
    elif default_path.exists():
        config_path = default_path
    else:
        config_path = None

    if not config_path:
        return default_mona

    try:
        with config_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return default_mona.model_copy(update=data)
    except FileNotFoundError:
        print(f"⚠ Personality config not found at {config_path}. Falling back to default.")
    except Exception as exc:  # broad catch to avoid boot failures
        print(f"⚠ Failed to load personality config ({config_path}): {exc}")

    return default_mona
