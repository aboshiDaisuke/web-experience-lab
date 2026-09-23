import { BASE } from '@/lib/base-path';
/**
 * Property definitions for the 3D tour viewer.
 *
 * Everything that differs between properties lives here; the engine only
 * relies on the asset conventions below, so a new property is added by
 * exporting its assets from Blender and adding one entry to `tourProperties`.
 *
 * Asset conventions (glTF, Y-up, metres) — see also README notes in the
 * final report:
 *   - top-level group nodes named after `floors[].groups`, `floors[].ceiling`,
 *     `site` and `roof`
 *   - baked static geometry: `<GROUP>_mesh` with extras `lightmap: '<id>-<GROUP>'`
 *     and a second UV set (TEXCOORD_1) → `<base>/<id>-<GROUP>-day.webp` / `-night.webp`
 *   - `<id>-bake.json` → `{ scale }` (lightmap encoding: enc = (L / scale)^(1/2.2))
 *   - `NAV_<FLOOR>_*` invisible walkable planes, `HS_<roomId>` viewpoints at
 *     floor level, `WP_*` stair waypoints (listed in `stairs`), `INFO_<id>` tags
 *   - glass material named `Glass`, impostor tree cards `Card_*`, emissive
 *     lamp shades `LampWarm`
 */

export type TourFloor = {
  /** floor id, also the group node name that holds the storey */
  id: string;
  /** UI label, e.g. 1階 */
  label: string;
  /** compact label for the floor switcher, e.g. 1F */
  short: string;
  /** node names that make up the storey (walls, floor, furniture) */
  groups: string[];
  /** node names hidden in dollhouse / plan when this floor or a lower one is selected */
  ceiling: string[];
  /** finished floor level in metres */
  elevation: number;
  /** height of the cut-away section (metres above elevation) used while switching floors */
  cutHeight: number;
  /** room entered when switching to this floor in walkthrough */
  entryRoom: string;
};

export type TourRoom = {
  id: string;
  name: string;
  floor: string;
  /** size shown in lists / plan, e.g. 約6帖 */
  area?: string;
  /** rooms sharing one open space (LDK) */
  zone?: string;
  /** optional look direction in degrees (0 = north / -Z, 90 = east / +X) */
  look?: number;
};

export type TourZone = { id: string; name: string; area: string };

export type TourInfo = { id: string; title: string; body: string };

export type TourFraming = {
  /** degrees, 0 = looking from the south (+Z) towards north */
  yaw: number;
  /** degrees above the horizon */
  pitch: number;
  distance: number;
  fov: number;
  /** orbit target (x, z); y follows the selected floor. Default: centre of the building */
  target?: [number, number];
  minDistance: number;
  maxDistance: number;
};

/** alternative outlook panoramas (e.g. the same unit on different storeys) */
export type TourView = {
  id: string;
  /** UI label, e.g. 12階 */
  label: string;
  /** equirect files in `base` */
  day: string;
  night: string;
};

/** UI palette (CSS colours); night mode darkens the panels automatically */
export type TourTheme = {
  paper: string;
  ink: string;
  accent: string;
  /** accent used on dark panels at night */
  nightAccent?: string;
};

export type TourProperty = {
  id: string;
  title: string;
  subtitle: string;
  /** folder under /public */
  base: string;
  model: string;
  skyDay: string;
  skyNight: string;
  floors: TourFloor[];
  site: string[];
  roof: string[];
  rooms: TourRoom[];
  zones?: TourZone[];
  info: TourInfo[];
  /** ordered stair waypoints from the lower to the upper floor */
  stairs: string[][];
  startRoom: string;
  dollhouse: TourFraming;
  /** top-down plan: field of view (narrow = near-orthographic) and optional centre */
  plan: { fov: number; target?: [number, number] };
  /** exposure per lighting state (tone mapping is Khronos PBR Neutral) */
  exposure: { day: number; night: number };
  /** extra exposure multiplier while walking inside (camera-like auto exposure) */
  walkBoost?: { day: number; night: number };
  /** eye height above the floor, metres */
  eyeHeight: number;
  /** direction towards the baked sun (lights non-baked trees / glass), three.js axes */
  sun?: [number, number, number];
  /**
   * landscape handling: `ground` extends the lot to the horizon (houses);
   * `false` keeps the full panorama visible below the horizon (apartments)
   */
  horizon?: 'ground' | 'panorama';
  /** optional outlook switch (skyDay/skyNight are used when absent) */
  views?: TourView[];
  defaultView?: string;
  /** label of the outlook switch, e.g. 眺望 */
  viewLabel?: string;
  theme: TourTheme;
};

