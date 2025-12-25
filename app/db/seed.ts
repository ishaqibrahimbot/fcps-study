import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { papers, questions } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.delete(questions);
  await db.delete(papers);

  // Create sample papers
  const [anatomyPaper] = await db
    .insert(papers)
    .values({
      name: "Anatomy Paper 1",
      source: "SK Book Series",
      questionCount: 5,
    })
    .returning();

  const [physiologyPaper] = await db
    .insert(papers)
    .values({
      name: "Physiology Paper 1",
      source: "AA Book Series",
      questionCount: 5,
    })
    .returning();

  // Sample anatomy questions
  const anatomyQuestions = [
    {
      paperId: anatomyPaper.id,
      questionText:
        "Which of the following structures passes through the foramen magnum?",
      choices: [
        "Internal carotid artery",
        "Medulla oblongata",
        "Glossopharyngeal nerve",
        "Vertebral artery only",
      ],
      correctChoice: 1,
      explanation:
        "The foramen magnum is the largest foramen in the skull. It transmits the medulla oblongata and its meninges, the vertebral arteries, the anterior and posterior spinal arteries, and the accessory nerves. The internal carotid artery passes through the carotid canal, not the foramen magnum.",
      orderIndex: 0,
    },
    {
      paperId: anatomyPaper.id,
      questionText: "The deltoid muscle is innervated by which nerve?",
      choices: [
        "Musculocutaneous nerve",
        "Axillary nerve",
        "Radial nerve",
        "Suprascapular nerve",
      ],
      correctChoice: 1,
      explanation:
        "The deltoid muscle is innervated by the axillary nerve (C5, C6), which is a branch of the posterior cord of the brachial plexus. The axillary nerve also provides cutaneous innervation to the skin over the deltoid muscle.",
      orderIndex: 1,
    },
    {
      paperId: anatomyPaper.id,
      questionText:
        "Which structure forms the floor of the inguinal canal in males?",
      choices: [
        "External oblique aponeurosis",
        "Internal oblique muscle",
        "Transversalis fascia",
        "Inguinal ligament",
      ],
      correctChoice: 3,
      explanation:
        "The floor of the inguinal canal is formed by the inguinal ligament (of Poupart) and the lacunar ligament medially. The inguinal ligament is the folded lower border of the external oblique aponeurosis.",
      orderIndex: 2,
    },
    {
      paperId: anatomyPaper.id,
      questionText:
        "The great saphenous vein drains into which of the following?",
      choices: [
        "Popliteal vein",
        "Femoral vein",
        "External iliac vein",
        "Inferior vena cava",
      ],
      correctChoice: 1,
      explanation:
        "The great saphenous vein is the longest vein in the body. It ascends along the medial aspect of the leg and thigh and drains into the femoral vein at the saphenous opening, approximately 4 cm below and lateral to the pubic tubercle.",
      orderIndex: 3,
    },
    {
      paperId: anatomyPaper.id,
      questionText: "Which cranial nerve supplies the tensor tympani muscle?",
      choices: [
        "Facial nerve (CN VII)",
        "Trigeminal nerve (CN V)",
        "Glossopharyngeal nerve (CN IX)",
        "Vagus nerve (CN X)",
      ],
      correctChoice: 1,
      explanation:
        "The tensor tympani muscle is innervated by the mandibular division (V3) of the trigeminal nerve. This muscle tenses the tympanic membrane and dampens loud sounds. The stapedius muscle, which also dampens loud sounds, is innervated by the facial nerve.",
      orderIndex: 4,
    },
  ];

  // Sample physiology questions
  const physiologyQuestions = [
    {
      paperId: physiologyPaper.id,
      questionText:
        "What is the primary site of erythropoietin production in adults?",
      choices: ["Liver", "Bone marrow", "Kidney", "Spleen"],
      correctChoice: 2,
      explanation:
        "In adults, approximately 90% of erythropoietin is produced by peritubular interstitial cells in the kidney. The liver produces a small amount (about 10%). In the fetus, the liver is the primary site of erythropoietin production.",
      orderIndex: 0,
    },
    {
      paperId: physiologyPaper.id,
      questionText:
        "Which phase of the cardiac cycle has the highest oxygen consumption by the myocardium?",
      choices: [
        "Isovolumetric contraction",
        "Rapid ejection",
        "Reduced ejection",
        "Isovolumetric relaxation",
      ],
      correctChoice: 0,
      explanation:
        "Myocardial oxygen consumption is highest during isovolumetric contraction when the ventricle is developing tension against a closed aortic valve. During this phase, wall stress is maximum, and no external work is being done, making it the most metabolically demanding phase.",
      orderIndex: 1,
    },
    {
      paperId: physiologyPaper.id,
      questionText:
        "The Haldane effect describes the relationship between which of the following?",
      choices: [
        "Oxygen and hemoglobin affinity",
        "Carbon dioxide and oxygen transport",
        "pH and hemoglobin saturation",
        "Temperature and oxygen dissociation",
      ],
      correctChoice: 1,
      explanation:
        "The Haldane effect describes how oxygen binding to hemoglobin affects its affinity for carbon dioxide. Oxygenated hemoglobin has a reduced affinity for CO2, promoting CO2 release in the lungs. Conversely, deoxygenated hemoglobin binds CO2 more readily in the tissues.",
      orderIndex: 2,
    },
    {
      paperId: physiologyPaper.id,
      questionText:
        "Which hormone primarily regulates calcium reabsorption in the distal convoluted tubule?",
      choices: ["Calcitonin", "Parathyroid hormone", "Vitamin D", "Aldosterone"],
      correctChoice: 1,
      explanation:
        "Parathyroid hormone (PTH) increases calcium reabsorption in the distal convoluted tubule (DCT) and thick ascending limb of the loop of Henle. PTH activates calcium channels and calcium-ATPase pumps in these segments. Vitamin D primarily affects intestinal calcium absorption.",
      orderIndex: 3,
    },
    {
      paperId: physiologyPaper.id,
      questionText: "The normal glomerular filtration rate (GFR) in adults is approximately:",
      choices: [
        "60 mL/min",
        "90 mL/min",
        "125 mL/min",
        "180 mL/min",
      ],
      correctChoice: 2,
      explanation:
        "The normal GFR in healthy adults is approximately 125 mL/min or about 180 L/day. This means the entire plasma volume is filtered about 60 times per day. GFR naturally declines with age, approximately 1 mL/min per year after age 40.",
      orderIndex: 4,
    },
  ];

  // Insert all questions
  await db.insert(questions).values([...anatomyQuestions, ...physiologyQuestions]);

  console.log("✅ Seeding complete!");
  console.log(`   Created ${2} papers`);
  console.log(`   Created ${anatomyQuestions.length + physiologyQuestions.length} questions`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

