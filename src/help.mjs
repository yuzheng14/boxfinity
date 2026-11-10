// The popover lives in the browser's top layer, outside the scrollable parameter panel.
export function setupMeasurementHelp({ trigger, panel, sidebar, scroller, onToggle }) {
  let pinned = false, closeTimer;
  const cleanups = [];
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    cleanups.push(() => target.removeEventListener(name, handler, options));
  };
  const isOpen = () => panel.matches(':popover-open');
  function position() {
    const anchor = trigger.getBoundingClientRect(), card = panel.getBoundingClientRect();
    const side = sidebar.getBoundingClientRect(), gap = 12;
    const beside = side.right + gap + card.width <= innerWidth - gap;
    panel.style.left = `${Math.max(gap, Math.min(beside ? side.right + gap : anchor.left, innerWidth - card.width - gap))}px`;
    panel.style.top = `${Math.max(gap, Math.min(beside ? anchor.top - 12 : anchor.bottom + 10, innerHeight - card.height - gap))}px`;
  }
  function open() {
    clearTimeout(closeTimer);
    if (!isOpen()) panel.showPopover();
    onToggle(true); position();
  }
  function close() {
    clearTimeout(closeTimer); pinned = false;
    if (isOpen()) panel.hidePopover();
    onToggle(false);
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pinned && !trigger.matches(':hover') && !panel.matches(':hover') && document.activeElement !== trigger && !panel.contains(document.activeElement)) close();
    }, 140);
  }
  listen(trigger, 'pointerenter', (event) => { if (event.pointerType !== 'touch') open(); });
  listen(trigger, 'pointerleave', scheduleClose);
  listen(trigger, 'focus', open);
  listen(trigger, 'blur', scheduleClose);
  listen(trigger, 'click', () => { if (pinned && isOpen()) close(); else { pinned = true; open(); } });
  listen(panel, 'pointerenter', () => clearTimeout(closeTimer));
  listen(panel, 'pointerleave', scheduleClose);
  listen(document, 'pointerdown', (event) => { if (!trigger.contains(event.target) && !panel.contains(event.target)) close(); });
  listen(document, 'focusin', (event) => { if (!trigger.contains(event.target) && !panel.contains(event.target)) close(); });
  listen(document, 'keydown', (event) => { if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(); } });
  listen(scroller, 'scroll', close, { passive: true });
  listen(window, 'resize', () => { if (isOpen()) position(); });
  return () => {
    clearTimeout(closeTimer);
    cleanups.forEach((cleanup) => cleanup());
    if (isOpen()) panel.hidePopover();
  };
}
