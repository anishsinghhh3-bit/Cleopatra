export interface Resyncer {
  /** Schedule another reconnect; calls onGiveUp instead once attempts run out. */
  schedule: (onGiveUp: () => void) => void;
  /** Everything is back in sync: forget past attempts and cancel any timer. */
  reset: () => void;
  /** Cancel any pending timer without touching the attempt count. */
  cancel: () => void;
}

/**
 * When we reconnect while the opponent's move is still being computed, the
 * move will land on the server a moment later with nobody listening. This
 * re-checks a few times (by reconnecting, which makes the server resend the
 * current position) until the position catches up.
 */
export function createResyncer(
  reconnect: () => void,
  options: { delayMs?: number; maxAttempts?: number } = {}
): Resyncer {
  const delayMs = options.delayMs ?? 1500;
  const maxAttempts = options.maxAttempts ?? 10;
  let attempts = 0;
  let timer: any = null;

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    schedule(onGiveUp) {
      if (attempts >= maxAttempts) {
        onGiveUp();
        return;
      }
      attempts += 1;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        reconnect();
      }, delayMs);
    },
    reset() {
      attempts = 0;
      cancel();
    },
    cancel,
  };
}
