(function () {
  "use strict";
  const core = window.UnityRegistration,
    config = window.UnityRegistrationConfig || {},
    ready = core.readiness(config);
  const $ = (id) => document.getElementById(id),
    form = $("form");
  const panels = ["event-step", "details", "review"];
  let current = "event-step",
    events = [],
    selectedId = "",
    selectedSnapshot = "",
    busy = false,
    sent = false,
    submittedExperience = null,
    claimInfo = null,
    claimCode = null;
  const originalLineUrl = $("line-link").href;
  const claimReady = loadClaimConfig();
  async function loadClaimConfig() {
    const helper = window.UnityQrClaim;
    if (!helper || (config.qrInfoUrl && config.qrInfoUrl !== helper.endpoint)) return;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(helper.endpoint, { mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal });
      if (response.ok) {
        const info = await response.json();
        if (helper.validate(info, config.entries) && info.entry !== window.UnityGrowthConfig?.formEntry) claimInfo = info;
      }
    } catch {} finally { clearTimeout(timer); }
  }
  const requestedId = new URL(location.href).searchParams.get("event_id");
  let initialSelection = true;
  const dateFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const signature = (e) =>
    JSON.stringify([e.id, e.title, e.startsAt, e.endsAt, e.location]);
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function selected() {
    return events.find((e) => e.id === selectedId) || null;
  }
  function data() {
    return {
      mode: $("manual-toggle").checked ? "manual" : "published",
      event: selected(),
      eventName: $("eventName").value,
      date: $("date").value,
      name: $("name").value,
      experience:
        form.querySelector('input[name="experience"]:checked')?.value || "",
    };
  }
  function errors(values) {
    for (const key of ["event", "eventName", "date", "name", "experience"]) {
      $("error-" + key).textContent = values[key] || "";
      const input = $(key);
      if (input)
        input.setAttribute("aria-invalid", values[key] ? "true" : "false");
    }
    const first = Object.keys(values)[0];
    if (first) {
      const target =
        first === "event"
          ? $("manual-toggle")
          : first === "experience"
            ? $("experience-first")
            : $(first);
      target?.focus();
    }
    return !first;
  }
  function validate(all) {
    const d = data(),
      values = core.validateRegistration(d);
    if (!all) for (const key of ["name", "experience"]) delete values[key];
    return errors(values);
  }
  function show(id) {
    current = id;
    for (const panel of panels) $(panel).hidden = panel !== id;
    for (const [index, key] of ["event", "details", "review"].entries()) {
      const step = $("step-" + key);
      step.removeAttribute("aria-current");
      if (panels[index] === id) step.setAttribute("aria-current", "step");
    }
    const heading =
      id === "event-step"
        ? "event-title"
        : id === "details"
          ? "details-title"
          : "review-title";
    $(heading).focus();
  }
  function summary(target) {
    const d = data(),
      manual = d.mode === "manual";
    const event = d.event;
    const rows = [
      ["イベント", manual ? d.eventName : event?.title],
      [
        "参加日",
        manual
          ? d.date
          : event
            ? dateFormat.format(new Date(event.startsAt)) +
              " " +
              timeFormat.format(new Date(event.startsAt))
            : null,
      ],
      [
        "会場",
        manual
          ? "案内をご確認ください"
          : event?.location || "案内をご確認ください",
      ],
      ["お名前", d.name],
      ["参加経験", d.experience === "first" ? "初めて" : "参加したことがある"],
      ["LINEで送る文", core.lineMessage(d.experience)],
    ];
    target.replaceChildren();
    for (const [title, value] of rows) {
      const row = node("div");
      row.append(node("dt", title), node("dd", value || ""));
      target.append(row);
    }
  }
  function renderEvents() {
    const fragment = document.createDocumentFragment();
    for (const event of events) {
      const label = node("label", undefined, "event-option");
      const radio = node("input");
      radio.type = "radio";
      radio.name = "event-choice";
      radio.value = event.id;
      radio.id = "event-" + event.id;
      radio.checked = event.id === selectedId;
      radio.setAttribute("aria-describedby", "error-event");
      const content = node("span");
      content.append(
        node(
          "div",
          dateFormat.format(new Date(event.startsAt)) +
            " · " +
            timeFormat.format(new Date(event.startsAt)),
          "event-date",
        ),
        node("strong", event.title),
        node("small", event.location || "会場はイベントの案内をご確認ください"),
      );
      radio.addEventListener("change", () => {
        selectedId = event.id;
        selectedSnapshot = signature(event);
        $("manual-toggle").checked = false;
        toggleManual();
        errors({});
      });
      label.append(radio, content);
      fragment.append(label);
    }
    $("event-list").replaceChildren(fragment);
  }
  function toggleManual() {
    const manual = $("manual-toggle").checked;
    $("manual-fields").hidden = !manual;
    $("manual-fields").disabled = !manual || !ready;
    $("eventName").required = manual;
    $("date").required = manual;
    if (manual) {
      selectedId = "";
      selectedSnapshot = "";
      for (const input of $("event-list").querySelectorAll("input"))
        input.checked = false;
    }
  }
  async function fetchFeed(url) {
    if (
      typeof url !== "string" ||
      !/^https:\/\/unity-analytics\.vercel\.app\/api\/public\/(?:registration-events|events)$/.test(
        url,
      )
    )
      throw Error("invalid_endpoint");
    const controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(),
        Math.min(15000, Math.max(1000, config.timeoutMs || 8000)),
      );
    try {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = Error("feed_unavailable");
        error.status = response.status;
        throw error;
      }
      return core.normalizeFeed(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }
  async function refresh() {
    if (busy || sent) return;
    busy = true;
    $("refresh-events").disabled = true;
    $("feed-status").textContent = "イベントを読み込んでいます。";
    try {
      let feed;
      try {
        feed = await fetchFeed(
          config.feedUrl ||
            "https://unity-analytics.vercel.app/api/public/registration-events",
        );
      } catch (error) {
        if (error.status !== 404) throw error;
        feed = await fetchFeed(
          config.monthlyFeedUrl ||
            "https://unity-analytics.vercel.app/api/public/events",
        );
      }
      events = feed.events;
      $("feed-label").textContent =
        feed.scope === "monthly"
          ? "今月の公開イベント"
          : "今月・翌月の公開イベント";
      let note = "";
      if (selectedId) {
        const candidate = selected();
        if (!candidate || signature(candidate) !== selectedSnapshot) {
          selectedId = "";
          selectedSnapshot = "";
          note =
            "選択したイベントの掲載内容が変更されました。もう一度選んでください。";
          if (current !== "event-step") show("event-step");
        }
      }
      if (initialSelection && requestedId && !$("manual-toggle").checked) {
        const candidate = events.find(
          (e) => e.id === requestedId || e.aliases.includes(requestedId),
        );
        if (candidate) {
          selectedId = candidate.id;
          selectedSnapshot = signature(candidate);
        } else
          note =
            "指定されたイベントは選択できません。一覧から選ぶか自由入力をご利用ください。";
      }
      initialSelection = false;
      renderEvents();
      $("feed-status").textContent =
        note ||
        (events.length
          ? "参加するイベントを選んでください。"
          : "現在、選択できる公開イベントはありません。案内を受けたイベントは自由入力できます。");
    } catch (error) {
      events = [];
      selectedId = "";
      selectedSnapshot = "";
      renderEvents();
      $("feed-status").textContent =
        (error.name === "AbortError"
          ? "イベントの読み込みがタイムアウトしました。"
          : error.status
            ? "イベント一覧を取得できませんでした。"
            : "イベントの応答を確認できませんでした。") +
        " 案内を受けたイベントは自由入力できます。";
      if (current !== "event-step") show("event-step");
    } finally {
      busy = false;
      $("refresh-events").disabled = false;
    }
  }
  $("manual-toggle").addEventListener("change", () => {
    toggleManual();
    errors({});
  });
  $("refresh-events").addEventListener("click", refresh);
  $("to-details").addEventListener("click", () => {
    if (!ready || !validate(false)) return;
    const d = data();
    $("selected-event").textContent =
      d.mode === "manual"
        ? d.eventName + " · " + d.date
        : d.event.title +
          " · " +
          dateFormat.format(new Date(d.event.startsAt)) +
          " " +
          timeFormat.format(new Date(d.event.startsAt));
    show("details");
  });
  $("edit-event").addEventListener("click", () => show("event-step"));
  $("edit-details").addEventListener("click", () => show("details"));
  form.querySelectorAll('input[name="experience"]').forEach((input) =>
    input.addEventListener("change", () => {
      const first = input.value === "first";
      $("first-line-guide").hidden = !first;
      $("error-experience").textContent = "";
      updateLineGuide();
    }),
  );
  function contactMessage() {
    return claimCode ? window.UnityQrClaim.message(claimCode) : core.lineMessage(contactExperience());
  }
  function contactExperience() {
    return submittedExperience ?? data().experience;
  }
  function updateLineGuide() {
    const first = contactExperience() === "first",
      message = core.lineMessage(contactExperience());
    $("review-line-guide").textContent = first
      ? `申込後は公式LINEを追加し、「${message}」とメッセージをお送りください。`
      : "送信後は従来どおり、公式LINEにて「参加希望」とメッセージをお願いします。";
    $("result-line-guide").textContent = first
      ? `公式LINEの追加と「${message}」の送信をお願いします。`
      : "公式LINEで「参加希望」とお送りください。";
    $("line-link").textContent = first
      ? "公式LINEを追加してメッセージを送る ↗"
      : "公式LINEを開く ↗";
    $("copy-line").textContent = `「${message}」をコピー`;
  }
  $("review-button").addEventListener("click", () => {
    if (!ready || !validate(true)) return;
    summary($("review-summary"));
    show("review");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sent || !ready || current !== "review") return;
    if (!validate(true)) {
      show("details");
      return;
    }
    let body;
    try {
      body = core.buildPayload(data(), config);
    } catch {
      $("sending-status").textContent =
        "申込設定を確認できません。公式LINEへお問い合わせください。";
      return;
    }
    const trackingEntry = window.UnityGrowthConfig?.formEntry;
    if (
      typeof trackingEntry === "string" &&
      /^entry\.\d{1,20}$/.test(trackingEntry) &&
      !body.has(trackingEntry)
    ) {
      const tracking = Array.from(
        form.querySelectorAll('input[type="hidden"]'),
      ).find((input) => input.name === trackingEntry);
      if (tracking) body.set(trackingEntry, tracking.value);
    }
    sent = true;
    $("send-button").disabled = true;
    await claimReady;
    if (claimInfo && config.entries?.eventId && body.has(config.entries.eventId) && data().mode === "published" && data().event.id.length <= 128) {
      try {
        const claim = await window.UnityQrClaim.create(window.crypto);
        body.set(claimInfo.entry, claim.hash);
        claimCode = claim.code;
      } catch { claimCode = null; }
    }
    submittedExperience = data().experience;
    form.dispatchEvent(new Event("unity:registration-send"));
    $("send-button").disabled = true;
    $("sending-status").textContent = "送信処理中です。";
    summary($("result-summary"));
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    let transport = false;
    try {
      await fetch(form.action, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        body,
        signal: controller.signal,
      });
      transport = true;
    } catch {
    } finally {
      clearTimeout(timer);
    }
    for (const panel of panels) $(panel).hidden = true;
    $("result").hidden = false;
    $("result-title").textContent = transport
      ? "送信処理を行いました"
      : "送信結果を確認できません";
    $("result-message").textContent = transport
      ? contactExperience() === "first"
        ? "公式LINEを追加し、「初参加/参加希望」とメッセージをお送りください。"
        : "次に、公式LINEから「参加希望」のメッセージをお願いします。"
      : "通信が中断されました。すでに届いている可能性もあるため、再送せず公式LINEへお問い合わせください。";
    if (claimCode) {
      $("line-link").href = window.UnityQrClaim.link(claimCode);
      $("line-link").textContent = "LINEで参加QRを受け取る ↗";
      $("result-line-guide").textContent = "LINEを開いて、入力された申込専用メッセージを送信してください。";
      $("copy-line").textContent = "申込専用メッセージをコピー";
      $("result-message").textContent = "送信結果はこの画面では確認できません。LINEで申込確認と参加QRの受け取りへ進んでください。";
    }
    $("result-title").focus();
  });
  $("copy-line").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        contactMessage(),
      );
      $("copy-status").textContent =
        "コピーしました。LINEに貼り付けてお送りください。";
    } catch {
      $("copy-status").textContent =
        claimCode ? "コピーできませんでした。上のLINEボタンから送信してください。" : `コピーできませんでした。「${contactMessage()}」と入力してお送りください。`;
    }
  });
  $("date").min = core.japanDate(new Date());
  toggleManual();
  if (!ready) {
    $("setup-notice").hidden = false;
    $("contact-fields").disabled = true;
    $("to-details").disabled = true;
    $("review-button").disabled = true;
    $("send-button").disabled = true;
  }
  refresh();
  setInterval(() => {
    if (
      !document.hidden &&
      current === "event-step" &&
      !$("event-list").contains(document.activeElement)
    )
      refresh();
  }, 300000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && current === "event-step") refresh();
  });
  // Form values remain memory-only and are removed from the back/forward cache.
  window.addEventListener("pagehide", () => {
    if (claimCode) {
      claimCode = null;
      $("line-link").href = originalLineUrl;
      $("line-link").textContent = "公式LINEを開く ↗";
      $("copy-line").textContent = "参加希望をコピー";
      $("copy-status").textContent = "";
    }
    form.reset();
    $("review-summary").replaceChildren();
    $("result-summary").replaceChildren();
    if (sent) {
      for (const panel of panels) $(panel).hidden = true;
      $("result").hidden = false;
      $("result-title").textContent = "送信結果を確認できません";
      $("result-message").textContent =
        "送信操作済みです。再送せず公式LINEへお問い合わせください。";
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !sent) location.reload();
  });
})();
