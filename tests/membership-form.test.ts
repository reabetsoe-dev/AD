import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName } from "pdf-lib";
import { membershipFormInput, membershipHeaderInput, snapshotMembers } from "../lib/membership";
import { membershipPdf } from "../lib/membership-pdf";

const member = {
  memberNumber: "DEMO-001",
  firstName: "Fictional",
  lastName: "Member",
  gender: "F",
  idNumber: "IEC-001",
  village: "Fictional village",
  phone: "+266 5000 0000",
};

test("the paper form's member fields are required and blank values are rejected", () => {
  assert.equal(membershipFormInput.safeParse(member).success, true);
  for (const field of Object.keys(member)) {
    assert.equal(membershipFormInput.safeParse({ ...member, [field]: undefined }).success, false, field);
    assert.equal(membershipFormInput.safeParse({ ...member, [field]: " " }).success, false, field);
  }
  assert.equal(membershipFormInput.safeParse({ ...member, gender: "other" }).success, false);
  assert.equal(membershipFormInput.safeParse({ ...member, phone: "+---()" }).success, false);
  assert.equal(membershipHeaderInput.safeParse({ branch: " ", district: "District" }).success, false);
  assert.equal(membershipHeaderInput.safeParse({ branch: "Branch", district: " " }).success, false);
});

test("membership PDFs are A4 landscape with an embedded logo and continue after fourteen members", async () => {
  const bytes = await membershipPdf([{
    constituency: "Demonstration Constituency A",
    branch: "Fictional branch",
    district: "Fictional district",
    members: Array.from({ length: 15 }, (_, index) => ({ ...member, memberNumber: `DEMO-${index}` })),
  }]);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  for (const page of pdf.getPages()) {
    assert.deepEqual(page.getSize(), { width: 841.89, height: 595.28 });
    assert.ok(page.node.Resources()?.get(PDFName.of("XObject")), "Each page includes the AD logo");
  }
  assert.equal(pdf.getTitle(), "FOROMO E AMOHELANG BOTHO BA LEKHOTLA");
});

test("empty constituencies still download a printable ruled form and separate constituencies start new pages", async () => {
  const pdf = await PDFDocument.load(await membershipPdf([
    { constituency: "A", members: [] },
    { constituency: "B", members: [member] },
  ]));
  assert.equal(pdf.getPageCount(), 2);
});

test("historical snapshots still render without inventing missing member details", () => {
  const members = snapshotMembers([{ firstName: "Legacy", lastName: "Member", memberNumber: "OLD-1" }, null]);
  assert.equal(members.length, 1);
  assert.equal(members[0].gender, "");
  assert.equal(members[0].idNumber, "");
  assert.equal(members[0].village, "");
});
