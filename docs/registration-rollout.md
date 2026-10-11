# 参加申込改修の導入手順

## 実装と現在の状態

イベント選択／自由入力、参加経験、初参加者だけ必須のメール、内容確認、LINE案内を実装した。新規連絡先の収集は `registration-config.js` の `enabled:false` で停止している。メールentry未設定や `privacyVerified:false` でも停止する。停止中は既存Googleフォームへ案内し、メールを入力・送信させない。

コードのテストと本番Google設定の検証は別。Googleへの編集用資格情報が提供されていないため、以下の所有者操作は未実施。本番への架空回答、LINE／メール実送信は行っていない。

## 導入順序

1. **Analytics側の認証済み読取を準備する。** 既存サービスアカウントの `GOOGLE_SHEETS_CREDENTIALS` をサーバー環境で利用する。回答シートをそのアカウントへ閲覧者として共有する。秘密JSONを公開JSやGitへ入れない。読取スコープは `spreadsheets.readonly`。現在の4列の読取と、運営用管理キー（既存 `CRON_SECRET`）での参加者表示を確認する。
2. **Analytics変更をデプロイする。** `/api/participants` は未認証401、認証後のみ読取。`/participants` の初期HTMLに参加者名を埋め込まない。LINE通知の読取は同じプライベートソースを使う。既存 `/api/public/events` は今月分の契約を維持し、追加 `/api/public/registration-events` は今月・翌月の開催前イベントを返す。資格情報や共有が不足した場合、匿名取得へ戻さず503で止まる。
3. **回答保存先の公開を停止する。** Google Driveの一般アクセスを「制限付き」にし、スプレッドシートの「ウェブに公開」も停止する。メール列だけ／別タブだけの非表示では不十分。従来の公開CSVやコピーがある場合も停止・点検する。編集者・閲覧者を必要な運営メンバーに限定する。
4. **匿名アクセス拒否を検証する。** ログアウト状態でシート、gviz、CSV、ウェブ公開URLへアクセスし、データを取得できないことを確認する。参加者の値をチャットやログへコピーしない。Driveの「制限付き」表示だけで検証済みとしない。認証済みAnalyticsの参加者表示とLINEのプレビューは動作することを確認する。実送信はしない。
5. **既存フォームのApps Scriptへ補助コードを追加する。** フォームからApps Scriptを開き `integrations/google-form/RegistrationSetup.gs` を追加する。既存 `GrowthConfirmation.gs` と匿名計測トリガーは残す。手順3・4完了後だけScript Propertiesの `UNITY_PRIVATE_DESTINATION_VERIFIED` に `true` を設定する。これは所有者による確認の記録であり、コードだけで匿名拒否を証明するものではない。
6. **`setupUnityRegistration()` を実行する。** Drive共有がPRIVATEでない場合は止まる。メール、参加経験、公開イベントID、入力方法の4質問を冪等に追加する。既存質問のタイトル重複・型の衝突では止まる。Googleのprefill URLから実entryを取得する。回答は送信しない。既存3項目、回答先、「タイムスタンプ」「イベント名」「日時」「お名前」は変更しない。
7. **隔離した検証用フォームで両方を確かめる。** 初参加者のメールあり、リピーターのメール空欄を保存できることを検証する。メール質問は一律必須にしない。参加経験は必須。セットアップコードは「初参加者は入力してください」の案内と任意メール質問を作るが、標準Googleフォーム自体の条件付き強制検証は実装していない。標準フォームでも強制するなら、セクション分岐・各entryを別途検証する。ブラウザーの条件付きrequiredはサーバー保証ではない。
8. **公開設定ファイルへ実entryを反映する。** 補助コード出力の email/experience/eventId/mode は `registration-config.js` の `entries` の同じキーへ設定する。番号を推測しない。匿名計測用 `tracking-config.js` のentryを使い回さない。設定が重複・未設定なら有効化できない。
9. **最後に `privacyVerified:true`、`enabled:true` を設定してUnity_Sを公開する。** 所有者操作と隔離検証の前に有効化しない。HP変更では、個別外部イベントURLは維持し、共通フォームへのリンクだけ `event_id` を付ける。

## 項目対応

| 項目 | 公開設定キー | 現状 |
|---|---|---|
| イベント名 | entries.eventName | entry.1834327533（既存） |
| 参加日 | entries.date | entry.2119680669（既存、JST YYYY-MM-DD） |
| お名前 | entries.name | entry.1786168698（既存） |
| メールアドレス | entries.email | 補助コードで実entry取得後に設定 |
| Unityへの参加経験 | entries.experience | 初めて／参加したことがある |
| 公開イベントID | entries.eventId | 自由入力は空欄 |
| イベント入力方法 | entries.mode | 公開イベント／自由入力 |
| 匿名計測ID | UnityGrowthConfig.formEntry | 既存設定を維持 |

メール・参加経験は参加者一覧APIへ追加しない。プライベート読取はヘッダーを確認し、承認した4列と任意のステータス・Member ID・イベントID列のみ取得する。メール列は読取対象にしない。イベントIDがある行と旧行は自動照合せず別に保つ。同日同名でも異なるIDは統合しない。

ID付きのLINE通知元は従来の名前キーと分ける。新しいIDの通知は初期OFFで、運営がプレビュー・時刻設定・履歴確認後に個別ONにする。既存キーの通知履歴と設定は保持する。旧行とID付き行を同じ開催と推測して二重配信しない。

## 送信結果の意味

Googleフォームへのno-cors POSTは受付・シート保存の確認ではない。正常な通信完了は「送信処理を行いました」、切断／タイムアウトは「送信結果を確認できません」と表示し、入力をその画面のメモリー内に保持する。ページを離れたら連絡先を消去し、未送信フォームは戻った際に初期化する。送信操作済みの結果画面は再送できない案内を保つ。自動再送せず、LINEでの確認へ案内する。受付確定、自動メール、実参加を推測しない。

## 開発・検証

```sh
cd /workspace/Unity_S
node --test tests/*.test.cjs
REGISTRATION_SCREENSHOT_DIR=/tmp/unity-registration-screenshots python tools/check-registration-browser.py
python -m http.server 8003 --bind 127.0.0.1
```

ブラウザーテストはPlaywrightとChromiumを使い、ネットワークを全てモックする。実回答・実LINE・実計測は作らない。検証用entry番号はテスト内限定で、本番設定には書かない。ローカルから本番APIを直接読むためにCORSを広げない。

Analytics: focused tests → `npm test` → `npm run typecheck` → `npm run build`。HP: Nodeテスト、SEOテスト、`python tools/check-monthly-events.py`、`python tools/check-growth-browser.py --form-root /workspace/Unity_S`。Analyticsのビルドをローカル起動したら `python tools/check-registration-admin-browser.py --base-url http://127.0.0.1:3101` で認証／解除とLINE初期OFFをモック確認できる。

## 停止・復旧

新申込UIを停止するには `enabled:false` を公開する。回答先は非公開のまま維持する。既存回答・追加質問・列・計測履歴を削除しない。コードを戻す際もメールを含むシートを再公開しない。認証済み読取の不具合を匿名gvizへのフォールバックで直さない。Googleフォームへ直接誘導する場合も、メール保存先の非公開化を維持する。

## 未実施の本番作業

Googleフォームの所有者権限による質問追加、実entry取得、回答先の匿名拒否と認証読取の実証、隔離フォームでの実保存、本番への有効化。これらにはGoogle側の権限が必要。コードとモックテストの成功を本番設定の完了と扱わない。
