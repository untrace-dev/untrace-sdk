'use client';

import { FileIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/tabs';
import { CopyButton } from '../custom/copy-button';
import { cn } from '../lib/utils';

export type CodeTab = {
  label: string;
  language: string;
  code: string;
  filename?: string;
};

export type CodeTabsProps = {
  tabs: CodeTab[];
  className?: string;
  defaultTab?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeTabs({ tabs, className, defaultTab, ...props }: CodeTabsProps) {
  const [highlightedCodes, setHighlightedCodes] = useState<
    Record<string, string>
  >({});
  const defaultTabValue = defaultTab || tabs[0]?.label || '';
  const { theme } = useTheme();

  useEffect(() => {
    async function highlightAllCodes() {
      const highlighted: Record<string, string> = {};

      for (const tab of tabs) {
        try {
          const html = await codeToHtml(tab.code, {
            lang: tab.language,
            theme: theme === 'dark' ? 'github-dark' : 'github-light',
          });
          highlighted[tab.label] = html;
        } catch (error) {
          console.error(`Error highlighting code for ${tab.label}:`, error);
          highlighted[tab.label] = `<pre><code>${tab.code}</code></pre>`;
        }
      }

      setHighlightedCodes(highlighted);
    }

    highlightAllCodes();
  }, [tabs, theme]);

  const classNames = cn(
    'not-prose flex w-full flex-col overflow-clip border',
    'border-border bg-card text-card-foreground rounded-xl',
    className,
  );

  return (
    <div className={classNames} {...props}>
      <Tabs className="w-full" defaultValue={defaultTabValue}>
        <div className="flex items-center px-2 pt-2">
          <FileIcon className="mr-2 size-4" />
          <TabsList className="bg-transparent p-0 h-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                className="data-[state=active]:bg-background data-[state=active]:text-foreground"
                key={tab.label}
                value={tab.label}
              >
                {tab.filename || tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent className="mt-0" key={tab.label} value={tab.label}>
            <div className="relative w-full overflow-x-auto text-[13px]">
              <div className="absolute right-2 top-1 z-10">
                <CopyButton
                  size="sm"
                  successMessage={`${tab.filename || tab.label} copied to clipboard`}
                  text={tab.code}
                  variant="outline"
                />
              </div>
              {highlightedCodes[tab.label] ? (
                <div
                  className="[&>pre]:px-2 [&>pre]:py-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-processed code highlighting
                  dangerouslySetInnerHTML={{
                    __html: highlightedCodes[tab.label] ?? '',
                  }}
                />
              ) : (
                <pre>
                  <code>{tab.code}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export { CodeTabs };
