# Unityのイベント申込ページ

既存Googleフォームへの申込画面です。公開先: https://nyokki519.github.io/Unity_S/

匿名のHP流入・フォーム送信操作は `growth-tracker.js` で観測し、Google側の実際の受理は別の確認トリガーを使います。未設定でも通常の申込は利用できます。受付完了・出席をブラウザー送信成功から推測しません。

[受付確認の導入手順](integrations/google-form/README.md)を参照してください。`tracking-config.js` のformEntryは公開フィールド名のみ。秘密キーを置かないでください。共有トラッカーの正本はunityHPの同名ファイルです。

検証: `node --test tests/*.test.cjs`。静的開発サーバー: `python -m http.server 8003 --bind 127.0.0.1`（ローカルは集計対象外）。

全面改修版は公開イベント選択・自由入力・参加経験・内容確認・LINE案内を備えます。メール欄はありません。初参加者は公式LINE追加と「初参加/参加希望」の送信、リピーターは従来どおり「参加希望」です。[導入手順](docs/registration-rollout.md)を参照してください。既存3entryで動作し、参加経験・公開IDの保存は実Google entry設定後に任意で追加できます。

画面検証: python tools/check-registration-browser.py（Playwright/Chromium、通信は全てモック）。名前を匿名計測やブラウザーの永続保存へ送らず、送信処理の成功をGoogle受理とは扱いません。
