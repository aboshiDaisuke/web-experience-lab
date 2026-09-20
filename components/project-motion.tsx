'use client';
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
export default function ProjectMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.project-site');
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils
        .toArray<HTMLElement>(
          '.nova-technology .depth-photo,.salon-space>img,.chef-editorial>img,.restaurant-space>img,.journal-spread>img,.nova-people>img',
        )
        .forEach((el) =>
          gsap.fromTo(
            el,
            { clipPath: 'inset(8% 0 8% 0)' },
            {
              clipPath: 'inset(0% 0 0% 0%)',
              ease: 'none',
              scrollTrigger: {
                trigger: el,
                start: 'top 90%',
                end: 'center 65%',
                scrub: 0.8,
              },
            },
          ),
        );
      gsap.utils
        .toArray<HTMLElement>('.image-index,.salon-location,.chef-signature')
        .forEach((el) =>
          gsap.from(el, {
            y: 18,
            duration: 0.9,
            scrollTrigger: { trigger: el, start: 'top 95%', once: true },
          }),
        );
    }, root);
    const refresh = () => ScrollTrigger.refresh();
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) =>
      img.addEventListener('load', refresh, { once: true }),
    );
    return () => {
      ctx.revert();
      imgs.forEach((img) => img.removeEventListener('load', refresh));
    };
  }, []);
  return null;
}
