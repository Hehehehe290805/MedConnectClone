export const MEDICAL_TERMS = {
  // Cardiology
  "hypertension":          { definition: "High blood pressure — sustained elevation of arterial pressure",                      specialty: "Cardiology" },
  "myocardial infarction": { definition: "Heart attack — sudden loss of blood supply to part of the heart muscle",             specialty: "Cardiology" },
  "tachycardia":           { definition: "Abnormally fast heart rate (>100 bpm at rest)",                                      specialty: "Cardiology" },
  "bradycardia":           { definition: "Abnormally slow heart rate (<60 bpm at rest)",                                       specialty: "Cardiology" },
  "palpitations":          { definition: "Awareness of one's own heartbeat — rapid, fluttering, or pounding",                  specialty: "Cardiology" },
  "angina":                { definition: "Chest pain or pressure from reduced blood flow to the heart",                        specialty: "Cardiology" },
  "arrhythmia":            { definition: "Irregular heart rhythm — too fast, too slow, or erratic",                           specialty: "Cardiology" },
  "cardiomegaly":          { definition: "Abnormal enlargement of the heart",                                                  specialty: "Cardiology" },
  "embolism":              { definition: "Blockage of a blood vessel by a clot or foreign material",                           specialty: "Cardiology" },
  "thrombosis":            { definition: "Formation of a blood clot inside a blood vessel",                                    specialty: "Cardiology" },
  "syncope":               { definition: "Fainting — temporary loss of consciousness from reduced brain blood flow",           specialty: "Cardiology" },

  // Pulmonology
  "dyspnea":               { definition: "Shortness of breath or difficulty breathing",                                        specialty: "Pulmonology" },
  "hemoptysis":            { definition: "Coughing up blood or blood-tinged mucus from the lungs",                            specialty: "Pulmonology" },
  "apnea":                 { definition: "Temporary cessation of breathing",                                                   specialty: "Pulmonology" },
  "cyanosis":              { definition: "Bluish skin discoloration from insufficient blood oxygen",                           specialty: "Pulmonology" },
  "pneumonia":             { definition: "Lung infection causing the air sacs to fill with fluid",                             specialty: "Pulmonology" },
  "asthma":                { definition: "Chronic airway inflammation causing recurrent breathing difficulty",                 specialty: "Pulmonology" },
  "tuberculosis":          { definition: "Bacterial infection of the lungs spread through the air",                           specialty: "Pulmonology" },
  "pleurisy":              { definition: "Inflammation of the membrane surrounding the lungs, causing sharp chest pain",       specialty: "Pulmonology" },

  // Neurology
  "paresthesia":           { definition: "Abnormal sensation such as tingling, numbness, or 'pins and needles'",              specialty: "Neurology" },
  "seizure":               { definition: "Sudden uncontrolled electrical disturbance in the brain",                           specialty: "Neurology" },
  "migraine":              { definition: "Severe recurring headache, often with nausea and light sensitivity",                specialty: "Neurology" },
  "neuropathy":            { definition: "Damage or dysfunction of peripheral nerves causing weakness or pain",               specialty: "Neurology" },
  "vertigo":               { definition: "Sensation of spinning or dizziness from inner ear or brain issues",                 specialty: "Neurology" },
  "aphasia":               { definition: "Loss of ability to speak or understand language from brain damage",                 specialty: "Neurology" },
  "ataxia":                { definition: "Lack of voluntary coordination of muscle movements",                                specialty: "Neurology" },

  // Gastroenterology
  "melena":                { definition: "Black, tarry stools caused by upper gastrointestinal bleeding",                     specialty: "Gastroenterology" },
  "jaundice":              { definition: "Yellowing of the skin and eyes from excess bilirubin",                              specialty: "Gastroenterology" },
  "dysphagia":             { definition: "Difficulty or discomfort when swallowing",                                          specialty: "Gastroenterology" },
  "cholelithiasis":        { definition: "Gallstones — hardened deposits inside the gallbladder",                            specialty: "Gastroenterology" },
  "pancreatitis":          { definition: "Inflammation of the pancreas causing abdominal pain",                               specialty: "Gastroenterology" },
  "gastritis":             { definition: "Inflammation of the stomach lining",                                                specialty: "Gastroenterology" },
  "cirrhosis":             { definition: "Late-stage liver scarring from long-term damage",                                   specialty: "Gastroenterology" },
  "hepatomegaly":          { definition: "Abnormal enlargement of the liver",                                                 specialty: "Gastroenterology" },
  "peptic ulcer":          { definition: "Open sore in the lining of the stomach or small intestine",                        specialty: "Gastroenterology" },
  "appendicitis":          { definition: "Inflammation of the appendix, usually requiring surgery",                          specialty: "Gastroenterology" },

  // Endocrinology
  "diabetes mellitus":     { definition: "Chronic metabolic disorder characterized by high blood sugar",                     specialty: "Endocrinology" },
  "hyperglycemia":         { definition: "Abnormally elevated blood sugar levels",                                            specialty: "Endocrinology" },
  "hypoglycemia":          { definition: "Abnormally low blood sugar levels, causing dizziness and confusion",               specialty: "Endocrinology" },
  "hypothyroidism":        { definition: "Underactive thyroid producing insufficient hormone",                               specialty: "Endocrinology" },
  "hyperthyroidism":       { definition: "Overactive thyroid producing excess hormone",                                      specialty: "Endocrinology" },
  "polyuria":              { definition: "Excessive urination, often a sign of diabetes or kidney issues",                   specialty: "Endocrinology" },

  // Nephrology / Urology
  "hematuria":             { definition: "Blood in the urine",                                                               specialty: "Nephrology" },
  "proteinuria":           { definition: "Excess protein in the urine, a sign of kidney damage",                            specialty: "Nephrology" },
  "uremia":                { definition: "Toxicity from waste buildup when kidneys fail",                                    specialty: "Nephrology" },
  "dysuria":               { definition: "Painful or burning sensation during urination",                                    specialty: "Urology" },

  // Hematology
  "anemia":                { definition: "Deficiency of red blood cells or hemoglobin causing fatigue and pallor",           specialty: "Hematology" },
  "pallor":                { definition: "Unusual paleness of skin from reduced blood flow or anemia",                      specialty: "Hematology" },
  "splenomegaly":          { definition: "Abnormal enlargement of the spleen",                                              specialty: "Hematology" },
  "ecchymosis":            { definition: "Bruising — discoloration from blood leaking under the skin",                      specialty: "Hematology" },
  "hemorrhage":            { definition: "Excessive or uncontrolled bleeding",                                              specialty: "Hematology" },

  // Rheumatology / Orthopedics
  "myalgia":               { definition: "Muscle pain or aching",                                                           specialty: "Rheumatology" },
  "arthralgia":            { definition: "Joint pain without visible inflammation",                                          specialty: "Rheumatology" },
  "arthritis":             { definition: "Inflammation of one or more joints causing pain and stiffness",                   specialty: "Rheumatology" },
  "osteoporosis":          { definition: "Reduced bone density increasing fracture risk",                                    specialty: "Orthopedics" },
  "fracture":              { definition: "Break in the continuity of a bone",                                               specialty: "Orthopedics" },

  // Dermatology
  "alopecia":              { definition: "Hair loss, either partial or complete",                                           specialty: "Dermatology" },
  "pruritus":              { definition: "Intense itching of the skin",                                                     specialty: "Dermatology" },
  "urticaria":             { definition: "Hives — raised, itchy welts on the skin from an allergic reaction",              specialty: "Dermatology" },
  "psoriasis":             { definition: "Chronic skin condition causing red, scaly patches",                               specialty: "Dermatology" },
  "dermatitis":            { definition: "Inflammation of the skin causing redness, swelling, and itching",                specialty: "Dermatology" },

  // ENT
  "tinnitus":              { definition: "Ringing or buzzing sound in the ears without external source",                    specialty: "ENT" },
  "epistaxis":             { definition: "Nosebleed",                                                                       specialty: "ENT" },
  "rhinitis":              { definition: "Inflammation of the nasal mucous membrane causing congestion and runny nose",    specialty: "ENT" },
  "pharyngitis":           { definition: "Inflammation or infection of the pharynx (throat)",                              specialty: "ENT" },
  "otitis":                { definition: "Infection or inflammation of the ear",                                            specialty: "ENT" },

  // Psychiatry
  "insomnia":              { definition: "Persistent difficulty falling or staying asleep",                                 specialty: "Psychiatry" },
  "depression":            { definition: "Mood disorder with persistent sadness, hopelessness, and loss of interest",      specialty: "Psychiatry" },
  "anxiety":               { definition: "Excessive, uncontrollable worry or fear affecting daily life",                   specialty: "Psychiatry" },
  "hallucination":         { definition: "Perceiving something (sound, vision) that is not externally present",           specialty: "Psychiatry" },
  "delusion":              { definition: "Fixed false belief not based in reality and resistant to reason",                specialty: "Psychiatry" },

  // General / Internal Medicine
  "edema":                 { definition: "Swelling caused by excess fluid accumulating in body tissues",                   specialty: "Internal Medicine" },
  "lymphadenopathy":       { definition: "Swelling of lymph nodes, often a sign of infection or cancer",                  specialty: "Internal Medicine" },
  "cachexia":              { definition: "Extreme weight loss and muscle wasting due to chronic illness",                  specialty: "Internal Medicine" },
  "malaise":               { definition: "General feeling of discomfort, illness, or lack of well-being",                 specialty: "Internal Medicine" },
  "febrile":               { definition: "Having or relating to a fever",                                                  specialty: "Internal Medicine" },
  "hypertrophy":           { definition: "Enlargement or overgrowth of an organ or tissue",                               specialty: "General" },
  "atrophy":               { definition: "Wasting or reduction in size of an organ or tissue",                            specialty: "General" },
  "necrosis":              { definition: "Premature death of cells or tissue in a living body",                            specialty: "General" },
  "abscess":               { definition: "Localized pocket of pus caused by a bacterial infection",                       specialty: "General Surgery" },
  "hernia":                { definition: "Protrusion of an organ through the wall of the cavity that normally contains it", specialty: "General Surgery" },
  "hypothermia":           { definition: "Dangerously low core body temperature below 35°C",                             specialty: "Emergency Medicine" },
  "hyperthermia":          { definition: "Dangerously elevated body temperature from heat illness",                       specialty: "Emergency Medicine" },
};
