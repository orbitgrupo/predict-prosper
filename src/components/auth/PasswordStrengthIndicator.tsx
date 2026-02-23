import { useMemo } from 'react';

const checks = [
  { label: '8+ caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Carácter especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const strengthLabels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const strengthColors = [
  'bg-destructive',
  'bg-destructive',
  'bg-warning',
  'bg-warning',
  'bg-success',
];

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, results } = useMemo(() => {
    const results = checks.map(c => ({ ...c, passed: c.test(password) }));
    const score = results.filter(r => r.passed).length;
    return { score, results };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? strengthColors[score] : 'bg-secondary'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Fortaleza: <span className="font-medium">{strengthLabels[score]}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {results.map((r) => (
          <span
            key={r.label}
            className={`text-xs ${r.passed ? 'text-success' : 'text-muted-foreground'}`}
          >
            {r.passed ? '✓' : '○'} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
