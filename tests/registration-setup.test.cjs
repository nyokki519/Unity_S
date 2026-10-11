const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function fixture(privateDestination = true, verified = true) {
  const items = [],
    props = { UNITY_PRIVATE_DESTINATION_VERIFIED: verified ? "true" : "" };
  let next = 100;
  function create(type) {
    const item = {
      type,
      id: next++,
      title: "",
      required: null,
      getTitle() {
        return this.title;
      },
      getId() {
        return this.id;
      },
      getType() {
        return this.type;
      },
      asTextItem() {
        return this;
      },
      asMultipleChoiceItem() {
        return this;
      },
      setTitle(t) {
        this.title = t;
        return this;
      },
      setRequired(v) {
        this.required = v;
        return this;
      },
      setHelpText() {
        return this;
      },
      setChoiceValues(v) {
        this.choices = v;
        return this;
      },
      createResponse(v) {
        return { id: this.id, value: v };
      },
    };
    items.push(item);
    return item;
  }
  const form = {
    getDestinationId: () => "sheet",
    getItems: () => items,
    addTextItem: () => create("TEXT"),
    addMultipleChoiceItem: () => create("MULTIPLE_CHOICE"),
    createResponse: () => ({
      withItemResponse(r) {
        this.r = r;
        return this;
      },
      toPrefilledUrl() {
        return (
          "https://docs.google.com/forms/d/e/example/viewform?entry." +
          (this.r.id + 10000) +
          "=probe"
        );
      },
    }),
  };
  const ctx = {
    FormApp: {
      getActiveForm: () => form,
      ItemType: { TEXT: "TEXT", MULTIPLE_CHOICE: "MULTIPLE_CHOICE" },
    },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      getFileById: () => ({
        getSharingAccess: () =>
          privateDestination ? "PRIVATE" : "ANYONE_WITH_LINK",
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props[k],
        setProperty: (k, v) => (props[k] = v),
      }),
    },
    console: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync("integrations/google-form/RegistrationSetup.gs", "utf8"),
    ctx,
  );
  return { ctx, items, props };
}
test("registration setup refuses public or unverified destination before adding questions", () => {
  for (const f of [fixture(false), fixture(true, false)]) {
    assert.throws(() => f.ctx.setupUnityRegistration(), /private|privacy/i);
    assert.equal(f.items.length, 0);
  }
});
test("setup is idempotent and returns actual prefill entries, not item IDs", () => {
  const f = fixture(),
    first = f.ctx.setupUnityRegistration(),
    second = f.ctx.setupUnityRegistration();
  assert.equal(f.items.length, 3);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.match(first.experience, /^entry\.10\d+$/);
  assert.notEqual(first.experience, "entry." + f.items[0].id);
  assert.ok(!f.items.some((i) => i.title === "メールアドレス"));
  const experience = f.items.find((i) => i.title === "Unityへの参加経験");
  assert.equal(experience.required, false);
  assert.equal(
    JSON.stringify(experience.choices),
    JSON.stringify(["初めて", "参加したことがある"]),
  );
  assert.equal(first.enabled, false);
  assert.equal(first.privacyVerified, true);
});