const casa: TourProperty = {
  id: 'casa',
  title: 'CASA MIRAI',
  subtitle: '2階建て・4LDK＋スタディ',
  base: `${BASE}/models/tour/casa`,
  model: 'casa.glb',
  skyDay: 'sky-day.jpg',
  skyNight: 'sky-night.jpg',
  floors: [
    {
      id: 'F1',
      label: '1階',
      short: '1F',
      groups: ['F1'],
      ceiling: ['F1_CEIL'],
      elevation: 0.45,
      cutHeight: 2.66,
      entryRoom: 'living',
    },
    {
      id: 'F2',
      label: '2階',
      short: '2F',
      groups: ['F2'],
      ceiling: [],
      elevation: 3.6,
      cutHeight: 2.6,
      entryRoom: 'hall2',
    },
  ],
  site: ['SITE'],
  roof: ['ROOF'],
  zones: [{ id: 'ldk', name: 'LDK', area: '約47帖（76.6㎡）' }],
  rooms: [
    { id: 'living', name: 'リビング', floor: 'F1', zone: 'ldk', look: 62 },
    { id: 'dining', name: 'ダイニング', floor: 'F1', zone: 'ldk', look: 225 },
    { id: 'kitchen', name: 'キッチン', floor: 'F1', zone: 'ldk', look: 245 },
    { id: 'study', name: 'スタディ', floor: 'F1', area: '約6帖', look: 20 },
    { id: 'genkan', name: '玄関', floor: 'F1', area: '約6帖', look: 200 },
    { id: 'hall1', name: '廊下', floor: 'F1' },
    { id: 'wash', name: '洗面室', floor: 'F1', area: '約3.4帖' },
    { id: 'bath', name: '浴室', floor: 'F1', area: '約4帖' },
    { id: 'terrace', name: 'ウッドデッキ', floor: 'F1', area: '約39㎡', look: 345 },
    { id: 'hall2', name: '2階ホール', floor: 'F2' },
    { id: 'master', name: '主寝室', floor: 'F2', area: '約28帖', look: 195 },
    { id: 'wic', name: 'ウォークインクローゼット', floor: 'F2', area: '約7.7帖' },
    { id: 'bed2', name: '子ども部屋1', floor: 'F2', area: '約18帖', look: 165 },
    { id: 'bed3', name: '子ども部屋2', floor: 'F2', area: '約18帖', look: 195 },
  ],
  info: [
    {
      id: 'island',
      title: 'アイランドキッチン',
      body: '幅2.4m・大理石天板。ダイニングと一続きの配置です。',
    },
    {
      id: 'glazing',
      title: '南面の全開口サッシ',
      body: '幅10.2m。庭とデッキにそのまま出られます。',
    },
    {
      id: 'stairs',
      title: 'オープン階段',
      body: 'オーク材の踏板と黒い鉄のささら桁。',
    },
    { id: 'bath', title: '浴室', body: '窓のある明るいタイル張りの浴室。' },
    {
      id: 'deck',
      title: 'ウッドデッキ',
      body: '約39㎡。2階の張り出しが日差しをやわらげます。',
    },
    {
      id: 'master',
      title: '主寝室の大開口',
      body: '床から天井までの窓で朝の光を取り込みます。',
    },
    {
      id: 'void',
      title: '吹き抜け',
      body: '階段上の高窓から1階へ光を落とします。',
    },
  ],
  stairs: [['WP_stair_f1', 'WP_stair_mid', 'WP_stair_top', 'WP_stair_f2']],
  startRoom: 'living',
  dollhouse: {
    yaw: 32,
    pitch: 36,
    distance: 27,
    fov: 38,
    target: [7, -3],
    minDistance: 12,
    maxDistance: 46,
  },
  plan: { fov: 18, target: [7, -3.2] },
  exposure: { day: 1.0, night: 0.95 },
  walkBoost: { day: 3.0, night: 1.15 },
  eyeHeight: 1.55,
  horizon: 'ground',
  theme: { paper: '#eeeee6', ink: '#26332a', accent: '#3d5141', nightAccent: '#d9c7a2' },
  // Blender sun: elevation 42° tilt, azimuth -40° → afternoon sun from the south-west
  sun: [-0.43, 0.74, 0.51],
};

