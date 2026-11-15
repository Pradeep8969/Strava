import { beforeEach, expect, it, vi } from "vitest";
import { BirthdateWheel } from "../components/birthdate-wheel";
const h = vi.hoisted(() => ({ scroll: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({
    current: value === null ? { scrollTo: h.scroll } : value,
  }),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
beforeEach(() => {
  h.scroll.mockClear();
});
function wheel(selected = 14) {
  const onChange = vi.fn();
  const tree = BirthdateWheel({
    label: "Day",
    values: Array.from({ length: 29 }, (_, i) => String(i + 1)),
    selected,
    onChange,
  });
  return { root: tree.props, scroll: tree.props.children.props, onChange };
}
it("centers the saved value and exposes an adjustable accessible native wheel", () => {
  const view = wheel();
  expect(h.scroll).toHaveBeenCalledWith({ y: 14 * 44, animated: false });
  expect(view.root.accessibilityRole).toBe("adjustable");
  expect(view.root.accessibilityValue.text).toBe("15");
  expect(view.scroll.snapToInterval).toBe(44);
  expect(view.scroll.decelerationRate).toBe("fast");
});
it("updates during touch scrolling and snaps to the closest valid row at momentum end", () => {
  const view = wheel();
  view.scroll.onScrollBeginDrag();
  view.scroll.onScroll({ nativeEvent: { contentOffset: { y: 90 } } });
  expect(view.onChange).toHaveBeenLastCalledWith(2);
  view.scroll.onMomentumScrollEnd({
    nativeEvent: { contentOffset: { y: 91 } },
  });
  expect(h.scroll).toHaveBeenLastCalledWith({ y: 88, animated: true });
});
it("bounds overscroll and screen-reader adjustments to valid date values", () => {
  const view = wheel(28);
  view.root.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
  expect(view.onChange).toHaveBeenLastCalledWith(28);
  view.scroll.onMomentumScrollEnd({
    nativeEvent: { contentOffset: { y: -100 } },
  });
  expect(view.onChange).toHaveBeenLastCalledWith(0);
  view.scroll.onMomentumScrollEnd({
    nativeEvent: { contentOffset: { y: 9999 } },
  });
  expect(view.onChange).toHaveBeenLastCalledWith(28);
});
