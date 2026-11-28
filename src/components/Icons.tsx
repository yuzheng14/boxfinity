export type IconName =
  | 'box'
  | 'download'
  | 'close'
  | 'draw'
  | 'orbit'
  | 'front'
  | 'printer'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'pull'
  | 'info'
  | 'plus'
  | 'minus'
  | 'reset';

export function Icons() {
  return (
    <svg className="icon-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <symbol id="i-box" viewBox="0 0 24 24">
          <path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9" />
        </symbol>
        <symbol id="i-download" viewBox="0 0 24 24">
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
        </symbol>
        <symbol id="i-close" viewBox="0 0 24 24">
          <path d="m6 6 12 12M18 6 6 18" />
        </symbol>
        <symbol id="i-draw" viewBox="0 0 24 24">
          <path d="M4 4h5M4 4v5M20 4h-5m5 0v5M4 20h5m-5 0v-5M20 20h-5m5 0v-5M9 9h6v6H9z" />
        </symbol>
        <symbol id="i-orbit" viewBox="0 0 24 24">
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
          <ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-30 12 12)" />
          <circle cx="12" cy="12" r="1" />
        </symbol>
        <symbol id="i-front" viewBox="0 0 24 24">
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M5 12h14M12 3v18" />
        </symbol>
        <symbol id="i-printer" viewBox="0 0 24 24">
          <path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 15h12v7H6zM17 12h1" />
        </symbol>
        <symbol id="i-undo" viewBox="0 0 24 24">
          <path d="M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v3" />
        </symbol>
        <symbol id="i-redo" viewBox="0 0 24 24">
          <path d="m15 5 6 6-6 6m6-6H10a6 6 0 0 0-6 6v3" />
        </symbol>
        <symbol id="i-trash" viewBox="0 0 24 24">
          <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
        </symbol>
        <symbol id="i-pull" viewBox="0 0 24 24">
          <path d="M4 9V4h16v5M4 15v5h16v-5M3 12h18m-4-4 4 4-4 4" />
        </symbol>
        <symbol id="i-info" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="i-minus" viewBox="0 0 24 24">
          <path d="M5 12h14" />
        </symbol>
        <symbol id="i-reset" viewBox="0 0 24 24">
          <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
        </symbol>
      </defs>
    </svg>
  );
}
export function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
