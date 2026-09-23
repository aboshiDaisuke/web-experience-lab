export type SignatureContext = {
  /** `.project-site` — the whole work page */
  root: HTMLElement;
  /** `#top` — the hero section */
  cover: HTMLElement;
  /** rendered inside the top page's preview iframe (`?embed=1`, 1280×800 scaled down) */
  embedded: boolean;
  /** prefers-reduced-motion: show a finished, static state instead of animating */
  reduced: boolean;
  /** viewport ≤ 760px */
  narrow: boolean;
  /** precise pointer (mouse); false on touch devices */
  fine: boolean;
  /** AETHER only: drive the explode slider (0–100) */
  setExplode?: (value: number) => void;
};
export type Signature = (ctx: SignatureContext) => (() => void) | void;
