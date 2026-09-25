"use client";

import { useSyncExternalStore } from "react";
import { chooseTheme, loadTheme, subscribeTheme } from "@/lib/client/theme";
import { DEFAULT_THEME, THEME_LABEL, THEMES, type Theme } from "@/lib/theme";

interface SegmentedProps<T> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}

/** Small segmented switch, e.g. Light | Dark or Images | No images. */
export function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  label,
  disabled,
  title,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} title={title} className="seg-switch frame flex shrink-0 bg-bg">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(o.value)}
            className={`kicker px-2.5 py-1 transition-colors disabled:cursor-not-allowed ${
              on ? "bg-ink text-white" : "text-muted enabled:hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const THEME_OPTIONS = THEMES.map((t) => ({ value: t, label: THEME_LABEL[t] }));

/** Light | Dark. */
export function ThemeSwitch(props: Omit<SegmentedProps<Theme>, "options" | "label"> & { label?: string }) {
  return <Segmented options={THEME_OPTIONS} label="Theme" {...props} />;
}

const IMAGE_OPTIONS = [
  { value: true, label: "Images" },
  { value: false, label: "No images" },
] as const;

/** Whether articles show their images. */
export function ImagesSwitch(props: Omit<SegmentedProps<boolean>, "options" | "label">) {
  return <Segmented options={IMAGE_OPTIONS} label="Article images" {...props} />;
}

/** This browser's own theme, used in solo play and outside rooms. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, loadTheme, () => DEFAULT_THEME);
  return <ThemeSwitch value={theme} onChange={chooseTheme} />;
}
