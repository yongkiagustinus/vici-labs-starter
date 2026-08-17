import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

/**
 * Fire `onShake` when the device is shaken — the fastest path to "quick add a
 * transaction" (VIC-10 gesture). Debounced so one shake = one trigger. No-ops
 * gracefully where the accelerometer is unavailable.
 */
export function useShake(onShake: () => void, threshold = 1.8) {
  const last = useRef(0);
  const cb = useRef(onShake);
  cb.current = onShake;

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let mounted = true;
    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || !mounted) return;
      Accelerometer.setUpdateInterval(200);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (magnitude > threshold && now - last.current > 1200) {
          last.current = now;
          cb.current();
        }
      });
    })();
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [threshold]);
}
