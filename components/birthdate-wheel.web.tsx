import { useEffect, useRef } from "react";

const rowHeight = 44;
export function BirthdateWheel({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: number;
  onChange: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = useRef(onChange);
  const scrolling = useRef(false);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (
      ref.current &&
      (!scrolling.current ||
        Math.round(ref.current.scrollTop / rowHeight) !== selected)
    )
      ref.current.scrollTop = selected * rowHeight;
  }, [selected, values.length]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div
      role="spinbutton"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={values.length}
      aria-valuenow={selected + 1}
      aria-valuetext={values[selected]}
      tabIndex={0}
      ref={ref}
      onKeyDown={(event) => {
        const offsets: Record<string, number> = {
          ArrowUp: -1,
          ArrowDown: 1,
          PageUp: -10,
          PageDown: 10,
        };
        let index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? values.length - 1
              : selected + (offsets[event.key] ?? 0);
        if (
          !(event.key in offsets) &&
          event.key !== "Home" &&
          event.key !== "End"
        )
          return;
        event.preventDefault();
        index = Math.max(0, Math.min(index, values.length - 1));
        change.current(index);
      }}
      onScroll={() => {
        scrolling.current = true;
        if (ref.current)
          change.current(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(ref.current.scrollTop / rowHeight),
              ),
            ),
          );
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (!ref.current) return;
          scrolling.current = false;
          const index = Math.max(
            0,
            Math.min(
              values.length - 1,
              Math.round(ref.current.scrollTop / rowHeight),
            ),
          );
          ref.current.scrollTo({ top: index * rowHeight, behavior: "smooth" });
          change.current(index);
        }, 100);
      }}
      style={{
        height: rowHeight * 5,
        flex: label === "Month" ? 1.6 : 1,
        minWidth: 0,
        overflowY: "auto",
        scrollbarWidth: "none",
        scrollSnapType: "y mandatory",
        overscrollBehavior: "contain",
        paddingBlock: rowHeight * 2,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {values.map((value, index) => (
        <div
          key={value}
          onClick={() => change.current(index)}
          style={{
            height: rowHeight,
            scrollSnapAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: index === selected ? "#ffffff" : "#8b929f",
            opacity: Math.abs(index - selected) > 1 ? 0.45 : 1,
            fontSize: index === selected ? 19 : 16,
            fontWeight: index === selected ? 700 : 400,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {value}
        </div>
      ))}
    </div>
  );
}
