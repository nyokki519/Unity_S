# Unityのイベント申込ページ

既存Googleフォームへの申込画面です。公開先: https://nyokki519.github.io/Unity_S/

匿名のHP流入・フォーム送信操作は `growth-tracker.js` で観測し、Google側の実際の受理は別の確認トリガーを使います。未設定でも通常の申込は利用できます。受付完了・出席をブラウザー送信成功から推測しません。

[受付確認の導入手順](integrations/google-form/README.md)を参照してください。`tracking-config.js` のformEntryは公開フィールド名のみ。秘密キーを置かないでください。共有トラッカーの正本はunityHPの同名ファイルです。

検証: `node --test tests/*.test.cjs`。静的開発サーバー: `python -m http.server 8003 --bind 127.0.0.1`（ローカルは集計対象外）。

全面改修版は公開イベント選択・自由入力・参加経験・初参加者だけ必須のメール・内容確認・LINE案内を備えます。[導入手順](docs/registration-rollout.md)を参照してください。回答の非公開化と実フォームentry検証まで `registration-config.js` の `enabled:false` を維持し、既存Googleフォームへ案内します。

画面検証: `python tools/check-registration-browser.py`（Playwright/Chromium、通信は全てモック）。メール・名前を匿名計測やブラウザーの永続保存へ送らず、送信処理の成功をGoogle受理とは扱いません。
