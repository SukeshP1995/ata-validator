## Fastify route validation: ata-AOT vs ata-runtime vs AJV

| Config | req/sec | latency avg | latency p99 | throughput |
|---|---|---|---|---|
| AJV (Fastify default) | 47,152 | 0.93 ms | 1.00 ms | 8.18 MB/s |
| ata-runtime | 47,349.82 | 0.91 ms | 1.00 ms | 8.22 MB/s |
| ata-AOT | 46,567.28 | 0.97 ms | 1.00 ms | 8.08 MB/s |

Ratio (vs AJV baseline): ata-runtime 1.00× faster, ata-AOT 0.99× faster.

Methodology: Fastify 5.x in-process, autocannon 50 connections, 10s measurement after 3s warmup, valid POST body. Hardware: Apple M4 Pro, Node v25.2.1.

*Measured on 2026-05-09*
