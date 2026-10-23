import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDevice } from "../lib/emails.js";
import { templateVariables } from "../lib/mail.js";

test("describeDevice names the browser and the OS", () => {
  const chromeWindows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const safariIphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";
  assert.equal(describeDevice(chromeWindows), "Chrome sur Windows");
  assert.equal(describeDevice(safariIphone), "Safari sur iOS");
  assert.equal(describeDevice(edge), "Edge sur Windows");
  assert.equal(describeDevice(null), "un appareil inconnu");
});

test("templateVariables fills every variable of the Resend template", () => {
  const vars = templateVariables({
    heading: "Bienvenue",
    message: ["Ton compte est prêt.", "On y va ?"],
    button: { label: "Commencer", url: "https://example.test/onboarding" },
  });
  assert.equal(vars.email_message, "Ton compte est prêt. On y va ?");
  assert.equal(vars.email_preview, "Ton compte est prêt.");
  assert.equal(vars.first_name, "toi");
  for (const key of ["email_title", "email_heading", "cta_text", "cta_url", "x_url", "instagram_url", "unsubscribe_url"]) {
    assert.ok(vars[key], key);
  }
});
