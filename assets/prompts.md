# 画像生成プロンプト

使用方法：内蔵 image_gen による生成・編集。APIキー・CLIは不使用。

## admin-avatar.png（管理人のアイコン）

内蔵 image_gen による生成・編集。利用者の了承を得てモデル指定なしで生成しています（Image2.5の使用は保証していません）。顔を影に隠した男性と、背後の古いエレベーターで、謎めいた雰囲気を表現しています。追加編集で背景の壁面を少し明るくし、顔を隠したまま頭・首・肩の輪郭が分かるようにしました。生成画像を256×256pxに縮小した `admin-avatar.png` を原本とし、配信には `npm run build:avatar-image` で作る106×106pxのWebP（表示53pxの2倍）を使い、プロフィール全世代で共通表示します。生成・編集の全文プロンプトは [admin-avatar.prompt.txt](admin-avatar.prompt.txt) です。

## social-map.png（SNS共有用）

既存の生成地図を背景に、実際の地図描画コードで地名・施設・初期の事故18件と目撃情報を重ねた画像です。新たな画像生成は行わず、`tools/share-image.html` を1200×630で描画してPNGに出力しています。閉鎖のお知らせや解答となる追加ピンは含めません。

## misuta-realistic-map.png（現在使用中）

内蔵 image_gen による新規生成。モデル名の指定欄はないため、Image2.5指定の保証はしていません。最終画像は1536×1024です。生成に使った全文プロンプトは [misuta-realistic-map.prompt.txt](misuta-realistic-map.prompt.txt) に保存しています。プロンプト中の都市名 Kirihara は舞台の旧称です（現在は三栖田市）。

日本の架空の沿岸都市を、Google Mapsの通常地図に近い精密な道路地図の表現で生成しました。画像には文字やピンを焼き込まず、生成後に建物の輪郭と歩道の位置を読み取って `map-layout.js` に登録し、地名・施設名・事故・目撃情報を重ねています。実在の地図タイルやGoogleのロゴは使用していません。

## misuta-map.png

Generate an asset for a fictional Japanese city accident map website. A precise flat top-down 2D cartographic street map, landscape 1536x1024. Fictional mid-size Japanese city, NOT any real city. No text, no labels, no symbols, no pins, no border, no UI. Dense plausible urban blocks with tiny light gray-beige building footprints, white narrow streets outlined pale gray, a few wider pale golden arterial roads, soft mint green parks and wooded hills on upper left, a meandering pale blue river flowing from top center to lower right, several bridges crossing it, railway with delicate gray parallel lines running horizontally through center left, railway station plaza near center. Urban density concentrated on left and center, industrial waterfront lower right. Muted conventional Japanese online street map palette: warm off-white land #f2f1e9, subtle gray buildings, pale blue water #b5d6df, green #cfdfbd. Crisp professional atlas drafting, fully orthographic, no 3D, no artistic paper texture. Consistent readable small street blocks throughout image. This will be an interactive map background with HTML labels added separately. Save the generated image and return its local file path.

## elevator-crash.png

Use case: logo-brand. Create one small map marker icon asset: front view of a crashed elevator cab in a rectangular elevator shaft, visibly tilted broken cabin resting at bottom with a jagged impact burst beneath it and broken cable above. Bold simple deep vermilion red silhouette with white negative space, dark red thin outline. Flat pictogram professionally designed to read clearly at 32 pixels, compact square composition filling 85 percent of canvas. Transparent background. No pin teardrop, no circle enclosure, no words, no letters, no flames, no gradient, no shadow, no realistic scene. Just one elevator accident symbol, centred, sharp edges. Output 1024x1024 transparent PNG.
