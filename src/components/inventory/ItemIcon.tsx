import { useState } from "react";
import { gradeColor } from "./gradeColor";
import { cn } from "../../lib/cn";

export function ItemIcon({
  url,
  name,
  grade,
  className,
}: {
  url: string | null;
  name: string;
  grade: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-black/20",
          className,
        )}
        title={name}
      >
        <span className="size-2.5 rounded-full" style={{ background: gradeColor(grade) }} />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(
        "size-8 shrink-0 rounded-md border border-border bg-black/30 object-contain p-0.5",
        className,
      )}
      title={name}
    />
  );
}
