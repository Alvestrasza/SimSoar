import test from "node:test";
import assert from "node:assert/strict";
import {buildFlightPreviewPolyline, buildFlightShareUrls, escapeHtml, flightShareDescription, normalizeEmbedLocale} from "../lib/flight-sharing.ts";

test("builds stable localized share, embed, and preview URLs", () => {
  assert.deepEqual(buildFlightShareUrls("https://simsoar.example", "en", "flight/id"), {
    shareUrl: "https://simsoar.example/en/flights/flight%2Fid",
    embedUrl: "https://simsoar.example/embed/flights/flight%2Fid?lang=en",
    previewUrl: "https://simsoar.example/api/share/flights/flight%2Fid"
  });
});

test("escapes embedded flight text and bounds locales", () => {
  assert.equal(escapeHtml('<script>"x" & y</script>'), "&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;");
  assert.equal(normalizeEmbedLocale("en"), "en");
  assert.equal(normalizeEmbedLocale("fr"), "de");
});

test("creates a finite bounded route preview for valid points", () => {
  const result = buildFlightPreviewPolyline([{lat: 50, lon: 8}, {lat: 50.5, lon: 8.75}, {lat: 51, lon: 9}]);
  assert.equal(result.split(" ").length, 3);
  assert.equal(result.includes("NaN"), false);
  assert.equal(buildFlightPreviewPolyline([{lat: 50, lon: 8}]), "");
});

test("generates useful localized public descriptions", () => {
  const flight = {id: "f", title: "Task", pilotCallsign: "ALICE", simulator: "Condor", glider: "LS8", distanceKm: 123.45, olcPoints: 200.25};
  assert.match(flightShareDescription(flight, "de"), /123\.5 km.*200\.3 OLC-Punkte/);
  assert.match(flightShareDescription(flight, "en"), /OLC points/);
});
