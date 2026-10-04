ALTER TABLE "Constituency" ADD COLUMN "branch" TEXT;

ALTER TABLE "Member"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "idNumber" TEXT,
  ADD COLUMN "village" TEXT;

ALTER TABLE "MembershipSubmission"
  ADD COLUMN "constituencyName" TEXT,
  ADD COLUMN "branch" TEXT,
  ADD COLUMN "district" TEXT;
