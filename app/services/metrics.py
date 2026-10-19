import numpy as np

from app.schemas.benchmark import BenchmarkMetrics


class MetricsTracker:
    def __init__(self):
        self.ttft_ms: float = 0.0
        self.total_latency_ms: float = 0.0
        self.inter_token_latencies_ms: list[float] = []
        self.output_tokens: int = 0
        self.thinking_tokens: int = 0
        self.content_tokens: int = 0
        self.finish_reason: str | None = None

    def compute(self) -> BenchmarkMetrics:
        p50 = 0.0
        p95 = 0.0
        avg_itl = 0.0

        if self.inter_token_latencies_ms:
            avg_itl = float(np.mean(self.inter_token_latencies_ms))
            p50 = float(np.percentile(self.inter_token_latencies_ms, 50))
            p95 = float(np.percentile(self.inter_token_latencies_ms, 95))

        decode_time_sec = max((self.total_latency_ms - self.ttft_ms) / 1000.0, 0.001)
        decode_tokens = max(self.output_tokens - 1, 1)
        throughput = decode_tokens / decode_time_sec if self.output_tokens > 1 else 0.0

        return BenchmarkMetrics(
            ttft_ms=round(self.ttft_ms, 2),
            total_latency_ms=round(self.total_latency_ms, 2),
            inter_token_latency_avg_ms=round(avg_itl, 2),
            inter_token_latency_p50_ms=round(p50, 2),
            inter_token_latency_p95_ms=round(p95, 2),
            throughput_tokens_per_sec=round(throughput, 2),
            output_tokens=self.output_tokens,
            thinking_tokens=self.thinking_tokens,
            content_tokens=self.content_tokens,
            finish_reason=self.finish_reason,
        )
