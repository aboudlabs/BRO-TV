import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

/** صورة الشعار من /public/logo.png */
export function LogoMark({ size = 40, className, priority }: LogoMarkProps) {
  return (
    <Image
      src="/logo.png"
      alt="BRO TV"
      width={size}
      height={size}
      priority={priority}
      className={cn('rounded-2xl object-cover ring-1 ring-champagne-200/30', className)}
      style={{ width: size, height: size }}
    />
  );
}

interface WordmarkProps {
  size?: number;
  className?: string;
  textClassName?: string;
}

/** الشعار + اسم BRO TV */
export function Wordmark({ size = 40, className, textClassName }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark size={size} priority />
      <span
        dir="ltr"
        className={cn('text-xl font-black tracking-[0.18em] text-champagne-200', textClassName)}
      >
        BRO <span className="text-champagne-400">TV</span>
      </span>
    </span>
  );
}
