'use client';
/** On-demand modal host used by `openTour()` when no <TourModal /> is mounted. */
import { createRoot, type Root } from 'react-dom/client';
import TourModal from './tour-viewer';
import type { OpenTourRequest } from '@/lib/tour/bus';

let root: Root | null = null;

export function mountTourHost(request: OpenTourRequest) {
  if (root) {
    // already mounted: the host's listener handles later requests
    window.dispatchEvent(new CustomEvent('tour:open', { detail: request, cancelable: true }));
    return;
  }
  const el = document.createElement('div');
  el.dataset.tourHost = '';
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<TourModal initial={request} />);
}
