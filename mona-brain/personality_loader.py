"""Utilities to load Mona's personality from YAML configs."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Union

import yaml

from personality import (
    MonaPersonality,
    MommyPersonality,
    default_mona,
    default_mommy,
    PERSONALITIES,
    get_personality,
)

PersonalityType = Union[MonaPersonality, MommyPersonality]


def load_personality_from_yaml(
    path: Optional[str] = None,
    archetype: str = "girlfriend",
) -> PersonalityType:
    """Return a personality, optionally loaded from a YAML file.

    Args:
        path: Optional path to a YAML config file
        archetype: The personality archetype to use ("girlfriend" or "mommy")
    """
    # Get the base personality for this archetype
    base_personality = get_personality(archetype)

    default_path = Path(__file__).with_name(f"personality.{archetype}.yaml")
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
        return base_personality

    try:
        with config_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return base_personality.model_copy(update=data)
    except FileNotFoundError:
        print(f"⚠ Personality config not found at {config_path}. Falling back to default.")
    except Exception as exc:  # broad catch to avoid boot failures
        print(f"⚠ Failed to load personality config ({config_path}): {exc}")

    return base_personality


def list_available_personalities() -> list[dict]:
    """Return a list of available personality archetypes for the UI."""
    return [
        {
            "id": "girlfriend",
            "name": "Girlfriend",
            "description": "Playful, teasing, chaotic energy. Equal dynamic with banter and roasting.",
        },
        {
            "id": "mommy",
            "name": "Nurturing",
            "description": "Warm, caring, gently protective. Comforting presence with praise and affection.",
        },
    ]
