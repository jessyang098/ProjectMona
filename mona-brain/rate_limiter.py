"""
Rate Limiter - In-memory rate limiting with burst protection.

Provides per-user rate limiting using both hourly and burst (short window)
limits to prevent abuse while allowing normal conversation flow.
"""

import time
from collections import defaultdict
from typing import Dict


class RateLimiter:
    """In-memory rate limiting with burst protection."""

    def __init__(
        self,
        max_per_hour: int = 100,
        burst_max: int = 10,
        burst_window_seconds: int = 10,
    ):
        self.max_per_hour = max_per_hour
        self.burst_max = burst_max
        self.burst_window = burst_window_seconds
        self._requests: Dict[str, list] = defaultdict(list)

    def is_allowed(self, user_id: str) -> bool:
        """Check if user is within rate limit (hourly + burst)."""
        now = time.time()
        timestamps = self._requests[user_id]

        # Clean old entries (>1hr)
        timestamps[:] = [t for t in timestamps if now - t < 3600]

        # Check hourly limit
        if len(timestamps) >= self.max_per_hour:
            return False

        # Check burst limit
        recent = [t for t in timestamps if now - t < self.burst_window]
        if len(recent) >= self.burst_max:
            return False

        timestamps.append(now)
        return True

    def get_wait_time(self, user_id: str) -> float:
        """Get seconds the user should wait before sending again."""
        now = time.time()
        timestamps = self._requests[user_id]
        recent = [t for t in timestamps if now - t < self.burst_window]
        if len(recent) >= self.burst_max:
            return self.burst_window - (now - recent[0])
        return 0


# Global rate limiter (100/hr, burst: 10 messages per 10s)
rate_limiter = RateLimiter(max_per_hour=100, burst_max=10, burst_window_seconds=10)
