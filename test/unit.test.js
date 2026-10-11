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
    const req = { headers: {}, cookies: {}, sessionID: "sess-test" };
    const res = { cookie: () => {} };
    const token = generateToken(req, res);
    assert.strictEqual(typeof token, "string");
    assert.ok(token.length > 20);
  });

  test("validates HTML form submissions via req.body._csrf", () => {
    let cookieName = "";
    let cookieValue = "";
    const res = {
      cookie: (name, val) => {
        cookieName = name;
        cookieValue = val;
      },
    };
    const reqGet = { headers: {}, cookies: {}, sessionID: "test-session-123" };
    const token = generateToken(reqGet, res);

    // Simulate POST request with CSRF cookie and form body _csrf
    const reqPost = {
      method: "POST",
      headers: {},
      cookies: { [cookieName]: cookieValue },
      body: { _csrf: token, email: "user@example.com" },
      sessionID: "test-session-123",
    };

    let errorReceived = null;
    let nextCalled = false;
    doubleCsrfProtection(reqPost, {}, (err) => {
      if (err) errorReceived = err;
      nextCalled = true;
    });

    assert.strictEqual(errorReceived, null);
    assert.strictEqual(nextCalled, true);
  });

  test("validates AJAX submissions via x-csrf-token header", () => {
    let cookieName = "";
    let cookieValue = "";
    const res = {
      cookie: (name, val) => {
        cookieName = name;
        cookieValue = val;
      },
    };
    const reqGet = { headers: {}, cookies: {}, sessionID: "test-session-456" };
    const token = generateToken(reqGet, res);

    const reqPost = {
      method: "POST",
      headers: { "x-csrf-token": token },
      cookies: { [cookieName]: cookieValue },
      body: { data: "sample" },
      sessionID: "test-session-456",
    };

    let errorReceived = null;
    let nextCalled = false;
    doubleCsrfProtection(reqPost, {}, (err) => {
      if (err) errorReceived = err;
      nextCalled = true;
    });

    assert.strictEqual(errorReceived, null);
    assert.strictEqual(nextCalled, true);
  });

  test("rejects invalid CSRF tokens with 403 error", () => {
    const reqPost = {
      method: "POST",
      headers: {},
      cookies: { "x-csrf-token": "invalid-cookie-token" },
      body: { _csrf: "tampered-token" },
      sessionID: "test-session-789",
    };

    let errorReceived = null;
    doubleCsrfProtection(reqPost, {}, (err) => {
      errorReceived = err;
    });

    assert.ok(errorReceived);
    assert.strictEqual(errorReceived.statusCode || errorReceived.status, 403);
  });
});

describe("3. Upload Configuration", () => {
  const { imageFileFilter } = require("../config/upload.config");

  test("accepts valid image extensions and mimetypes", () => {
    const file = { originalname: "shirt.jpg", mimetype: "image/jpeg" };
    let called = false;
    imageFileFilter({}, file, (err, pass) => {
      assert.strictEqual(err, null);
      assert.strictEqual(pass, true);
      called = true;
    });
    assert.strictEqual(called, true);
  });

  test("rejects dangerous or non-image extensions", () => {
    const file = { originalname: "exploit.exe", mimetype: "application/x-msdownload" };
    let called = false;
    imageFileFilter({}, file, (err, pass) => {
      assert.ok(err instanceof Error);
      assert.strictEqual(pass, false);
      called = true;
    });
    assert.strictEqual(called, true);
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