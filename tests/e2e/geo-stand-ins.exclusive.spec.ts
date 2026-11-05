import { expect, test } from "@playwright/test";

import { flaggedPaths } from "./settings";

/*
 * Other specs save the contacts for a moment (#27), clearing a stand-in's
 * flag until they put it back, so this runs in the `exclusive` project,
 * after them: the flags and the cached pages then agree.
 */
const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

test("seeded stand-ins never reach the geo meta, the structured data or llms.txt", async ({
  request,
}) => {
  const standIns = await flaggedPaths();
  const html = await (await request.get("/en", { headers: { "user-agent": googlebot } })).text();
  const head = html.slice(0, html.indexOf("</head>"));
  const llms = await (await request.get("/llms.txt")).text();
  if (standIns.includes("contacts.coordinates")) {
    expect(head).not.toContain('name="geo.position"');
    expect(head).not.toContain('name="ICBM"');
    expect(html).not.toContain('"GeoCoordinates"');
  }
  if (standIns.includes("contacts.email")) {
    expect(html).not.toContain('"email":');
    expect(llms).not.toMatch(/^- E-mail:/m);
  }
  if (standIns.includes("contacts.hours")) expect(llms).not.toMatch(/^- (Office )?hours:/im);
  if (standIns.includes("contacts.address")) expect(html).not.toContain('"PostalAddress"');
});
