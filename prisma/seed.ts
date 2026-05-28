import { PrismaClient } from "@prisma/client";
import { executePrediction } from "../src/services/prediction";
import { logAudit } from "../src/services/audit";

const prisma = new PrismaClient();

type Seed = {
  fullName: string;
  email: string;
  dob: string;
  sex: "male" | "female" | "other";
  glucose?: number;
  haemoglobin?: number;
  cholesterol?: number;
  systolic?: number;
  diastolic?: number;
  bmi?: number;
  note?: string;
};

const users = [
  {
    id: "u_reyes",
    name: "Dr. Maria Reyes",
    email: "maria.reyes@mira.health",
    role: "admin" as const,
    avatarHue: 178,
  },
  {
    id: "u_park",
    name: "Dr. Jamal Park",
    email: "jamal.park@mira.health",
    role: "clinician" as const,
    avatarHue: 22,
  },
  {
    id: "u_okonkwo",
    name: "Dr. Lena Okonkwo",
    email: "lena.okonkwo@mira.health",
    role: "clinician" as const,
    avatarHue: 270,
  },
  {
    id: "u_singh",
    name: "Priya Singh",
    email: "priya.singh@mira.health",
    role: "analyst" as const,
    avatarHue: 150,
  },
];

const clinicianIds = ["u_reyes", "u_park", "u_okonkwo"];

const seeds: Seed[] = [
  {
    fullName: "Naomi Carter",
    email: "naomi.carter@example.com",
    dob: "1967-04-08",
    sex: "female",
    glucose: 198,
    haemoglobin: 11.2,
    cholesterol: 268,
    systolic: 158,
    diastolic: 102,
    bmi: 33.4,
    note: "Patient reports occasional dizziness. Booked follow-up for next week.",
  },
  {
    fullName: "Daniel Park",
    email: "daniel.park@example.com",
    dob: "1961-10-21",
    sex: "male",
    glucose: 132,
    cholesterol: 252,
    systolic: 148,
    diastolic: 94,
    bmi: 29.1,
    note: "Family history of cardiac events. Statin discussion pending.",
  },
  {
    fullName: "Aisha Khan",
    email: "aisha.khan@example.com",
    dob: "1984-07-30",
    sex: "female",
    glucose: 142,
    haemoglobin: 12.5,
    cholesterol: 198,
    systolic: 128,
    diastolic: 84,
    bmi: 28.2,
    note: "Awaiting HbA1c results.",
  },
  {
    fullName: "Hiroshi Tanaka",
    email: "hiroshi.tanaka@example.com",
    dob: "1955-12-02",
    sex: "male",
    glucose: 108,
    haemoglobin: 11.4,
    cholesterol: 215,
    systolic: 134,
    diastolic: 82,
    bmi: 24.6,
  },
  {
    fullName: "Maya Iglesias",
    email: "maya.iglesias@example.com",
    dob: "1992-03-14",
    sex: "female",
    glucose: 88,
    haemoglobin: 13.4,
    cholesterol: 178,
    systolic: 118,
    diastolic: 76,
    bmi: 22.1,
  },
  {
    fullName: "Liam O'Connor",
    email: "liam.oconnor@example.com",
    dob: "1978-09-09",
    sex: "male",
    glucose: 96,
    haemoglobin: 14.8,
    cholesterol: 191,
    systolic: 124,
    diastolic: 80,
    bmi: 25.3,
  },
  {
    fullName: "Priya Nair",
    email: "priya.nair@example.com",
    dob: "1989-06-18",
    sex: "female",
  },
  {
    fullName: "Marcus Bell",
    email: "marcus.bell@example.com",
    dob: "1972-11-04",
    sex: "male",
    glucose: 174,
    cholesterol: 244,
    systolic: 152,
    diastolic: 96,
    bmi: 31.7,
    note: "Elevated A1c on previous visit. Lifestyle counselling in progress.",
  },
  {
    fullName: "Elena Vargas",
    email: "elena.vargas@example.com",
    dob: "1996-02-22",
    sex: "female",
    glucose: 92,
    haemoglobin: 13.1,
    cholesterol: 184,
    systolic: 116,
    diastolic: 74,
    bmi: 21.4,
  },
  {
    fullName: "Theo Anders",
    email: "theo.anders@example.com",
    dob: "1948-07-11",
    sex: "male",
    glucose: 156,
    haemoglobin: 12.8,
    cholesterol: 232,
    systolic: 162,
    diastolic: 100,
    bmi: 27.8,
    note: "Long-standing hypertension. On amlodipine.",
  },
  {
    fullName: "Sofia Iversen",
    email: "sofia.iversen@example.com",
    dob: "1981-05-27",
    sex: "female",
    glucose: 104,
    haemoglobin: 11.8,
    cholesterol: 204,
    systolic: 122,
    diastolic: 78,
    bmi: 24.2,
  },
  {
    fullName: "Idris Mahmoud",
    email: "idris.mahmoud@example.com",
    dob: "1965-08-15",
    sex: "male",
    glucose: 188,
    haemoglobin: 13.6,
    cholesterol: 276,
    systolic: 170,
    diastolic: 108,
    bmi: 32.1,
    note: "Recommended immediate cardiology referral.",
  },
  {
    fullName: "Chiamaka Okeke",
    email: "chiamaka.okeke@example.com",
    dob: "1990-12-01",
    sex: "female",
    glucose: 94,
    haemoglobin: 12.1,
    cholesterol: 192,
    systolic: 120,
    diastolic: 78,
    bmi: 23.8,
  },
  {
    fullName: "Anders Holm",
    email: "anders.holm@example.com",
    dob: "1958-03-19",
    sex: "male",
    glucose: 138,
    cholesterol: 248,
    systolic: 144,
    diastolic: 92,
    bmi: 28.9,
  },
  {
    fullName: "Rashida Brown",
    email: "rashida.brown@example.com",
    dob: "1986-10-30",
    sex: "female",
    glucose: 102,
    haemoglobin: 10.8,
    cholesterol: 188,
    systolic: 118,
    diastolic: 76,
    bmi: 22.7,
    note: "Iron supplementation prescribed two months ago.",
  },
  {
    fullName: "Victor Salah",
    email: "victor.salah@example.com",
    dob: "1974-01-09",
    sex: "male",
    glucose: 118,
    haemoglobin: 14.2,
    cholesterol: 212,
    systolic: 132,
    diastolic: 84,
    bmi: 26.4,
  },
  {
    fullName: "Junko Ito",
    email: "junko.ito@example.com",
    dob: "1995-04-04",
    sex: "female",
    glucose: 86,
    haemoglobin: 13.0,
    cholesterol: 176,
    systolic: 114,
    diastolic: 72,
    bmi: 20.9,
  },
  {
    fullName: "Benji Walters",
    email: "benji.walters@example.com",
    dob: "1953-06-23",
    sex: "male",
    glucose: 164,
    haemoglobin: 12.4,
    cholesterol: 260,
    systolic: 156,
    diastolic: 98,
    bmi: 30.2,
    note: "Recent ER visit for chest discomfort. Cleared, but flagged for monitoring.",
  },
  {
    fullName: "Olu Adebayo",
    email: "olu.adebayo@example.com",
    dob: "1982-09-12",
    sex: "male",
    glucose: 100,
    haemoglobin: 14.5,
    cholesterol: 196,
    systolic: 122,
    diastolic: 80,
    bmi: 24.9,
  },
  {
    fullName: "Camila Rivas",
    email: "camila.rivas@example.com",
    dob: "1999-08-08",
    sex: "female",
    glucose: 90,
    haemoglobin: 12.9,
    cholesterol: 172,
    systolic: 112,
    diastolic: 70,
    bmi: 21.0,
  },
];

