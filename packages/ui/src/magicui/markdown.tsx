/* eslint-disable @typescript-eslint/no-explicit-any */

import { marked } from 'marked';
import { memo, type PropsWithChildren, useId, useMemo } from 'react';
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { CodeBlock, CodeBlockCode } from './code-block';

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token: { raw: string }) => token.raw);
}

function extractLanguage(className?: string): string {
  if (!className) return 'plaintext';
  const match = className.match(/language-(\w+)/);
  if (match?.[1]) return match[1];
  return 'plaintext';
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({
    className,
    children,
    ...props
  }: PropsWithChildren<ExtraProps & { className?: string }>) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <span
          className={cn(
            'bg-primary-foreground rounded-sm px-1 font-mono text-sm',
            className,
          )}
          {...props}
        >
          {children}
        </span>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    );
  },
  pre: function PreComponent({ children }: PropsWithChildren<ExtraProps>) {
    return <>{children}</>;
  },
};

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string;
    components?: Partial<Components>;
  }) {
    return (
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(
    prevProps: { content: string },
    nextProps: { content: string },
  ) {
    return prevProps.content === nextProps.content;
  },
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

  return (
    <div className={className}>
      {blocks.map((block) => (
        <MemoizedMarkdownBlock
          components={components}
          content={block}
          key={`${blockId}-block`}
        />
      ))}
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = 'Markdown';

export { Markdown };
