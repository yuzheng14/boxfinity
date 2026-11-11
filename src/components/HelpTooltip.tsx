import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setupHelpTooltip } from '../help.ts';

export interface HelpContext {
  sidebarRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
}
interface HelpTooltipProps extends HelpContext {
  id: string;
  label: string;
  action?: string;
  children: ReactNode;
  className?: string;
}

export function HelpTooltip({
  id,
  label,
  action = '查看参数说明',
  children,
  className = '',
  sidebarRef,
  scrollRef,
}: HelpTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null),
    panelRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(
    () =>
      setupHelpTooltip({
        trigger: triggerRef.current,
        panel: panelRef.current,
        sidebar: sidebarRef.current,
        scroller: scrollRef.current,
        onToggle: setExpanded,
      }),
    [sidebarRef, scrollRef],
  );
  return (
    <>
      <button
        ref={triggerRef}
        id={`${id}-button`}
        className="heading-help"
        type="button"
        aria-label={`${label}：${action}`}
        aria-controls={id}
        aria-expanded={expanded}
        aria-describedby={expanded ? id : undefined}
      >
        {label}
      </button>
      {createPortal(
        <div
          ref={panelRef}
          id={id}
          className={`measurement-help ${className}`}
          popover="manual"
          role="tooltip"
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
