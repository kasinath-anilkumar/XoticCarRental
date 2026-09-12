import Image from "next/image";
import type { CSSProperties } from "react";

import { Icon } from "./Icon";

import styles from "./Media.module.css";


export interface MediaProps {
  /** Null renders the placeholder well instead. */
  src: string | null;
  alt: string;
  /** Shown inside the placeholder, e.g. "Drop BMW X5 photo". */
  placeholder: string;
  /**
   * The Nocturne `.lighten` treatment — mix-blend-mode: lighten, so a
   * photograph shot on black dissolves into the page. Heroes and inline
   * photographs use it; card thumbnails inside a surface do not.
   */
  lighten?: boolean;
  /** Applied to the frame — height, aspect-ratio, border-radius. */
  style?: CSSProperties;
  className?: string;
  /** Passed to next/image; heroes should set this. */
  priority?: boolean;
  sizes?: string;
  /** Icon shown in the empty state. */
  icon?: string;
}

export function Media({
  src,
  alt,
  placeholder,
  lighten = false,
  style,
  className,
  priority = false,
  sizes = "100vw",
  icon = "ph-car-profile",
}: MediaProps) {
  return (
    <div
      className={[styles.frame, className].filter(Boolean).join(" ")}
      style={style}
    >
      {src ? (
        <div className={["absolute inset-0", lighten ? "lighten" : ""].filter(Boolean).join(" ")}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            preload={priority}
            className="size-full object-cover"
          />
        </div>
      ) : (
        // Decorative: the placeholder text names the shot for whoever
        // uploads it, not for a visitor, and the car's name sits beside it.
        <div
          className="absolute inset-0 grid place-items-center gap-[6px] p-4 text-center bg-[repeating-linear-gradient(135deg,transparent,transparent_7px,color-mix(in_srgb,var(--color-text)_4%,transparent)_7px,color-mix(in_srgb,var(--color-text)_4%,transparent)_14px)]"
          aria-hidden
        >
          <span className="flex flex-col items-center gap-[6px] text-[var(--color-neutral-600)]">
            <Icon name={icon} size={28} />
            <span className="max-w-[22ch] text-[11px] leading-[1.35]">{placeholder}</span>
          </span>
        </div>
      )}
    </div>
  );
}
