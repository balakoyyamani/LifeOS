import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

export function ModalPortal({ children, lockScroll = true }: ModalPortalProps) {
  useEffect(() => {
    if (!lockScroll || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lockScroll]);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
