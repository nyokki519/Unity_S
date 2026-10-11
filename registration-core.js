/* Pure registration rules. No storage, network, logging or analytics. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UnityRegistration = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const entryKeys = [
    "eventName",
    "date",
    "name",
    "experience",
    "eventId",
    "mode",
  ];
  const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function japanDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw Error("invalid_date");
    return dateFormatter.format(date);
  }
  function japanMonths(now = new Date()) {
    const date = japanDate(now);
    const [year, month] = date.split("-").map(Number);
    return [
      date.slice(0, 7),
      japanDate(new Date(Date.UTC(year, month, 1))).slice(0, 7),
    ];
  }
  const clean = (value, max) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  function normalizeFeed(payload, now = new Date()) {
    const months = japanMonths(now);
    let scope;
    if (
      !payload ||
      payload.version !== 1 ||
      payload.timeZone !== "Asia/Tokyo" ||
      !Array.isArray(payload.events) ||
      payload.events.length > 10000
    )
      throw Error("invalid_feed");
    if (
      Array.isArray(payload.months) &&
      JSON.stringify(payload.months) === JSON.stringify(months)
    )
      scope = "upcoming";
    else if (payload.month === months[0]) scope = "monthly";
    else throw Error("invalid_feed_period");
    const seen = new Set();
    const events = [];
    for (const row of payload.events) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        row.id.length > 200 ||
        seen.has(row.id) ||
        !clean(row.title, 300) ||
        typeof row.startsAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
          row.startsAt,
        )
      )
        continue;
      const instant = Date.parse(row.startsAt);
      if (!Number.isFinite(instant) || instant <= now.getTime()) continue;
      const date = japanDate(instant);
      if (
        !(scope === "monthly" ? [months[0]] : months).includes(date.slice(0, 7))
      )
        continue;
      if (
        row.is_private === true ||
        row.is_public === false ||
        [
          "private",
          "draft",
          "cancelled",
          "canceled",
          "deleted",
          "unlisted",
        ].includes(row.status)
      )
        continue;
      let url = null;
      try {
        const link = new URL(row.url);
        if (
          link.protocol === "https:" &&
          ["tunagate.com", "www.tunagate.com"].includes(link.hostname) &&
          !link.username &&
          !link.password &&
          /^\/event\/\d+\/?$/.test(link.pathname) &&
          !link.search &&
          !link.hash
        )
          url = link.href;
      } catch {}
      seen.add(row.id);
      events.push({
        id: row.id,
        title: clean(row.title, 300),
        startsAt: new Date(instant).toISOString(),
        date,
        endsAt:
          typeof row.endsAt === "string" &&
          Number.isFinite(Date.parse(row.endsAt)) &&
          Date.parse(row.endsAt) >= instant
            ? row.endsAt
            : null,
        location: clean(row.location, 250) || null,
        category: clean(row.category, 80) || null,
        url,
      });
    }
    return {
      scope,
      months: scope === "monthly" ? [months[0]] : months,
      events: events.sort(
        (a, b) =>
          a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
      ),
    };
  }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const d = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
    );
  }
  function validateRegistration(data, now = new Date()) {
    const errors = {};
    if (data.mode === "manual") {
      if (!clean(data.eventName, 300))
        errors.eventName = "イベント名を入力してください。";
      if (!validDate(data.date) || data.date < japanDate(now))
        errors.date = "本日以降の正しい参加日を選んでください。";
    } else if (
      data.mode !== "published" ||
      !data.event ||
      typeof data.event.id !== "string" ||
      !clean(data.event.title, 300) ||
      !Number.isFinite(Date.parse(data.event.startsAt)) ||
      Date.parse(data.event.startsAt) <= now.getTime()
    )
      errors.event = "参加するイベントを選んでください。";
    if (
      !clean(data.name, 100) ||
      typeof data.name !== "string" ||
      data.name.trim().length > 100 ||
      /[\x00-\x1f\x7f]/.test(data.name)
    )
      errors.name = "お名前を100文字以内で入力してください。";
    if (!["first", "returning"].includes(data.experience))
      errors.experience = "参加経験を選んでください。";
    return errors;
  }
  function readiness(config) {
    if (config?.enabled !== true) return false;
    const required = ["eventName", "date", "name"];
    if (required.some((key) => !config.entries?.[key])) return false;
    const values = entryKeys
      .map((key) => config.entries?.[key])
      .filter((value) => value !== null && value !== undefined);
    return (
      values.every(
        (v) => typeof v === "string" && /^entry\.\d{1,20}$/.test(v),
      ) && new Set(values).size === values.length
    );
  }
  function buildPayload(data, config, now = new Date()) {
    if (!readiness(config)) throw Error("registration_not_configured");
    if (Object.keys(validateRegistration(data, now)).length)
      throw Error("invalid_registration");
    const manual = data.mode === "manual";
    const body = new URLSearchParams();
    const values = {
      eventName: manual ? data.eventName.trim() : data.event.title,
      date: manual ? data.date : japanDate(data.event.startsAt),
      name: data.name.trim(),
      experience: data.experience === "first" ? "初めて" : "参加したことがある",
      eventId: manual ? "" : data.event.id,
      mode: manual ? "自由入力" : "公開イベント",
    };
    for (const key of entryKeys)
      if (config.entries[key]) body.set(config.entries[key], values[key]);
    return body;
  }
  function lineMessage(experience) {
    return experience === "first" ? "初参加/参加希望" : "参加希望";
  }
  return {
    lineMessage,
    japanDate,
    japanMonths,
    normalizeFeed,
    validateRegistration,
    readiness,
    buildPayload,
  };
});
