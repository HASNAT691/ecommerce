const { test, describe } = require("node:test");
const assert = require("node:assert");

describe("1. Validation Middleware", () => {
  const { validateStringFields } = require("../middlewares/validation.middleware");

  test("rejects missing required fields", () => {
    const middleware = validateStringFields(["email", "password"]);
    const req = { body: { email: "test@example.com" } };
    let statusSent = null;
    let messageSent = null;
    const res = {
      status: (code) => {
        statusSent = code;
        return {
          send: (msg) => { messageSent = msg; },
        };
      },
    };
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusSent, 400);
    assert.strictEqual(nextCalled, false);
    assert.match(messageSent, /Missing required field password/);
  });

  test("rejects non-string injection objects (NoSQL protection)", () => {
    const middleware = validateStringFields(["password"]);
    const req = { body: { password: { $gt: "" } } };
    let statusSent = null;
    const res = {
      status: (code) => {
        statusSent = code;
        return { send: () => {} };
      },
    };
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusSent, 400);
    assert.strictEqual(nextCalled, false);
  });

  test("passes valid strings", () => {
    const middleware = validateStringFields(["name", "email"]);
    const req = { body: { name: "Fatima", email: "fatima@example.com" } };
    let nextCalled = false;
    const res = {};
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });
});

describe("2. CSRF Middleware", () => {
  const { generateToken, doubleCsrfProtection } = require("../middlewares/csrf.middleware");

  test("generates valid CSRF token string", () => {
    const req = { headers: {}, cookies: {} };
    const res = { cookie: () => {} };
    const token = generateToken(req, res);
    assert.strictEqual(typeof token, "string");
    assert.ok(token.length > 20);
  });
});

describe("3. Upload Configuration", () => {
  const { imageFileFilter } = require("../config/upload.config");

  test("accepts valid image extensions and mimetypes", (t, done) => {
    const file = { originalname: "shirt.jpg", mimetype: "image/jpeg" };
    imageFileFilter({}, file, (err, pass) => {
      assert.strictEqual(err, null);
      assert.strictEqual(pass, true);
      done();
    });
  });

  test("rejects dangerous or non-image extensions", (t, done) => {
    const file = { originalname: "exploit.exe", mimetype: "application/x-msdownload" };
    imageFileFilter({}, file, (err, pass) => {
      assert.ok(err instanceof Error);
      assert.strictEqual(pass, false);
      done();
    });
  });
});

describe("4. Security Regex Escaping", () => {
  test("properly escapes regex special characters", () => {
    const escapeRegex = (str) =>
      typeof str === "string" ? str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";

    const dangerous = "test(name)+[a-z].*";
    const escaped = escapeRegex(dangerous);
    assert.strictEqual(escaped, "test\\(name\\)\\+\\[a-z\\]\\.\\*");

    // Ensure it compiles safely without throwing
    const rx = new RegExp(escaped, "i");
    assert.ok(rx.test("test(name)+[a-z].*"));
  });
});