'use client';
import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { projects } from '@/lib/portfolio';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export default function WebMCP({
  selectProject,
  setMobile,
}: {
  selectProject: (index: number) => void;
  setMobile: (mobile: boolean) => void;
}) {
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'preview_portfolio_project',
            description:
              'Select a portfolio project and optionally its desktop or phone viewport in the live preview. This starts loading the selected page.',
            inputSchema: {
              type: 'object',
              properties: {
                slug: { type: 'string', enum: projects.map((p) => p.slug) },
                device: { type: 'string', enum: ['desktop', 'phone'] },
              },
              required: ['slug'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                !('slug' in input) ||
                typeof input.slug !== 'string'
              )
                throw new Error('A valid project slug is required.');
              const index = projects.findIndex((p) => p.slug === input.slug);
              if (index === -1) throw new Error('Project not found.');
              if (
                'device' in input &&
                input.device !== 'desktop' &&
                input.device !== 'phone'
              )
                throw new Error('Device must be desktop or phone.');
              flushSync(() => {
                selectProject(index);
                if ('device' in input) setMobile(input.device === 'phone');
              });
              return {
                selected: projects[index].slug,
                url: `/works/${projects[index].slug}`,
                navigationStarted: true,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [selectProject, setMobile]);
  return null;
}
