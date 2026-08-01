import clsx from "clsx";
import { CachedImage } from "./CachedImage";

export function ChampionAvatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <CachedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={clsx("rounded-xl bg-white/5 object-cover ring-1 ring-white/10", className)}
      style={{ width: size, height: size }}
    />
  );
}
