import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface FormattedMessageProps {
  content: string;
  className?: string;
}

export function FormattedMessage({ content, className }: FormattedMessageProps) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        components={{
          // Headings
          h1: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2 first:mt-0">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
          ),
          h4: ({ children }) => (
            <h5 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h5>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc pl-4 mb-2 space-y-1 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 mb-2 space-y-1 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          // Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          // Code
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted/50 rounded px-1.5 py-0.5 text-[0.85em] font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-muted/50 rounded-lg p-3 text-[0.85em] font-mono overflow-x-auto my-2">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2">{children}</pre>
          ),
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic my-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-3 border-border" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
