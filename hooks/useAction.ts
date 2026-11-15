import { useCallback, useRef, useState } from "react";
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const run = useCallback(
    async (action: () => Promise<unknown>, success = "") => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      setMessage("");
      try {
        await action();
        setMessage(success);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [],
  );
  return { busy, message, run, setMessage };
}
