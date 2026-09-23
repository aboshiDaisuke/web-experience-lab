'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cuboid,
  Footprints,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import type {
  TourController,
  TourMode,
  TourSnapshot,
} from '@/lib/tour/engine';
import {
  getTourProperty,
  type TourProperty,
  type TourRoom,
} from '@/lib/tour/properties';
import { onOpenTour, type OpenTourRequest } from '@/lib/tour/bus';

const MODES: { id: TourMode; label: string; Icon: typeof Cuboid }[] = [
  { id: 'dollhouse', label: 'ドールハウス', Icon: Cuboid },
  { id: 'plan', label: '間取り', Icon: LayoutGrid },
  { id: 'walk', label: '歩いて見る', Icon: Footprints },
];
const MODE_NAME: Record<TourMode, string> = {
  dollhouse: 'ドールハウス表示',
  plan: '間取り表示',
  walk: '歩いて見る',
};

/** property palette → CSS custom properties used by app/tour.css */
export const themeStyle = (p: TourProperty) =>
  ({
    '--tp-paper': p.theme.paper,
    '--tp-ink': p.theme.ink,
    '--tp-accent': p.theme.accent,
    '--tp-night-accent': p.theme.nightAccent ?? p.theme.accent,
  }) as React.CSSProperties;

/** screen area covered by the chrome (px), so views centre in what is left */
const insetsFor = (panel: boolean) =>
  window.innerWidth <= 760
    ? { top: 64, bottom: 112 }
    : { left: panel ? 262 : 0, top: 24, bottom: 84 };

const nameOf = (p: TourProperty, id: string | null) =>
  p.rooms.find((r) => r.id === id)?.name ?? '';
const floorOf = (p: TourProperty, id: string) =>
  p.floors.find((f) => f.id === id)?.label ?? '';

/** what to announce (aria-live) when the engine state changes */
function describe(p: TourProperty, prev: TourSnapshot | null, s: TourSnapshot) {
  if (!s.ready) return null;
  if (!prev?.ready) return `${p.title}の3D内覧を開きました。${MODE_NAME[s.mode]}`;
  if (prev.mode !== s.mode)
    return s.mode === 'walk' && s.room
      ? `${MODE_NAME.walk}。${floorOf(p, s.floor)}・${nameOf(p, s.room)}`
      : MODE_NAME[s.mode];
  if (s.mode === 'walk' && s.room && prev.room !== s.room)
    return `${floorOf(p, s.floor)}・${nameOf(p, s.room)}`;
  if (prev.floor !== s.floor && s.mode !== 'walk') return `${floorOf(p, s.floor)}を表示`;
  if (prev.night !== s.night)
    return s.night ? '夜の照明に切り替えました' : '昼の光に切り替えました';
  if (prev.view !== s.view && s.view) {
    const v = p.views?.find((x) => x.id === s.view);
    if (v) return `${p.viewLabel ?? '眺望'}を${v.label}に切り替えました`;
  }
  return null;
}

type ViewerProps = {
  propertyId?: string;
  mode?: TourMode;
  room?: string;
  intro?: boolean;
  onClose?: () => void;
};

