export interface BuildOptions {
  /** Glob patterns to expand into input schema files. */
  globs: string[];
  /** Module format for compiled outputs. Default: 'esm'. */
  format?: 'esm' | 'cjs';
  /** Write outputs into this directory instead of alongside sources. */
  outDir?: string;
  /** Output filename suffix. Default: '.compiled'. */
  suffix?: string;
  /** Use stub error functions for the smallest output. Default: false. */
  abortEarly?: boolean;
  /** Path to incremental cache file. Default: cache disabled. */
  cacheFile?: string;
  /** When true, do not write outputs; only report stale count. */
  check?: boolean;
  /** Maximum gzipped output size per compiled module, in bytes. */
  maxSize?: number;
  /** When true, AOT-incompatible schemas become failures (default: skipped). */
  strict?: boolean;
}

export interface CompiledEntry {
  input: string;
  output: string;
  bytes: number;
  gzipBytes?: number;
}

export interface CachedEntry {
  input: string;
  output: string;
}

export interface SkippedEntry {
  input: string;
  reason: string;
}

export interface FailedEntry {
  input: string;
  error: string;
}

export interface BuildReport {
  compiled: CompiledEntry[];
  cached: CachedEntry[];
  skipped: SkippedEntry[];
  failed: FailedEntry[];
  /** Only set when opts.check === true. */
  staleCount?: number;
}

export function build(opts: BuildOptions): Promise<BuildReport>;
export function expandGlobs(globs: string[]): Promise<string[]>;
export function parseSchemaFile(filePath: string): unknown;
export function outputPathFor(input: string, opts: { format?: 'esm' | 'cjs'; outDir?: string; suffix?: string }): string;
