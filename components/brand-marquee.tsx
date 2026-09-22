const words: Record<string, string[]> = {
  nova: ['Precision engineering', '技術のその先に', 'Industrial systems', '新しいあたりまえを', 'Research & development'],
  lumina: ['Be yourself, beautifully', '似合う、の先へ', 'Cut · Color · Care', '私らしさに出会う'],
  noir: ['Cuisine de saison', '季節を味わう', 'Autumn 2026', '余韻を愉しむ'],
  eclat: ['Less, but with soul', 'Maison de cuir', '日々に寄り添う', 'Fait à la main'],
  aether: ['Designed around sound', '360° sound', '音のかたち', 'Less noise, more music'],
  casa: ['A house for slow living', '光と、余白と', 'Residence N01', '暮らしていく'],
  room: ['Web', 'Photo', 'Motion', 'Ideas from this room', 'つくることを、日常に'],
  yui: ['Stillness', 'Portrait', 'Landscape', '日々の余白を写す'],
  adapt: ['Trust', 'Refinement', 'Expression', 'Possibility', 'Play'],
  offgrid: ['Off the grid', '2026.10.17 — 18', 'Music · Food · Mountain', 'いつもの、外へ'],
};

export default function BrandMarquee({ slug }: { slug: string }) {
  const list = words[slug] ?? words.nova;
  const run = [...list, ...list];
  return (
    <div className={`m-marquee m-marquee-${slug}`} aria-hidden="true">
      <div className="m-marquee-track">
        {[...run, ...run].map((w, i) => (
          <span key={i}>
            {w}
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}