async function main() {
  await prisma.note.deleteMany();
  await prisma.predictionLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  console.log(`seeding ${users.length} users…`);
  for (const u of users) {
    await prisma.user.create({ data: u });
  }

  console.log(`seeding ${seeds.length} patients…`);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]!;
    const createdAt = new Date(now - (seeds.length - i) * 3.2 * dayMs);
    const assignedToId = clinicianIds[i % clinicianIds.length]!;
    const assignedActor = users.find((u) => u.id === assignedToId)!;

    const patient = await prisma.patient.create({
      data: {
        fullName: s.fullName,
        email: s.email,
        dob: new Date(s.dob),
        sex: s.sex,
        glucose: s.glucose,
        haemoglobin: s.haemoglobin,
        cholesterol: s.cholesterol,
        systolic: s.systolic,
        diastolic: s.diastolic,
        bmi: s.bmi,
        assignedToId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await logAudit({
      action: "create",
      entityType: "patient",
      entityId: patient.id,
      patientId: patient.id,
      actor: { id: assignedActor.id, name: assignedActor.name },
    });

    if (s.note) {
      const note = await prisma.note.create({
        data: {
          patientId: patient.id,
          body: s.note,
          author: assignedActor.name,
          createdAt: new Date(createdAt.getTime() + dayMs),
        },
      });
      await logAudit({
        action: "note_add",
        entityType: "note",
        entityId: note.id,
        patientId: patient.id,
        actor: { id: assignedActor.id, name: assignedActor.name },
      });
    }

    await executePrediction(patient.id, {
      actor: { id: assignedActor.id, name: assignedActor.name },
    });
  }

  // run the patient service "auto transition" effect by replaying the
  // workflow logic against the post-prediction state so statuses + follow-ups
  // are realistic in the seeded fixture.
  const all = await prisma.patient.findMany();
  for (const p of all) {
    if (!p.riskLevel) continue;
    const status =
      p.riskLevel === "critical"
        ? "urgent_review"
        : p.riskLevel === "elevated"
          ? "follow_up_needed"
          : p.riskLevel === "moderate"
            ? "monitoring"
            : "stable";
    const days = p.riskLevel === "critical" ? 1 : p.riskLevel === "elevated" ? 7 : p.riskLevel === "moderate" ? 30 : null;
    await prisma.patient.update({
      where: { id: p.id },
      data: {
        status,
        followUpAt: days == null ? null : new Date(Date.now() + days * dayMs),
        // backdate review for ~half the seed set so the dashboard alert
        // surfaces the rest as "stale"
        reviewedAt: p.fullName.length % 2 === 0 ? new Date(Date.now() - 3 * dayMs) : null,
      },
    });
  }

  console.log("✓ seed complete");
  console.log("→ sign in at /sign-in using any of the seeded accounts");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
