import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

declare const __BUILD_TIME_ISO__: string;

export function BuildStamp() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const info = useMemo(() => {
    const u = new URL(window.location.href);
    return {
      host: u.host,
      path: `${u.pathname}${u.search}${u.hash}`,
      build: __BUILD_TIME_ISO__,
      seenAt: new Date(now).toISOString(),
    };
  }, [now]);

  return (
    <div className="fixed bottom-0 left-0 z-[60] select-none opacity-30 hover:opacity-100 transition-opacity">
      <span className="font-mono text-[8px] text-muted-foreground px-1">
        {info.build.slice(0, 16)}
      </span>
    </div>
  );
}
