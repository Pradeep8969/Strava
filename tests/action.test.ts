import { beforeEach, expect, it, vi } from "vitest";
import { useAction } from "../hooks/useAction";
const h = vi.hoisted(() => ({ slots: [] as any[], index: 0 }));
vi.mock("react", () => ({
  useRef: (value: unknown) => (h.slots[h.index++] ??= { current: value }),
  useState: (value: unknown) => {
    const i = h.index++;
    h.slots[i] ??= value;
    return [
      h.slots[i],
      (next: unknown) => {
        h.slots[i] = next;
      },
    ];
  },
  useCallback: (fn: unknown) => fn,
}));
function ActionHarness() {
  // This test-only hook runner resets its mocked hook cursor for each render.
  // eslint-disable-next-line react-hooks/immutability
  h.index = 0;
  return useAction();
}
beforeEach(() => {
  h.slots = [];
  h.index = 0;
});
it("blocks same-tick duplicate saves, disables work while pending and clears busy on completion", async () => {
  let finish!: () => void;
  const request = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const action = ActionHarness();
  const pending = action.run(request);
  await action.run(request);
  expect(request).toHaveBeenCalledOnce();
  expect(ActionHarness().busy).toBe(true);
  finish();
  await pending;
  expect(ActionHarness().busy).toBe(false);
  expect(ActionHarness().message).toBe("");
});
it("keeps failure messages actionable and permits a successful retry without a persistent message", async () => {
  await ActionHarness().run(async () => {
    throw new Error("Offline. Try again.");
  });
  expect(ActionHarness().message).toBe("Offline. Try again.");
  expect(ActionHarness().busy).toBe(false);
  const retry = vi.fn().mockResolvedValue(undefined);
  await ActionHarness().run(retry);
  expect(retry).toHaveBeenCalledOnce();
  expect(ActionHarness().message).toBe("");
});
