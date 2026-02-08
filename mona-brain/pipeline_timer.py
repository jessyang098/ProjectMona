"""
Pipeline Timer - Tracks timing for the message-to-voice pipeline.

Records checkpoints at each stage of the pipeline and provides
a summary log showing step-by-step and cumulative timing.
"""

import time
from typing import Dict


class PipelineTimer:
    """Tracks timing for the message-to-voice pipeline."""

    def __init__(self, client_id: str):
        self.client_id = client_id
        self.start_time = time.perf_counter()
        self.checkpoints: Dict[str, float] = {}

    def checkpoint(self, name: str):
        """Record a checkpoint time."""
        self.checkpoints[name] = time.perf_counter()

    def get_elapsed(self, checkpoint_name: str = None) -> float:
        """Get elapsed time in ms from start or from a checkpoint."""
        if checkpoint_name and checkpoint_name in self.checkpoints:
            return (time.perf_counter() - self.checkpoints[checkpoint_name]) * 1000
        return (time.perf_counter() - self.start_time) * 1000

    def log_summary(self):
        """Log a summary of all timing checkpoints."""
        total_ms = self.get_elapsed()
        print(f"\n{'='*60}")
        print(f"⏱️  PIPELINE TIMING SUMMARY (Client: {self.client_id[:8]}...)")
        print(f"{'='*60}")

        prev_time = self.start_time
        for name, checkpoint_time in self.checkpoints.items():
            step_ms = (checkpoint_time - prev_time) * 1000
            total_at_checkpoint = (checkpoint_time - self.start_time) * 1000
            print(f"  {name:<30} +{step_ms:>7.0f}ms  (total: {total_at_checkpoint:>7.0f}ms)")
            prev_time = checkpoint_time

        print(f"{'─'*60}")
        print(f"  {'TOTAL':<30} {total_ms:>8.0f}ms  ({total_ms/1000:.2f}s)")
        print(f"{'='*60}\n")
