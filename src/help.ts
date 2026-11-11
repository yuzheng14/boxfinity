// The popover lives in the browser's top layer, outside the scrollable parameter panel.
export function setupMeasurementHelp({ trigger, panel, sidebar, scroller, onToggle }: {
  trigger: HTMLButtonElement | null; panel: HTMLDivElement | null;
  sidebar: HTMLElement | null; scroller: HTMLDivElement | null; onToggle: (open: boolean) => void;
}) {
  if (!trigger || !panel || !sidebar || !scroller) return;
  // Capture mounted elements so all callbacks retain the validated DOM types.
  const button = trigger, card = panel, aside = sidebar;
  let pinned = false, closeTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof GlobalEventHandlersEventMap>(target: EventTarget, name: K, handler: (event: GlobalEventHandlersEventMap[K]) => void, options?: AddEventListenerOptions) => {
    const listener = handler as EventListener;
    target.addEventListener(name, listener, options);
    cleanups.push(() => target.removeEventListener(name, listener, options));
  };
  const isOpen = () => card.matches(':popover-open');
  function position() {
    const anchor = button.getBoundingClientRect(), bounds = card.getBoundingClientRect();
    const side = aside.getBoundingClientRect(), gap = 12;
    const beside = side.right + gap + bounds.width <= innerWidth - gap;
    card.style.left = `${Math.max(gap, Math.min(beside ? side.right + gap : anchor.left, innerWidth - bounds.width - gap))}px`;
    card.style.top = `${Math.max(gap, Math.min(beside ? anchor.top - 12 : anchor.bottom + 10, innerHeight - bounds.height - gap))}px`;
  }
  function open() {
    clearTimeout(closeTimer);
    if (!isOpen()) card.showPopover();
    onToggle(true); position();
  }
  function close() {
    clearTimeout(closeTimer); pinned = false;
    if (isOpen()) card.hidePopover();
    onToggle(false);
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pinned && !button.matches(':hover') && !card.matches(':hover') && document.activeElement !== button && !card.contains(document.activeElement)) close();
    }, 140);
  }
  listen(trigger, 'pointerenter', (event) => { if (event.pointerType !== 'touch') open(); });
  listen(trigger, 'pointerleave', scheduleClose);
  listen(trigger, 'focus', open);
  listen(trigger, 'blur', scheduleClose);
  listen(trigger, 'click', () => { if (pinned && isOpen()) close(); else { pinned = true; open(); } });
  listen(panel, 'pointerenter', () => clearTimeout(closeTimer));
  listen(panel, 'pointerleave', scheduleClose);
  listen(document, 'pointerdown', (event) => { if (event.target instanceof Node && !button.contains(event.target) && !card.contains(event.target)) close(); });
  listen(document, 'focusin', (event) => { if (event.target instanceof Node && !button.contains(event.target) && !card.contains(event.target)) close(); });
  listen(document, 'keydown', (event) => { if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(); } });
  listen(scroller, 'scroll', close, { passive: true });
  listen(window, 'resize', () => { if (isOpen()) position(); });
  return () => {
    clearTimeout(closeTimer);
    cleanups.forEach((cleanup) => cleanup());
    if (isOpen()) card.hidePopover();
  };
}
