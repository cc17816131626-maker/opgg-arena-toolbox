import { useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { ensureImageCached, resolveImageSrc } from "../lib/imageCache";

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * 通用的“本地优先”图片组件：英雄头像 / 装备图标 / 海克斯图标都用它。
 * 先用内存缓存里已经解析好的本地路径（如果预热过），没有的话先用远程地址垫着，
 * 同时在后台请求 Rust 端按需下载缓存一次，缓存好之后自动切换成本地路径，
 * 这样下次哪怕断网也能直接从本地读。
 */
export function CachedImage({ src, alt, onError, ...rest }: CachedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(() => resolveImageSrc(src));

  useEffect(() => {
    setResolvedSrc(resolveImageSrc(src));
    let cancelled = false;
    ensureImageCached(src).then((localSrc) => {
      if (!cancelled) setResolvedSrc(localSrc);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
        onError?.(e);
      }}
      {...rest}
    />
  );
}
