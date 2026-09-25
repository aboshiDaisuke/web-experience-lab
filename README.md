# WEB EXPERIENCE LAB — Web制作ポートフォリオ

トップは制作依頼につなげるためのポートフォリオです。ヒーロー（15作品を印刷した紙が降ってきて束になり、いちばん上をつまんで投げると次の作品が現れる）→ 作品一覧（目的別の絞り込み・カードから作品へ）→ できること → 料金の目安 → 制作の流れ・FAQ → 相談フォーム、の順に並びます。各作品ページ右下からも、その作品を引き継いで相談フォームへ移動できます（`/?ref=<slug>#contact`）。

作品名は「MIRAI NOVA」「TABLE 未来」「OFF GRID みらい」のように、すべて みらい／MIRAI／未来 のいずれかを含みます（slug・URLは旧名のまま）。

- `components/studio/`: トップの各セクション（hero / works / contact）
- `lib/scenes/aquarium/`: ヒーローの熱帯魚水槽（WebGL）。魚は `tools/blender/fish.py`、石と流木は `tools/blender/hardscape.py` でBlenderから生成（`tools/blender/aquarium_build.sh` で `public/models/aquarium/` に再出力、Draco圧縮）。泳ぎは頂点シェーダ（体の波・ひれ）、群れはboids、水面の揺れで屈折した光（コースティクス）を計算してランプの光に掛け、影の中では消える。ガラスに近づくと魚が寄り、たたくと散る
- `lib/studio.ts`: 目的別の分類、制作規模の目安、サービス、料金、流れ、FAQ、**フォームの送信先 `contactEndpoint`**
- `app/studio.css`: トップと相談ボタンのスタイル
- `public/images/works/<slug>-desktop.jpg / -mobile.jpg`: 各作品の実画面キャプチャ（作品を変えたら撮り直す。`/works/<slug>?embed=1` を 1440×900 と 390×844@2x で、スクロールバー非表示で撮影）

相談フォームは `contactEndpoint` が空のあいだは確認画面まで動き、送信はしません（完了画面にもその旨を表示）。Formspree等の受信URLを入れるとJSONでPOSTします。料金・納期・オプションは FTL「デジタル広報支援サービス」2026年度版（https://www.ftl.co.jp/products.html）に合わせています（3D・インタラクティブは個別お見積り）。改定があれば `lib/studio.ts` を書き換えてください。

## 作品ページの演出（signatures）

共通の演出は置かず、作品ごとに業種に根ざした仕掛けを1つずつ実装。`components/project-motion.tsx` が `lib/signatures/<slug>.ts` を読み込み、スタイルは `app/signatures/<slug>.css`。

| 作品 | 仕掛け |
|---|---|
| MIRAI NOVA | 設計図化した写真の上を検査レンズが動き、実写を拡大。クリックで寸法計測 |
| LUMINA MIRAI | 流体シミュレーションで、なでると髪がシルクのように流れる |
| TABLE 未来 | マッチを擦って灯る、カーソルのろうそく。料理と皿を照らし湯気が立つ |
| MAISON MIRAI | スクロールで針が革の縫い目を縫い進める。バッグは立体的に傾く |
| MIRAI ONE | 「音を聴く」で生成サウンドが鳴り、波紋と分解が音に反応。スクロールで分解 |
| CASA MIRAI | 図面の線画から1フロアずつ建ち上がり、スクロールで16:40→21:30へ |
| THE MIRAI ROOM | 道具を選ぶと、その仕事（コード→サイト、撮影→現像、本、モーション）を実演 |
| MIRAI TAKAHASHI | ネガから現像される写真。カーソルがファインダーになり撮影、フィルムに残る |
| MIRAI / YOU | 押した位置からインクのように新しいスタイルが広がり、見出しが新しい声で打ち直される |
| OFF GRID みらい | 日常の通知の山を、スクロールで風が吹き飛ばして山が現れる |

### 地域のお店・公共施設（2026-09 追加）

この4作品は、ページ全体を1つのコンポーネントで持つ自己完結型です（LUCEと同じ方式）。本体は `components/works/<slug>-site.tsx`、演出やデータは `lib/works/<slug>/`、スタイルは `app/signatures/<slug>.css`。ヘッダーの表記・アンカー・問い合わせ名は `components/project-experience.tsx` の `localSites` で設定します。

