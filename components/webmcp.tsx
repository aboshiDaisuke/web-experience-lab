'use client';
import { useEffect } from 'react';
import { flushSync } from 'react-dom';
const themes = ['CORPORATE', 'LUXURY', 'CREATIVE', 'FUTURE', 'PLAYFUL'];
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export default function WebMCP({
  setTheme,
}: {
  setTheme: (v: string) => void;
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
            name: 'configure_experience_theme',
            description:
              'Apply one of the five visual themes to the adaptive website demo.',
            inputSchema: {
              type: 'object',
              properties: { theme: { type: 'string', enum: themes } },
              required: ['theme'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                !('theme' in input) ||
                typeof input.theme !== 'string' ||
                !themes.includes(input.theme)
              )
                throw new Error(
                  'Choose CORPORATE, LUXURY, CREATIVE, FUTURE or PLAYFUL.',
                );
              const theme = input.theme;
              flushSync(() => setTheme(theme));
              document
                .getElementById('adaptive')
                ?.scrollIntoView({ behavior: 'instant' });
              return { theme, applied: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [setTheme]);
  return null;
}
