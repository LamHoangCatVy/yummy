/**
 * Constants ported from Python config.py.
 */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go',
  '.rb', '.php', '.cs', '.html', '.css', '.json', '.md',
]);

export const DEFAULT_MAX_SCAN_LIMIT = 10_000;
export const SCAN_CHUNK_BYTES = 35_000;
