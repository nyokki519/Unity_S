const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../registration-core.js");
const now = new Date("2026-10-31T14:30:00Z");
const event = {
  id: "one",
  title: "交流会",
  startsAt: "2026-11-01T00:30:00+09:00",
  endsAt: null,
  location: "品川",
  category: "交流会",
  url: null,
};
const feed = {
  version: 1,
  timeZone: "Asia/Tokyo",
  months: ["2026-10", "2026-11"],
  events: [event],
};
const config = {
  enabled: true,
  privacyVerified: true,
  entries: {
    eventName: "entry.1",
    date: "entry.2",
    name: "entry.3",
    email: "entry.4",
    experience: "entry.5",
    eventId: "entry.6",
    mode: "entry.7",
  },
};
const input = {
  mode: "published",
  event,
  name: "テスト",
  experience: "first",
  email: "example+test@example.org",
};
test("JST date and next-month boundaries are independent of host timezone", () => {
  assert.equal(core.japanDate("2026-10-31T15:30:00Z"), "2026-11-01");
  assert.deepEqual(core.japanMonths(new Date("2026-12-31T15:00:00Z")), [
    "2027-01",
    "2027-02",
  ]);
  assert.equal(core.normalizeFeed(feed, now).events[0].date, "2026-11-01");
});
test("feed excludes started and malformed schedules and projects only public fields", () => {
  const r = core.normalizeFeed(
    {
      ...feed,
      events: [
        event,
        { ...event, id: "old", startsAt: "2026-10-30T12:00:00+09:00" },
        { ...event, id: "bad", startsAt: "2026-11-01 00:30" },
        { ...event, id: "third", startsAt: "2026-12-01T00:30:00+09:00" },
        { ...event, id: "private", is_private: true },
      ],
    },
    now,
  );
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].id, "one");
  assert.equal(r.events[0].email, undefined);
  assert.equal(
    core.normalizeFeed(
      {
        ...feed,
        events: [
          {
            ...event,
            participant: "private",
            email: "private@example.org",
            url: "javascript:alert(1)",
          },
        ],
      },
      now,
    ).events[0].url,
    null,
  );
});
test("same-name different schedules are retained and incompatible feed fails", () => {
  assert.equal(
    core.normalizeFeed(
      {
        ...feed,
        events: [
          event,
          { ...event, id: "two", startsAt: "2026-11-01T02:00:00+09:00" },
        ],
      },
      now,
    ).events.length,
    2,
  );
  for (const value of [
    { ...feed, version: 2 },
    { ...feed, timeZone: "UTC" },
    { ...feed, months: ["2026-09", "2026-10"] },
    { ...feed, events: null },
  ])
    assert.throws(() => core.normalizeFeed(value, now));
  const monthly = core.normalizeFeed(
    { version: 1, timeZone: "Asia/Tokyo", month: "2026-10", events: [] },
    now,
  );
  assert.equal(monthly.scope, "monthly");
});
test("first-time email required, returning empty allowed, experience never inferred", () => {
  assert.deepEqual(core.validateRegistration(input, now), {});
  assert.ok(
    core.validateRegistration({ ...input, experience: "" }, now).experience,
  );
  assert.ok(core.validateRegistration({ ...input, email: "" }, now).email);
  assert.deepEqual(
    core.validateRegistration(
      { ...input, experience: "returning", email: "" },
      now,
    ),
    {},
  );
  assert.ok(
    core.validateRegistration(
      { ...input, experience: "returning", email: "bad" },
      now,
    ).email,
  );
});
test("manual dates must be real and not past; published selection is mandatory", () => {
  const manual = {
    ...input,
    mode: "manual",
    eventName: "未掲載の会",
    date: "2026-11-02",
  };
  assert.deepEqual(core.validateRegistration(manual, now), {});
  for (const date of ["2026-02-30", "2026-10-30", ""])
    assert.ok(core.validateRegistration({ ...manual, date }, now).date);
  assert.ok(core.validateRegistration({ ...input, event: null }, now).event);
  assert.ok(core.validateRegistration({ ...input, name: " " }, now).name);
});
test("privacy, entry mappings and enabled flag all required before contact submission", () => {
  assert.equal(core.readiness(config), true);
  for (const c of [
    { ...config, enabled: false },
    { ...config, privacyVerified: false },
    { ...config, entries: { ...config.entries, email: null } },
    { ...config, entries: { ...config.entries, email: "entry.3" } },
  ]) {
    assert.equal(core.readiness(c), false);
    assert.throws(() => core.buildPayload(input, c, now));
  }
});
test("payload uses exact verified entries and Japanese experience; manual has no stale ID", () => {
  const body = core.buildPayload(input, config, now);
  assert.equal(body.get("entry.1"), "交流会");
  assert.equal(body.get("entry.2"), "2026-11-01");
  assert.equal(body.get("entry.4"), input.email);
  assert.equal(body.get("entry.5"), "初めて");
  assert.equal(body.get("entry.6"), "one");
  const manual = core.buildPayload(
    {
      ...input,
      mode: "manual",
      eventName: "未掲載",
      date: "2026-11-02",
      experience: "returning",
      email: "",
    },
    config,
    now,
  );
  assert.equal(manual.get("entry.6"), "");
  assert.equal(manual.get("entry.5"), "参加したことがある");
  assert.equal(manual.get("entry.4"), "");
  assert.throws(() => core.buildPayload({ ...input, email: "" }, config, now));
});
