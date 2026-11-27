import { Package } from 'lucide-react';
import { useState } from 'react';
import { assetUrl } from '@/api/client';
import { cn } from '@/lib/format';

/** Product photo served by the backend, with a plain icon if it cannot load. */
export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  if (!url || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-paper border border-line text-ink-faint rounded-xl', className)} role="img" aria-label={alt}>
        <Package className="w-1/2 h-1/2" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-contain bg-white border border-line rounded-xl p-0.5', className)}
    />
  );
}
