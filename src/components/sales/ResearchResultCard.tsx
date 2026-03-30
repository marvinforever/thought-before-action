import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedMessage } from "@/components/ui/formatted-message";
import { Search, ChevronDown, ChevronUp, ExternalLink, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ResearchResultCardProps {
  query: string;
  summary: string;
  citations?: string[];
}

export function ResearchResultCard({ query, summary, citations }: ResearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Split summary into a short preview and full content
  const lines = summary.split("\n").filter(Boolean);
  const previewLines = lines.slice(0, 3).join("\n");
  const hasMore = lines.length > 3;

  return (
    <Card className="mt-2 border-primary/20 bg-primary/5 overflow-hidden">
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <Search className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium text-primary uppercase tracking-wide">Research Result</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            <Globe className="h-2.5 w-2.5 mr-0.5" />
            Web
          </Badge>
        </div>

        {/* Query */}
        <p className="text-xs text-muted-foreground italic">"{query}"</p>

        {/* Summary Preview */}
        <div className="text-sm">
          <FormattedMessage content={expanded ? summary : previewLines} />
        </div>

        {/* Expand/Collapse */}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1 text-xs text-primary hover:text-primary/80 h-7 px-2"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                See full research
              </>
            )}
          </Button>
        )}

        {/* Citations */}
        <AnimatePresence>
          {expanded && citations && citations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-primary/10 pt-2 space-y-1"
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
              {citations.slice(0, 5).map((url, i) => {
                let displayUrl = url;
                try {
                  const parsed = new URL(url);
                  displayUrl = parsed.hostname.replace("www.", "");
                } catch {}
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{displayUrl}</span>
                  </a>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