| 作品 | 仕掛け |
|---|---|
| MIRAI MOTORS（車の販売・整備） | ページが夜の高速道路（three.js）。スクロールがアクセルで、頭上の案内標識が在庫車・車検・買取査定への出口になる。トンネル、料金所を抜けて本文へ。在庫検索、ローン試算、車検のX線点検、買取の簡易査定 |
| やおや みらい（八百屋） | 布シミュレーションの藍染のれんをくぐって入店。野菜をつかんでかごへ放ると取り置きメモになる。チョークで書かれていく黒板、旬の早見盤、商店街マップ |
| みらい市立図書館 | 約400冊の背表紙が並ぶ本棚そのものが検索窓。打つたびに該当の本が迫り出し、手に取ると表紙になって開き、予約まで進める。開館カレンダーは休館日の規則から自動計算 |
| 未来市役所 | 用件を選ぶと発券機から番号札が印刷され、手続きリストと窓口までの道順（1F・2Fの立体フロアマップ）になる。文字サイズ・配色・やさしい日本語・ふりがな・読み上げに即時切り替え。ごみ分別検索、防災情報 |

いずれも画面外・非表示タブで停止、埋め込み・スマホ・動きを減らす設定に対応。写真に手合わせした値（CASAの階高、LUMINAの髪マスクなど）を含むため、写真を差し替える場合は各ファイルの調整が必要。

## 3D内覧（Blender → WebGL）

CASA MIRAI（戸建て）と MIRAI HILLS 目黒（分譲マンション）は、Blenderで作った住まいを歩いて内覧できます。

- ビューア: `lib/tour/engine.ts`（three.js）、`lib/tour/nav.ts`（歩ける範囲・経路探索）、`lib/tour/materials.ts`（昼夜ライトマップのクロスフェード）、`lib/tour/properties.ts`（物件ごとの部屋・帖数・説明タグ）、UIは `components/tour/`
- どこからでも開ける: `openTour('luce')` / `openTour('casa', 'master')`（`lib/tour/bus.ts`）
- モード: ドールハウス / 間取り / 歩いて見る。階の切り替え、昼夜、ミニマップ、説明タグ。LUCEは眺望を5階・12階・20階で切り替え
- LUCEのページは `components/luce-site.tsx`（360°眺望ビューア `lib/luce/pano.ts`）

### 制作パイプライン（`tools/blender/`）
Blender 5.x をコマンドラインで実行（GUI・アドオン不要）。素材は Poly Haven（CC0）のテクスチャ・HDRI・植物モデル。

1. `blender -b --factory-startup -P casa.py`（または `luce.py`）: `archkit.py` で壁・開口・窓・階段・家具を生成し `.blend` を保存。樹木は `impostor.py` で描き出した透過カード
2. `blender -b casa.blend -P bake.py -- casa out/casa 512 '{"F1":2048,...}'`: グループごとに結合 → ライトマップUV → Cycles で昼・夜の拡散光を焼き込み → GLB（Draco・WebP）を書き出し
3. `python3 lm2webp.py out/casa`: ライトマップを WebP 化（`enc = (L/scale)^(1/2.2)`、scale は `<id>-bake.json`）
4. 出力を `public/models/tour/<id>/` へ。LUCE の眺望は `city.py`（手続き生成の街並みを3つの高さから360°描画）、ページ用CGは `stills.py`

命名規則: グループ `F1`/`F2`/`<階>_CEIL`/`ROOF`/`SITE`、焼き込みメッシュ `<GROUP>_mesh`（extras `lightmap`）、`NAV_*`（歩ける床）、`HS_<部屋>`（視点）、`WP_stair_*`（階段経路）、`INFO_<id>`（説明タグ）。部屋の家具配置やCASAの階高など、写真や間取りに合わせた値が含まれます。

## 確認

`npm run dev -- --host 127.0.0.1` → http://localhost:3000/

## 公開と移行用フォルダ

`main` に push すると GitHub Actions（`.github/workflows/pages.yml`）が次の2つを行います。

- GitHub Pages に公開: https://abs-mart.net/web-experience-lab/（aboshiDaisuke の Pages 独自ドメイン）
- 別サイトの `/web/` に置く移行用フォルダを作り直し、Releases に置く: https://github.com/aboshiDaisuke/web-experience-lab/releases/download/migration/web.zip

手元で書き出す場合は `NEXT_PUBLIC_BASE_PATH=/web npm run export`（`out/web/` ができる。置き場所のパスに合わせて値を変える）。Cloudflare Workers で下層に置く場合は同じ変数を付けて `npm run build`。画像などのパスは `lib/base-path.ts` の `BASE` から組み立てること。以前のSites公開版は更新していません。

## ページと実装

| URL | サンプル | 主な操作 |
|---|---|---|
| /works/nova | 企業サイト | 事業切替・問い合わせデモ |
| /works/lumina | 美容室 | スタイル切替・予約デモ |
| /works/noir | レストラン | コース切替・予約デモ |
| /works/eclat | レザーブランド | カラー選択・来店相談デモ |
| /works/aether | 3Dスピーカー | ボタン・スライダーによる分解 |
| /works/casa | 建築 | 写真/3D切替・外観/室内・昼夜 |
| /works/room | 仮想アトリエ | オブジェクトのクリックと紹介 |
| /works/yui | 写真家 | 絞り込み・写真拡大 |
| /works/adapt | デザイン適応 | 5つのスタイルに切替 |
| /works/offgrid | 野外イベント | 日程・人数・料金・申込デモ |

