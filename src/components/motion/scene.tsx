import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type SceneTheme = "light" | "dark" | "darker" | "dark-alt" | "sand";

type SceneProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  as?: "section" | "div" | "header" | "footer";
  /** Sets `data-theme`: the scene's background, text and every `--t-*` token inside. */
  theme?: SceneTheme;
  /** How many viewports the scene lasts while pinned (its scroll length). */
  length?: number;
  /** Starts one viewport early, under the scene before, which slides away to reveal it. */
  underPrevious?: boolean;
  /** Ends one viewport late: the next scene slides over it while it stays pinned. */
  underNext?: boolean;
  /**
   * On touch and under 668 px: `static` (the default, as most of the
   * reference's mobile scenes) stacks the layers; `sticky` keeps them pinned.
   */
  mobile?: "static" | "sticky";
  children: ReactNode;
};

/**
 * One scene of a page (docs/motion-system.md → Scenes): a CSS grid whose
 * `SceneLayer`s pin (`position: sticky`, one viewport tall) while the scene's
 * other children scroll over them. Pinning is pure CSS, in
 * src/styles/scenes.css, so this is a server component; it pins only with a
 * fine pointer at 668 px and up (or `mobile="sticky"`), with motion allowed
 * and with script running. Otherwise, and on the server's first paint for
 * those cases, the scene is a plain stack of its children in their final
 * state.
 *
 * Scrubbed effects inside a scene measure the scene, not a sticky layer
 * (`trigger: "scene"`), because a pinned layer's position follows the scroll.
 */
export function Scene({
  as: Tag = "section",
  theme,
  length,
  underPrevious = false,
  underNext = false,
  mobile = "static",
  className,
  style,
  children,
  ...props
}: SceneProps) {
  return (
    <Tag
      data-scroll-scene=""
      data-theme={theme}
      data-mobile={mobile}
      data-under-previous={underPrevious ? "" : undefined}
      data-under-next={underNext ? "" : undefined}
      className={cx(theme && "bg-(--t-bg) text-(--t-text)", className)}
      style={length ? ({ ...style, "--scene-length": length } as CSSProperties) : style}
      {...props}
    >
      {children}
    </Tag>
  );
}

type SceneLayerProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * The layer's height when the scene is stacked: `screen` (the default) keeps
   * one viewport, for full-bleed images; `auto` lets its content decide.
   */
  stacked?: "screen" | "auto";
};

/** A pinned layer of a `Scene`; later layers paint over earlier ones. */
export function SceneLayer({ stacked = "screen", className, ...props }: SceneLayerProps) {
  return <div data-layer={stacked} className={cx("overflow-hidden", className)} {...props} />;
}
