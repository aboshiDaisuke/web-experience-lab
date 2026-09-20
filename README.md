# WEB EXPERIENCE LAB

13章で構成する、架空ブランドの体験型WEB制作ポートフォリオ。
React / Vinext / Three.js / GSAP ScrollTrigger / Lenis。

## 開発

- `npm install`
- `npm run dev`
- `npm run build`
- `npx tsc --noEmit`

## ファイル

- `app/page.tsx`: セクション・操作・作品モーダル
- `app/globals.css`: デザイン・レスポンシブ・reduced-motion
- `lib/content.ts`: 10作品の名称・説明・画像
- `components/animations.tsx`: GSAP・Lenis・カーソル
- `components/scene.tsx`: IntersectionObserverによる3D遅延読込
- `lib/scenes/engine.ts`: ライフサイクル・照明・操作・スクロール連動
- `lib/scenes/models.ts`: 仮モデルの生成
- `lib/scenes/load-model.ts`: GLB/glTF、Draco、KTX2読込

## 素材差し替え

画像は `public/images/`。作品ごとの指定は `lib/content.ts`。動画の配置先は `public/videos/`。

`public/models/product.glb`、`house.glb`、`room.glb` を配置すると仮モデルから自動的に切り替わります。404・読込失敗時はプリミティブを維持します。モデルは中心・大きさを自動調整します。glTFを利用する場合はengine.tsの拡張子を変更し、参照テクスチャ等もmodels配下へ配置します。

製品の分解には、Blender側でパーツを別メッシュにしてください。名前 `shell` / `groove` は横へ、`top` / `light` は上へ、`base` は下へ、`core` / `coil` は内部に残ります。その他のメッシュは中心から外へ分解します。単一メッシュも表示できますが、意図した分解にはパーツ分けが必要です。

部屋のクリック対象メッシュ名: `PC`, `CAMERA`, `BOOKS`, `TV`。画面上のボタンでも同じ情報を表示できます。建築の各視点はengine.tsのpositionsでモデルに合わせて微調整できます。

## 挙動・検証

画面外・タブ非表示時は3Dのフレーム更新を停止。モバイルは解像度とフレームレートを抑制。動きを減らす設定では自動回転・スクロール演出を止め、ボタン操作を保持します。未対応GPUでは説明を残します。

型チェックと本番ビルドを実施。実ブラウザの描画・操作テストは未実施。任意のWebMCP `configure_experience_theme` は対応ブラウザのみ登録され、未対応でも通常UIは動作。WebMCP対応の検証環境はなく、契約の実行検証は未実施。

問い合わせ先は未設定です。Contactはサンプル案内と相談メモのコピーを表示します。本運用時は実際のフォームまたは連絡先へ置換してください。全ブランド・数値は架空のコンセプトです。AIセクションは選択式のデザイン切替で、生成AI APIは呼びません。

## 写真

仮素材としてUnsplashを使用。
- 建築: https://unsplash.com/photos/ulFAi1jkNcA (Jonny James)
- ポートレート: https://images.unsplash.com/photo-1524504388940-b1c1722653e1
- 料理: https://unsplash.com/photos/6gkzVgX7vms (Marios Gkortsilas)

参照: https://threejs.org/docs/pages/GLTFLoader.html / https://gsap.com/docs/v3/Plugins/ScrollTrigger/