- `app/page.tsx`: 作品一覧・ライブiframeプレビュー
- `app/works/[slug]/page.tsx`: 個別ページのルーティング
- `components/project-experience.tsx`: ブランドごとの構成と操作
- `lib/portfolio.ts`: 作品データ
- `app/globals.css`: 共通と各ブランドのスタイル、スマートフォン版
- `components/scene.tsx`, `lib/scenes/`: 遅延読込、描画制御、3Dモデル、GLBローダー

フォームは入力・確認までのデモです。実際の予約・購入・送信・保存は行いません。ブランド・人物・価格・製品仕様は架空です。生成AI APIは使用しません。

## 画像・モデル差し替え

画像は `public/images/`。動画は `public/videos/`。
`public/models/product.glb`、`house.glb`、`room.glb` があれば自動読込、なければプリミティブで表示します。Draco / KTX2対応。視点・大きさはモデルに応じてengine.tsで調整できます。

製品分解のメッシュ名: `shell`/`groove`（横へ）、`top`/`light`（上へ）、`base`（下へ）、`core`/`coil`（中央）。独立メッシュ以外の単一モデルは個別パーツに分解できません。部屋のクリック対象: `PC`, `CAMERA`, `BOOKS`, `TV`。

画面外・非表示タブでは3Dの更新を停止。モバイルで描画解像度を抑制。reduced-motionは自動回転を止め、スライダーとボタンによる操作は残します。

## 検証

- `npx tsc --noEmit`
- `npm run build`
- ローカル全10ルートのHTTP 200と固有コンテンツを確認
- 接続可能なブラウザがなく、実画面・操作のブラウザQAは未実施
- 任意WebMCP `preview_portfolio_project` は対応ブラウザでのみ登録。対応検証環境がないため実行検証は未実施

## 参考資料

XでAstra制作例を検索したが、制作元まで確認できる結果は得られなかった。

Astra制作と明記されたLARKの公開リポジトリ、Astra版のopening/reveal画面、比較ビューアのHTMLを確認。製品・写真・文字のレイヤー構成、ブランドごとの素材感、実ページをiframeで操作する比較ビューアを参考とした。コード・画像・コピーは転載していない。
https://github.com/az9713/gpt-6-astra-web-design

ブランド固有の写真と構成、モバイル専用の構図を考えるワークフローも参照。
https://github.com/Barty-Bart/gpt-6-astra-10k-websites

## 仮写真の出典（Unsplash）

- architecture: https://unsplash.com/photos/ulFAi1jkNcA
- fashion: https://images.unsplash.com/photo-1524504388940-b1c1722653e1
- dining: https://unsplash.com/photos/6gkzVgX7vms
- house: https://unsplash.com/photos/3ddHcjHmiGw
- bag: https://unsplash.com/photos/xzrJCS4grC4
- outdoors: https://images.unsplash.com/photo-1519904981063-b0cf448d479e
- studio: https://unsplash.com/photos/fybrevHYvWc
- hotel: https://unsplash.com/photos/58ApUELd3Ec

## 詳細制作の追加

各作品に `#features` を追加。一覧のプレビュー上部「特集・体験」から直接移動できます。企業の技術工程・用途別事例、美容室の空間と相談、レストランのシェフ・ペアリング、革素材の拡大、3Dパーツ選択、インタラクティブ間取り、制作ノート、写真家のジャーナル、文字組みラボ、持ち物チェックを実装。

`components/brand-depth.tsx` にブランド別の詳細、`components/demo-inquiry.tsx` に入力→確認→修正→完了のデモフロー、`components/project-motion.tsx` にGSAP演出を分離。予約コースに応じて時間帯が切り替わります。全入力は外部送信せず画面内だけで扱います。

追加検証: 全10ページに特集セクションがあること、6画像の200応答、3Dモデルの有限座標とクリック対象パーツ名、型チェック、本番ビルド。実ブラウザでの描画・クリック確認は引き続き未実施です。

追加の仮写真（Pexels）:
- machine: https://www.pexels.com/photo/close-up-of-modern-machinery-16647824/
- engineer: https://www.pexels.com/photo/a-man-operating-a-machine-9242287/
- salon: https://www.pexels.com/photo/photo-of-a-hair-salon-7750115/
- stylist: https://www.pexels.com/photo/a-person-cutting-hair-8467965/
- chef: https://www.pexels.com/photo/chef-hands-in-gloves-decorating-dish-in-plate-16931502/
- restaurant: https://www.pexels.com/photo/interior-of-a-restaurant-13369643/
