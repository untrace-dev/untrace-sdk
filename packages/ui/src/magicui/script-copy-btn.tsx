'use client';

import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { type HTMLAttributes, useEffect, useId, useState } from 'react';
import { Button } from '../components/button';
import { CopyButton } from '../custom/copy-button';
import { cn } from '../lib/utils';

interface ScriptCopyBtnProps extends HTMLAttributes<HTMLDivElement> {
  showMultiplePackageOptions?: boolean;
  codeLanguage?: string; // Made optional since we'll use languageMap
  lightTheme: string;
  darkTheme: string;
  commandMap: Record<string, string>;
  copyTextMap?: Record<string, string>; // Optional prop for different copy text
  languageMap?: Record<string, string>; // New prop for language-specific highlighting
  className?: string;
}

export function ScriptCopyBtn({
  showMultiplePackageOptions = true,
  codeLanguage,
  lightTheme,
  darkTheme,
  commandMap,
  copyTextMap,
  languageMap,
  className,
}: ScriptCopyBtnProps) {
  const packageManagers = Object.keys(commandMap);
  const [packageManager, setPackageManager] = useState<string>(
    packageManagers[0] ?? '',
  );
  // Generate a unique ID for this instance
  const instanceId = useId();
  const [highlightedCode, setHighlightedCode] = useState('');
  const { theme } = useTheme();
  const command = commandMap[packageManager] ?? '';
  const copyText = copyTextMap?.[packageManager] ?? command;

  useEffect(() => {
    async function loadHighlightedCode() {
      try {
        const { codeToHtml } = await import('shiki');
        // Use languageMap if available, otherwise fall back to codeLanguage
        const language =
          languageMap?.[packageManager] || codeLanguage || 'bash';
        const highlighted = await codeToHtml(command, {
          defaultColor: theme === 'dark' ? 'dark' : 'light',
          lang: language,
          themes: {
            dark: darkTheme,
            light: lightTheme,
          },
        });
        setHighlightedCode(highlighted);
      } catch (error) {
        console.error('Error highlighting code:', error);
        setHighlightedCode(`<pre>${command}</pre>`);
      }
    }

    loadHighlightedCode();
  }, [
    command,
    theme,
    codeLanguage,
    languageMap,
    packageManager,
    lightTheme,
    darkTheme,
  ]);

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="w-full space-y-2">
        <div className="mb-2 flex items-center justify-center">
          {showMultiplePackageOptions && (
            <div className="relative">
              <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                {packageManagers.map((pm, index) => (
                  <div className="flex items-center" key={pm}>
                    {index > 0 && (
                      <div aria-hidden="true" className="h-4 w-px bg-border" />
                    )}
                    <Button
                      className={`relative rounded-none bg-background px-2 py-1 hover:bg-background ${
                        packageManager === pm
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                      onClick={() => setPackageManager(pm)}
                      size="sm"
                      variant="ghost"
                    >
                      {pm}
                      {packageManager === pm && (
                        <motion.div
                          className="absolute inset-x-0 bottom-[1px] mx-auto h-0.5 w-[90%] bg-primary"
                          initial={false}
                          layoutId={`activeTab-${instanceId}`}
                          transition={{
                            damping: 30,
                            stiffness: 500,
                            type: 'spring',
                          }}
                        />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative flex gap-2 w-full">
          <div className="font-mono flex-1">
            {highlightedCode ? (
              <div
                className={`[&>pre]:overflow-x-auto [&>pre]:rounded-md [&>pre]:p-2 [&>pre]:px-4 [&>pre]:font-mono bg-muted rounded h-9 ${
                  theme === 'dark' ? 'dark' : 'light'
                }`}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ok
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            ) : (
              <pre className="rounded-md border border-border bg-muted p-2 px-4 font-mono dark:bg-black">
                {command}
              </pre>
            )}
          </div>
          <CopyButton
            className="flex-shrink-0"
            size="sm"
            text={copyText}
            variant="outline"
          />
        </div>
      </div>
    </div>
  );
}
