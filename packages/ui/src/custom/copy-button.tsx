'use client';

import { IconCheck, IconCopy, IconLoader2 } from '@tabler/icons-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '../components/button';
import { toast } from '../components/sonner';

export type CopyState = 'idle' | 'copying' | 'copied';

export interface CopyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  onCopied?: () => void;
  showToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
}

export function CopyButton({
  className,
  text,
  onCopied,
  size = 'xs',
  variant,
  showToast = true,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy to clipboard',
  ...props
}: CopyButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copyToClipboard = async () => {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      if (showToast) {
        toast.success(successMessage);
      }
      onCopied?.();
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      if (showToast) {
        toast.error(errorMessage);
      }
      setCopyState('idle');
    }
  };

  return (
    <Button
      aria-label={copyState === 'copied' ? 'Copied' : 'Copy to clipboard'}
      className={className}
      onClick={copyToClipboard}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {copyState === 'copying' ? (
        <IconLoader2 className="text-muted-foreground animate-spin" />
      ) : copyState === 'copied' ? (
        <IconCheck className="text-primary" />
      ) : (
        <IconCopy className="text-muted-foreground" />
      )}
    </Button>
  );
}
