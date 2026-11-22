import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CallInputSchema,
  DraftResponseSchema,
  MatchResponseSchema,
  STANDARD_DOCS,
  buildChecklistLabels,
  buildIcs,
  daysUntil,
  parseDateLoose,
} from "../lib/admin/funding";

test("datum tolkas i flera format och ogiltiga datum avvisas", () => {
  assert.equal(parseDateLoose("2027-03-15"), "2027-03-15");
  assert.equal(parseDateLoose("2027-03-15T10:00:00Z"), "2027-03-15");
  assert.equal(parseDateLoose("15/03/2027"), "2027-03-15");
  assert.equal(parseDateLoose("5.3.2027"), "2027-03-05");
  assert.equal(parseDateLoose("2027-02-30"), null);
  assert.equal(parseDateLoose("31/04/2027"), null);
  assert.equal(parseDateLoose("mars 2027"), null);
  assert.equal(parseDateLoose("15 mars"), null);
});

test("dagar kvar räknas i hela dagar och påverkas inte av klockslag", () => {
  const today = new Date(2026, 10, 22, 23, 59); // 22 november 2026 sent på kvällen
  assert.equal(daysUntil("2026-11-22", today), 0);
  assert.equal(daysUntil("2026-11-23", today), 1);
  assert.equal(daysUntil("2026-11-20", today), -2);
  assert.equal(daysUntil("2027-03-28", new Date(2027, 2, 27, 1, 0)), 1); // över sommartidsbytet
});

test("en utlysning rättas från slarvigt AI-svar och saknade fält får värden", () => {
  const call = CallInputSchema.parse({
    title: "Appel à projets Numérique inclusif",
    funder: null,
    kind: "Fondation",
    url: "javascript:alert(1)",
    deadline: "15/03/2027",
    amount_min_eur: "5 000 €",
    amount_max_eur: null,
    requirements: ["Statuts", "", null, "RIB"],
    status: "påhittad",
    next_step_date: "snart",
  });
  assert.equal(call.funder, "");
  assert.equal(call.kind, "other");
  assert.equal(call.url, "");
  assert.equal(call.deadline, "2027-03-15");
  assert.equal(call.amount_min_eur, 5000);
  assert.deepEqual(call.requirements, ["Statuts", "RIB"]);
  assert.equal(call.status, "new");
  assert.equal(call.next_step_date, null);
  assert.equal(call.summary, "");
  assert.equal(CallInputSchema.safeParse({}).success, false, "titel krävs");
});

test("matchning och utkast valideras tåligt", () => {
  const m = MatchResponseSchema.parse({ matches: [{ idea_id: "a", score: "9", rationale: null, gaps: null }, { idea_id: "", score: 3 }] });
  assert.equal(m.matches.length, 1);
  assert.equal(m.matches[0].score, 5);
  assert.deepEqual(m.matches[0].gaps, []);
  assert.equal(DraftResponseSchema.safeParse({ title: "T", content: "kort" }).success, false);
  assert.equal(DraftResponseSchema.safeParse({ title: "T", content: "x".repeat(80) }).success, true);
});

test("checklistan slår ihop krav och standardunderlag utan dubbletter", () => {
  const labels = buildChecklistLabels(["Budget", "statuts (stadgar)", "Referenser"], ["Budget"], true);
  assert.ok(!labels.includes("Budget"), "befintlig post läggs inte till igen");
  assert.ok(labels.includes("Referenser"));
  assert.equal(labels.filter((l) => l.toLowerCase() === "statuts (stadgar)").length, 1);
  assert.equal(buildChecklistLabels([], [], false).length, 0);
  assert.equal(buildChecklistLabels([], [], true).length, STANDARD_DOCS.length);
});

test("kalenderfilen är giltig iCalendar med heldagshändelser och undanflyktade tecken", () => {
  const ics = buildIcs(
    [
      { id: "1", title: "Appel; à projets, 2027", funder: "Fondation X", deadline: "2027-12-31", next_step: "Ring", next_step_date: "2027-03-01" },
      { id: "2", title: "Utan datum", funder: "", deadline: null, next_step: "", next_step_date: null },
    ],
    new Date("2026-11-22T12:00:00Z"),
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20271231"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20280101"), "slutdatum är nästa dag, även över årsskiftet");
  assert.ok(ics.includes("SUMMARY:Deadline: Appel\\; à projets\\, 2027 (Fondation X)"));
  assert.ok(ics.includes("DTSTAMP:20261122T120000Z"));
});
