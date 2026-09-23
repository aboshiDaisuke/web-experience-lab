'use client';
import { useEffect } from 'react';
import { projects } from '@/lib/portfolio';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export default function WebMCP() {
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
            name: 'open_portfolio_project',
            description:
              'Open the page of a portfolio project. This navigates away from the current page.',
            inputSchema: {
              type: 'object',
              properties: {
                slug: { type: 'string', enum: projects.map((p) => p.slug) },
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
              const url = `/works/${projects[index].slug}`;
              location.assign(url);
              return { opened: projects[index].slug, url, navigationStarted: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  return null;
}