/*
 * LUCE HILLS 目黒 — single-floor condo, added by config only (same asset
 * conventions: groups F1 / F1_CEIL, NAV_F1_*, HS_*, INFO_*). The outside is a
 * rendered city panorama per storey instead of a site model.
 */
const luce: TourProperty = {
  id: 'luce',
  title: 'MIRAI HILLS 目黒',
  subtitle: '3LDK・12階',
  base: `${BASE}/models/tour/luce`,
  model: 'luce.glb',
  skyDay: 'sky-day.jpg',
  skyNight: 'sky-night.jpg',
  floors: [
    {
      id: 'F1',
      label: '住戸',
      short: '住戸',
      groups: ['F1'],
      ceiling: ['F1_CEIL'],
      elevation: 0,
      cutHeight: 2.62,
      entryRoom: 'living',
    },
  ],
  site: [],
  roof: [],
  zones: [
    { id: 'ldk', name: 'LD・K', area: '19.5帖（31.7㎡）' },
    { id: 'balcony', name: 'バルコニー', area: '33.9㎡' },
  ],
  rooms: [
    { id: 'living', name: 'リビング', floor: 'F1', zone: 'ldk', look: 145 },
    { id: 'dining', name: 'ダイニング', floor: 'F1', zone: 'ldk', look: 115 },
    { id: 'kitchen', name: 'キッチン', floor: 'F1', zone: 'ldk', look: 100 },
    { id: 'master', name: '洋室1', floor: 'F1', area: '8.4帖', look: 175 },
    { id: 'room2', name: '洋室2', floor: 'F1', area: '5.8帖' },
    { id: 'room3', name: '洋室3', floor: 'F1', area: '5.8帖' },
    { id: 'genkan', name: '玄関', floor: 'F1', look: 180 },
    { id: 'hall', name: '廊下', floor: 'F1' },
    { id: 'wash', name: '洗面室', floor: 'F1' },
    { id: 'bath', name: '浴室', floor: 'F1' },
    { id: 'wc', name: 'トイレ', floor: 'F1' },
    { id: 'balcony', name: 'バルコニー', floor: 'F1', zone: 'balcony', look: 170 },
    { id: 'balcony_e', name: 'バルコニー（東）', floor: 'F1', zone: 'balcony', look: 110 },
  ],
  info: [
    { id: 'corner', title: 'コーナーサッシ', body: '南と東、2面に広がる床から2.3mの窓。' },
    { id: 'kitchen', title: '対面キッチン', body: 'リビングを見渡せるペニンシュラ型。食洗機付き。' },
    { id: 'view', title: '眺望', body: '目黒の街並みと遠くの超高層。階数で眺めが変わります。' },
    { id: 'bath', title: '浴室', body: '1620サイズのユニットバス。浴室乾燥機付き。' },
    { id: 'wardrobe', title: 'ウォークスルー収納', body: '洋室1の壁一面の収納。' },
    { id: 'ceiling', title: '天井高2.5m', body: '梁の出ない、すっきりとした天井。' },
  ],
  stairs: [],
  startRoom: 'living',
  dollhouse: { yaw: 28, pitch: 42, distance: 17, fov: 38, minDistance: 8, maxDistance: 30 },
  plan: { fov: 18 },
  exposure: { day: 1.0, night: 1.1 },
  walkBoost: { day: 1.6, night: 1.0 },
  eyeHeight: 1.5,
  horizon: 'panorama',
  views: [
    { id: '13m', label: '5階', day: 'view-13m-day.jpg', night: 'view-13m-night.jpg' },
    { id: '34m', label: '12階', day: 'view-34m-day.jpg', night: 'view-34m-night.jpg' },
    { id: '58m', label: '20階', day: 'view-58m-day.jpg', night: 'view-58m-night.jpg' },
  ],
  defaultView: '34m',
  viewLabel: '眺望',
  theme: { paper: '#f3f4f2', ink: '#16202a', accent: '#a8844f', nightAccent: '#c9a56a' },
};

export const tourProperties: Record<string, TourProperty> = { casa, luce };

export const getTourProperty = (id: string): TourProperty =>
  tourProperties[id] ?? tourProperties.casa;
