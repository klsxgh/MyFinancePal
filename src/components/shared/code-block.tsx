
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
}

export default function CodeBlock({ code, language = 'bash', fileName }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = async () => {
    if (!mounted) return; // navigator not available server-side
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      toast({ title: "Copied!", description: `${fileName || 'Code'} copied to clipboard.` });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({ variant: "destructive", title: "Copy failed", description: "Could not copy code to clipboard." });
      console.error('Failed to copy: ', err);
    }
  };

  if (!mounted) {
    return (
      <div className="relative my-4 rounded-lg border bg-muted/30 shadow-sm">
        {fileName && (
          <div className="px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            {fileName}
          </div>
        )}
        <pre className="p-4 text-sm overflow-x-auto font-mono bg-card text-card-foreground">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="relative my-4 rounded-lg border bg-muted/30 shadow-sm">
      {(fileName || mounted) && (
        <div className="flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground border-b">
          <span>{fileName || language}</span>
          {mounted && (
            <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7">
              {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Copy code</span>
            </Button>
          )}
        </div>
      )}
      <pre className="p-4 text-sm overflow-x-auto font-mono bg-card text-card-foreground">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}
