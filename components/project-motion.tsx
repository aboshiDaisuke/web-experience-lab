'use client';
import { useEffect, useRef } from 'react';
import type { Signature } from '@/lib/signatures/types';

const signatures: Record<string, () => Promise<{ default: Signature }>> = {
  nova: () => import('@/lib/signatures/nova'),
  lumina: () => import('@/lib/signatures/lumina'),
  noir: () => import('@/lib/signatures/noir'),
  eclat: () => import('@/lib/signatures/eclat'),
  aether: () => import('@/lib/signatures/aether'),
  casa: () => import('@/lib/signatures/casa'),
  room: () => import('@/lib/signatures/room'),
  yui: () => import('@/lib/signatures/yui'),
  adapt: () => import('@/lib/signatures/adapt'),
  offgrid: () => import('@/lib/signatures/offgrid'),
};

export default function ProjectMotion({
  slug,
  onExplode,
}: {
  slug: string;
  onExplode?: (value: number) => void;
}) {
  const explodeRef = useRef(onExplode);
  useEffect(() => {
    explodeRef.current = onExplode;
  }, [onExplode]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.project-site');
    const cover = root?.querySelector<HTMLElement>('#top');
    const load = signatures[slug];
    if (!root || !cover || !load) return;
    let cleanup: (() => void) | void;
    let disposed = false;
    void load().then(({ default: mount }) => {
      if (disposed) return;
      cleanup = mount({
        root,
        cover,
        embedded: new URLSearchParams(location.search).get('embed') === '1',
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        narrow: matchMedia('(max-width: 760px)').matches,
        fine: matchMedia('(pointer: fine)').matches,
        setExplode: (v) => explodeRef.current?.(v),
      });
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [slug]);
  return null;
}
