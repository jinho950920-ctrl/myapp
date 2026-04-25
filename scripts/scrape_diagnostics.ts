import fs from 'fs';
import path from 'path';

type DiagnosticLevel = 'info' | 'warn' | 'error';

type DiagnosticEvent = {
  runId?: string;
  level?: DiagnosticLevel;
  account?: string;
  targetDate?: string;
  scrapeType?: string;
  phase?: string;
  event: string;
  status?: string;
  attempt?: number;
  maxAttempts?: number;
  reason?: string;
  url?: string;
  title?: string;
  locator?: string;
  filePath?: string;
  fileSizeBytes?: number;
  rowCount?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
  error?: unknown;
};

const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|cookie|authorization|auth|session|loginpw|access[_-]?key|refresh)/i;
const SENSITIVE_TEXT_PATTERN =
  /(Cookie:\s*)[^\r\n]+|(Authorization:\s*)[^\r\n]+|(Bearer\s+)[A-Za-z0-9._~+/=-]+|([?&](?:token|access_token|refresh_token|session|sid|cookie|authorization)=)[^&\s]+/gi;

export function createRunId(prefix = 'scrape'): string {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (9 * 60 * 60 * 1000));
  const stamp = [
    kst.getFullYear(),
    String(kst.getMonth() + 1).padStart(2, '0'),
    String(kst.getDate()).padStart(2, '0'),
    String(kst.getHours()).padStart(2, '0'),
    String(kst.getMinutes()).padStart(2, '0'),
    String(kst.getSeconds()).padStart(2, '0'),
  ].join('');

  return `${prefix}_${stamp}_${Math.random().toString(36).slice(2, 8)}`;
}

export function redactSensitiveText(value: string): string {
  return value.replace(SENSITIVE_TEXT_PATTERN, (...matches) => {
    if (matches[1]) return `${matches[1]}[REDACTED]`;
    if (matches[2]) return `${matches[2]}[REDACTED]`;
    if (matches[3]) return `${matches[3]}[REDACTED]`;
    if (matches[4]) return `${matches[4]}[REDACTED]`;
    return '[REDACTED]';
  });
}

function sanitizeValue(value: unknown, parentKey = ''): unknown {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEY_PATTERN.test(parentKey)) return '[REDACTED]';
  if (typeof value === 'string') return redactSensitiveText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack).split('\n').slice(0, 6).join('\n') : undefined,
    };
  }
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, parentKey));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue, key),
      ])
    );
  }
  return String(value);
}

function getKstIsoString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (9 * 60 * 60 * 1000));
  return `${kst.toISOString().replace('Z', '+09:00')}`;
}

export function getDiagnosticPaths(runId: string, targetDate?: string): { runDir: string; jsonlPath: string; summaryPath: string } {
  const dateSegment = targetDate || getKstIsoString().slice(0, 10);
  const runDir = path.join(process.cwd(), 'logs', 'runs', dateSegment);
  return {
    runDir,
    jsonlPath: path.join(runDir, `${runId}.jsonl`),
    summaryPath: path.join(runDir, `${runId}.summary.json`),
  };
}

export function writeDiagnostic(event: DiagnosticEvent): void {
  const runId = event.runId || process.env.SCRAPE_RUN_ID || 'unknown_run';
  const paths = getDiagnosticPaths(runId, event.targetDate);
  fs.mkdirSync(paths.runDir, { recursive: true });

  const payload = sanitizeValue({
    ts: getKstIsoString(),
    level: event.level || 'info',
    ...event,
    runId,
  });

  fs.appendFileSync(paths.jsonlPath, `${JSON.stringify(payload)}\n`, 'utf8');
}

export function writeDiagnosticSummary(
  runId: string,
  targetDate: string | undefined,
  summary: Record<string, unknown>
): void {
  const paths = getDiagnosticPaths(runId, targetDate);
  fs.mkdirSync(paths.runDir, { recursive: true });
  fs.writeFileSync(
    paths.summaryPath,
    JSON.stringify(sanitizeValue({ ts: getKstIsoString(), runId, ...summary }), null, 2),
    'utf8'
  );
}
