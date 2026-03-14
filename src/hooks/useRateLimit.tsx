import { useState, useCallback } from 'react';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

export function useRateLimit(config: RateLimitConfig = { maxAttempts: 5, windowMs: 60000, lockoutMs: 120000 }) {
  const [attempts, setAttempts] = useState<number[]>([]);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const isLocked = useCallback(() => {
    if (lockedUntil && Date.now() < lockedUntil) {
      return true;
    }
    if (lockedUntil && Date.now() >= lockedUntil) {
      setLockedUntil(null);
      setAttempts([]);
    }
    return false;
  }, [lockedUntil]);

  const getRemainingLockTime = useCallback(() => {
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  }, [lockedUntil]);

  const recordAttempt = useCallback(() => {
    const now = Date.now();
    const recentAttempts = [...attempts, now].filter((t) => now - t < config.windowMs);
    setAttempts(recentAttempts);

    if (recentAttempts.length >= config.maxAttempts) {
      setLockedUntil(now + config.lockoutMs);
      return false;
    }
    return true;
  }, [attempts, config]);

  const resetAttempts = useCallback(() => {
    setAttempts([]);
    setLockedUntil(null);
  }, []);

  return { isLocked, getRemainingLockTime, recordAttempt, resetAttempts, attemptsLeft: config.maxAttempts - attempts.filter((t) => Date.now() - t < config.windowMs).length };
}