export function TourViewer({
  propertyId = 'casa',
  mode: initialMode = 'dollhouse',
  room: initialRoom,
  intro = true,
  onClose,
}: ViewerProps) {
  const property = getTourProperty(propertyId);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ctrl = useRef<TourController | null>(null);
  const overlayEls = useRef(new Map<string, HTMLElement>());
  const mini = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [snap, setSnap] = useState<TourSnapshot>({
    ready: false,
    mode: initialMode,
    floor: property.floors[0].id,
    room: initialRoom ?? null,
    night: false,
    nightReady: false,
    moving: false,
    view: property.defaultView ?? property.views?.[0]?.id ?? null,
    viewBusy: false,
  });
  const [info, setInfo] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState(true);
  const panelOpen = useRef(true);
  const [hint, setHint] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches);

  const roomsByFloor = useMemo(
    () =>
      property.floors.map((f) => ({
        floor: f,
        rooms: property.rooms.filter((r) => r.floor === f.id),
      })),
    [property],
  );
  const roomName = (id: string | null) => nameOf(property, id);
  const floorLabel = (id: string) => floorOf(property, id);
  // plan labels: a shared open space shows its size once (on its first room)
  const areaOf = (r: TourRoom) => {
    if (r.area) return r.area;
    const z = property.zones?.find((zz) => zz.id === r.zone);
    const first = property.rooms.find((rr) => rr.zone === r.zone);
    return z && first?.id === r.id ? `${z.name} ${z.area}` : '';
  };

  // ------------------------------------------------------------- engine
  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    let disposed = false;
    let c: TourController | null = null;
    let last: TourSnapshot | null = null;
    const onChange = (s: TourSnapshot) => {
      const text = describe(property, last, s);
      if (text) setAnnounce(text);
      if (s.ready && s.mode === 'walk' && (!last?.ready || last.mode !== 'walk')) setHint(true);
      if (s.mode === 'plan' && last?.mode !== 'plan') setInfo(null);
      last = s;
      setSnap(s);
    };
    import('@/lib/tour/engine')
      .then(({ mountTour }) => {
        if (disposed) return;
        c = mountTour(
          host,
          { property, mode: initialMode, room: initialRoom, intro },
          {
            onProgress: (p) => setProgress(p),
            onChange,
            onHoverRoom: (id) => setHover(id),
            onInteract: () => setHint(false),
            onError: () => setError(true),
          },
        );
        ctrl.current = c;
        c.setInsets(insetsFor(panelOpen.current));
        if (location.search.includes('tourdebug')) (window as unknown as { __tour: TourController }).__tour = c;
        overlayEls.current.forEach((el, key) => c!.bindOverlay(key, el));
        c.bindMinimap(mini.current);
      })
      .catch(() => !disposed && setError(true));
    return () => {
      disposed = true;
      c?.dispose();
      ctrl.current = null;
    };
    // mounted once per open (the modal remounts the viewer) and per retry
  }, [attempt, property, initialMode, initialRoom, intro]);

  // one stable ref callback for every engine-positioned overlay (key in data-overlay);
  // React 19 ref cleanups unbind it again
  const bind = useCallback((el: HTMLElement | null) => {
    const key = el?.dataset.overlay;
    if (!el || !key) return;
    overlayEls.current.set(key, el);
    ctrl.current?.bindOverlay(key, el);
    return () => {
      overlayEls.current.delete(key);
      ctrl.current?.bindOverlay(key, null);
    };
  }, []);

  // keep the model centred in the area not covered by panels
  useEffect(() => {
    panelOpen.current = panel;
    const apply = () => ctrl.current?.setInsets(insetsFor(panel));
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [panel, snap.ready]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 6500);
    return () => clearTimeout(t);
  }, [hint]);

  // ------------------------------------------------------------- fullscreen
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    const el = root.current?.closest('dialog') ?? root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  // Esc closes the info card / sheet before the modal
  useEffect(() => {
    if (!info && !sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setInfo(null);
      setSheet(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [info, sheet]);

  // ------------------------------------------------------------- actions
  const c = () => ctrl.current;
  const setMode = (m: TourMode) => {
    c()?.setMode(m);
    setSheet(false);
  };
  const goRoom = (id: string) => {
    c()?.goToRoom(id);
    setSheet(false);
    setInfo(null);
  };
  const ready = snap.ready;
  const currentInfo = property.info.find((i) => i.id === info);
  const multi = property.floors.length > 1;
  const place =
    snap.mode === 'walk' && snap.room
      ? multi
        ? `${floorLabel(snap.floor)}・${roomName(snap.room)}`
        : roomName(snap.room)
      : multi
        ? `${floorLabel(snap.floor)}・${MODE_NAME[snap.mode]}`
        : MODE_NAME[snap.mode];

  const roomList = (
    <div className="tour-roomlist">
      {roomsByFloor.map(({ floor, rooms }) => (
        <section key={floor.id} aria-labelledby={`tour-floor-${floor.id}`}>
          <h3 id={`tour-floor-${floor.id}`}>{floor.label}</h3>
          <ul>
            {rooms.map((r, i) => {
              const zone = property.zones?.find((z) => z.id === r.zone);
              const zoneStart = zone && rooms[i - 1]?.zone !== r.zone;
              return (
                <li key={r.id} className={zone ? 'in-zone' : undefined}>
                  {zoneStart && (
                    <span className="tour-zone">
                      {zone.name}
                      <small>{zone.area}</small>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-current={snap.mode === 'walk' && snap.room === r.id ? 'location' : undefined}
                    disabled={!ready}
                    onClick={() => goRoom(r.id)}
                  >
                    <span>{r.name}</span>
                    {r.area && <small>{r.area}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <div
      ref={root}
      className="tour"
      style={themeStyle(property)}
      data-mode={snap.mode}
      data-ready={ready}
      data-night={snap.night}
      data-touch={touch}
      data-panel={panel}
      data-sheet={sheet}
    >
      <div ref={stage} className="tour-stage" />

      {/* labels & markers positioned by the engine */}
      <div className="tour-overlays">
        {property.rooms.map((r) => (
          <button
            key={r.id}
            ref={bind}
            data-overlay={`room:${r.id}`}
            type="button"
            className="tour-label"
            tabIndex={snap.mode === 'walk' ? -1 : 0}
            onClick={() => goRoom(r.id)}
            aria-label={`${r.name}に入って見る`}
          >
            <span>{r.name}</span>
            {snap.mode === 'plan' && areaOf(r) && <small>{areaOf(r)}</small>}
          </button>
        ))}
        {property.info.map((i) => (
          <button
            key={i.id}
            ref={bind}
            data-overlay={`info:${i.id}`}
            type="button"
            className="tour-pin"
            aria-expanded={info === i.id}
            aria-label={`${i.title}の説明を開く`}
            onClick={() => setInfo(info === i.id ? null : i.id)}
          >
            <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
            <span className="tour-pin-title" aria-hidden="true">
              {i.title}
            </span>
          </button>
        ))}
        <div ref={bind} data-overlay="hover" className="tour-hover" aria-hidden="true">
          {roomName(hover)}
        </div>
      </div>

      <header className="tour-top">
        <div className="tour-brand">
          <span className="tour-eyebrow">3D内覧</span>
          <strong>{property.title}</strong>
          <span className="tour-place">{ready ? place : property.subtitle}</span>
        </div>
        <div className="tour-actions">
          <button
            type="button"
            className="tour-icon desktop-only"
            onClick={() => setPanel(!panel)}
            aria-pressed={panel}
            aria-label={panel ? '部屋の一覧を隠す' : '部屋の一覧を表示'}
          >
            <List size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tour-icon"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? '全画面表示を終了' : '全画面で表示'}
          >
            {fullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
          {onClose && (
            <button type="button" className="tour-close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
              <span>閉じる</span>
            </button>
          )}
        </div>
      </header>

      <aside className="tour-panel" aria-label="部屋の一覧">
        <h2>部屋を選ぶ</h2>
        {roomList}
      </aside>

      <div className="tour-minimap" aria-hidden={snap.mode !== 'walk'}>
        {/* visual aid only: position is announced via the live region, rooms via the list */}
        <canvas
          ref={mini}
          aria-hidden="true"
          onPointerUp={(e) => c()?.minimapPick(e.clientX, e.clientY)}
        />
        <span>{floorLabel(snap.floor)}</span>
      </div>

      <nav className="tour-dock" aria-label="3D内覧の操作">
        <fieldset className="tour-seg tour-modes">
          <legend className="tour-sr">表示の切り替え</legend>
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={snap.mode === id}
              disabled={!ready}
              onClick={() => setMode(id)}
            >
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </fieldset>
        {property.floors.length > 1 && (
          <fieldset className="tour-seg tour-floors">
            <legend className="tour-sr">階の切り替え</legend>
            {property.floors.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={snap.floor === f.id}
                disabled={!ready}
                onClick={() => c()?.setFloor(f.id)}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
        )}
        <fieldset className="tour-seg tour-light">
          <legend className="tour-sr">時間帯</legend>
          <button
            type="button"
            aria-pressed={!snap.night}
            disabled={!ready}
            onClick={() => c()?.setNight(false)}
          >
            <Sun size={15} aria-hidden="true" />
            <span>昼</span>
          </button>
          <button
            type="button"
            aria-pressed={snap.night}
            disabled={!ready}
            aria-busy={snap.night && !snap.nightReady}
            onClick={() => c()?.setNight(true)}
          >
            <Moon size={15} aria-hidden="true" />
            <span>夜</span>
          </button>
        </fieldset>
        {property.views && property.views.length > 1 && (
          <fieldset className="tour-seg tour-views" aria-busy={snap.viewBusy}>
            <legend className="tour-sr">{property.viewLabel ?? '眺望'}の切り替え</legend>
            <span className="tour-seg-label" aria-hidden="true">
              {property.viewLabel ?? '眺望'}
            </span>
            {property.views.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={snap.view === v.id}
                aria-label={`${property.viewLabel ?? '眺望'}：${v.label}`}
                disabled={!ready}
                onClick={() => c()?.setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </fieldset>
        )}
        <button
          type="button"
          className="tour-sheet-btn mobile-only"
          aria-expanded={sheet}
          aria-controls="tour-sheet"
          onClick={() => setSheet(!sheet)}
        >
          <List size={17} aria-hidden="true" />
          <span>部屋</span>
        </button>
      </nav>

      <dialog id="tour-sheet" className="tour-sheet mobile-only" aria-label="部屋の一覧" open={sheet}>
        <div className="tour-sheet-head">
          <h2>部屋を選ぶ</h2>
          <button type="button" className="tour-icon" onClick={() => setSheet(false)} aria-label="一覧を閉じる">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {roomList}
      </dialog>

      {currentInfo && (
        <section className="tour-card" aria-labelledby="tour-card-title" aria-live="polite">
          <span className="tour-eyebrow">見どころ</span>
          <h2 id="tour-card-title">{currentInfo.title}</h2>
          <p>{currentInfo.body}</p>
          <button type="button" className="tour-icon" onClick={() => setInfo(null)} aria-label="説明を閉じる">
            <X size={16} aria-hidden="true" />
          </button>
        </section>
      )}

      <p className="tour-hint" data-on={hint && snap.mode === 'walk' && !snap.moving} aria-hidden="true">
        {touch ? 'スワイプで見回す・床をタップして移動' : 'ドラッグで見回す・床をクリックして移動'}
      </p>

      <div className="tour-loading" data-on={!ready} aria-hidden={ready}>
        {error ? (
          <div className="tour-loading-inner">
            <strong>3D表示を読み込めませんでした</strong>
            <p>通信環境をご確認のうえ、もう一度お試しください。</p>
            <div>
              <button
                type="button"
                className="tour-retry"
                onClick={() => {
                  setError(false);
                  setProgress(0);
                  setAttempt(attempt + 1);
                }}
              >
                もう一度読み込む
              </button>
              {onClose && (
                <button type="button" className="tour-retry ghost" onClick={onClose}>
                  閉じる
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="tour-loading-inner">
            <span className="tour-eyebrow">3D内覧</span>
            <strong>{property.title}</strong>
            <progress
              className="tour-progress"
              aria-label="3Dデータの読み込み"
              max={100}
              value={Math.round(progress * 100)}
            />
            <p>
              3Dデータを読み込んでいます <span>{Math.round(progress * 100)}%</span>
            </p>
          </div>
        )}
      </div>

      <p className="tour-sr" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

/**
 * Full-viewport modal hosting the viewer. Opened through the event bus:
 *   openTour('luce', 'master')  /  openTour({ property: 'casa', mode: 'dollhouse' })
 * Mounting <TourModal /> on a page is optional — `openTour` mounts a shared
 * host on demand. `propertyId` limits a placed modal to one property.
 */
export default function TourModal({
  propertyId,
  initial,
}: {
  propertyId?: string;
  /** request to open with immediately (used by the on-demand host) */
  initial?: OpenTourRequest;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [req, setReq] = useState<(OpenTourRequest & { key: number }) | null>(() =>
    initial ? { ...initial, key: 1 } : null,
  );
  const [closing, setClosing] = useState(false);

  useEffect(
    () =>
      onOpenTour((r) => {
        if (propertyId && r.property && r.property !== propertyId) return false;
        opener.current = document.activeElement as HTMLElement | null;
        setClosing(false);
        setReq({ ...r, property: r.property ?? propertyId, key: Date.now() });
        return true;
      }),
    [propertyId],
  );

  const open = !!req;
  useEffect(() => {
    const d = dialog.current;
    if (!d || !open) return;
    if (!d.open) d.showModal();
    d.focus();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevBody = document.body.style.overflow;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
    // keep keyboard focus inside the dialog
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [
        ...d.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === d)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    d.addEventListener('keydown', trap);
    return () => {
      d.removeEventListener('keydown', trap);
      html.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
      document.body.style.paddingRight = '';
    };
  }, [open]);

  const close = useCallback(() => {
    setClosing(true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    window.setTimeout(() => {
      dialog.current?.close();
      setReq(null);
      setClosing(false);
      opener.current?.focus?.();
    }, 260);
  }, []);

  if (!req) return null;
  const property = getTourProperty(req.property ?? 'casa');
  const mode = req.mode ?? (req.room ? 'walk' : 'dollhouse');
  // portal: page styles (e.g. `.site-casa button`) must not leak into the viewer
  return createPortal(
    <dialog
      ref={dialog}
      className="tour-dialog"
      style={themeStyle(property)}
      data-closing={closing}
      aria-label={`${property.title} 3D内覧`}
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <TourViewer
        key={req.key}
        propertyId={property.id}
        mode={mode}
        room={req.room}
        intro={mode === 'dollhouse'}
        onClose={close}
      />
    </dialog>,
    document.body,
  );
}
