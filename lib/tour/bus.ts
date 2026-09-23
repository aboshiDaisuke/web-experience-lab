/**
 * Open the 3D tour from anywhere:
 *
 *   openTour('luce')                       // dollhouse with a short fly-in
 *   openTour('luce', 'master')             // straight into 歩いて見る at 洋室1
 *   openTour({ property: 'casa', mode: 'plan' })
 *
 * A <TourModal /> placed on the page handles the request; if none is mounted,
 * a shared modal host is created on demand (lazy — three.js and the engine
 * are only downloaded when a tour is opened). Type-only imports keep this
 * module free of three.js.
 */
import type { TourMode } from './engine';

export type OpenTourRequest = {
  /** property id from lib/tour/properties.ts (default: casa) */
  property?: string;
  /** start mode; defaults to 'walk' when a room is given, else 'dollhouse' */
  mode?: TourMode;
  /** HS_<room> id to start at */
  room?: string;
};

export const TOUR_OPEN_EVENT = 'tour:open';

export function openTour(
  target?: string | OpenTourRequest,
  room?: string,
  mode?: TourMode,
) {
  const request: OpenTourRequest =
    typeof target === 'string' ? { property: target, room, mode } : (target ?? {});
  const event = new CustomEvent<OpenTourRequest>(TOUR_OPEN_EVENT, {
    detail: request,
    cancelable: true,
  });
  window.dispatchEvent(event);
  if (event.defaultPrevented) return; // a mounted <TourModal /> took it
  void import('@/components/tour/tour-host').then((m) => m.mountTourHost(request));
}

/** used by <TourModal />: return false to leave the request to another modal */
export function onOpenTour(handler: (request: OpenTourRequest) => boolean | void) {
  const listener = (e: Event) => {
    if (e.defaultPrevented) return;
    if (handler((e as CustomEvent<OpenTourRequest>).detail ?? {}) !== false) e.preventDefault();
  };
  window.addEventListener(TOUR_OPEN_EVENT, listener);
  return () => window.removeEventListener(TOUR_OPEN_EVENT, listener);
}
