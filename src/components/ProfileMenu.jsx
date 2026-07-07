import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui.jsx';
import { getPreferredDisplayName } from '../lib/authAccess';

export function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 180 });

  useEffect(() => {
    const onDoc = (e) => {
      if (!btnRef.current) return;
      if (!btnRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 180;
      let left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
      setCoords({ top: r.bottom + 8, left, width });
    };

    document.addEventListener('click', onDoc);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onDoc);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = 180;
      let left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
      setCoords({ top: r.bottom + 8, left, width });
    }
  }, [open]);

  const name = getPreferredDisplayName(user, 'User');
  const picture = user?.user_metadata?.picture;

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setOpen((s) => !s)} className="flex items-center gap-3 rounded-full hover:bg-secondary/40 p-1">
        {picture ? (
          <img src={picture} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground font-medium">{(name || 'U')[0].toUpperCase()}</div>
        )}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
              className="rounded-lg border border-border bg-card p-2 shadow-soft"
            >
              <div className="px-2 py-2 text-sm">
                <div className="font-medium">{name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">Signed in</div>
              </div>
              <div className="mt-2 border-t border-border/70 pt-2">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { /* profile */ }}>
                  Profile
                </Button>
                <Button variant="outline" size="sm" className="mt-2 w-full justify-start" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default ProfileMenu;
