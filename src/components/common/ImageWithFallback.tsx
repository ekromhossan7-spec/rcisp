import { useState } from 'react';
import { Wifi } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackTitle = 'Roman Communication',
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EAF2FF] via-white to-slate-100 p-6 text-center text-[#0B1F4D] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Wifi className="mb-2 h-8 w-8 text-[#0B1F4D]/60" />
        <span className="text-sm font-medium text-[#0B1F4D]/80">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
