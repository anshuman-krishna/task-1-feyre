import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  hue = 180,
  size = 28,
  className,
}: {
  name: string;
  hue?: number;
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-inner",
        className,
      )}
      style={{
        width: px,
        height: px,
        fontSize: size <= 24 ? 9 : size <= 32 ? 10 : 12,
        background: `linear-gradient(135deg, hsl(${hue} 60% 50%), hsl(${(hue + 40) % 360} 60% 40%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
