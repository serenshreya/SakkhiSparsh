-- ============================================================
-- 004_seed_ayurveda.sql
-- Curated Ayurveda condition map — SEED DATA
--
-- ⚠️  WARNING: This is placeholder data for development.
--     Every row is marked verified_by = 'SEED_DATA_UNVERIFIED'.
--     A qualified Ayurvedic practitioner MUST review and verify
--     all entries before any clinical or patient-facing use.
-- ============================================================

INSERT INTO public.ayurveda_condition_map
  (modern_condition, dosha_classification, dietary_notes, lifestyle_notes, classical_reference, verified_by, verified_at)
VALUES
  (
    'eczema',
    'Kapha-Pitta (Vicharchika)',
    'Avoid dairy, fermented foods, sour/spicy items. Favour bitter vegetables (bitter gourd, neem leaves), green gram, barley.',
    'Avoid hot water baths, synthetic clothing. Apply coconut oil or neem oil topically. Practice Pranayama for stress reduction.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Kushta Chikitsa',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'psoriasis',
    'Vata-Kapha (Kitibha / Ekakushta)',
    'Avoid incompatible food combinations (Viruddhahara), non-vegetarian food, curd, jaggery. Include Panchatikta vegetables, turmeric milk.',
    'Virechana (therapeutic purgation) recommended under supervision. Regular oil application (Eladi Tailam). Yoga and meditation for stress management.',
    'Charaka Samhita, Chikitsa Sthana Ch.7; Ashtanga Hridaya, Nidana Sthana Ch.14',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'acne',
    'Pitta-Kapha (Yuvana Pidika / Mukhadushika)',
    'Avoid oily, fried, spicy foods. Reduce sugar intake. Include cooling foods: cucumber, watermelon, aloe vera juice.',
    'Gentle face cleansing with besan (chickpea flour) and turmeric paste. Avoid touching face frequently. Adequate sleep.',
    'Sushruta Samhita, Nidana Sthana Ch.13',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'melanocytic_nevus',
    'Pitta (Tila Kalaka)',
    'No specific dietary restriction. General Pitta-pacifying diet recommended: avoid excess sun exposure-related heating foods.',
    'Monitor for changes in size, shape, or color. No active Ayurvedic intervention typically recommended. Sun protection advised.',
    'Sushruta Samhita, Nidana Sthana Ch.13 — general Kushta context',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'seborrheic_keratosis',
    'Kapha (Charma Keela)',
    'Reduce Kapha-aggravating foods: heavy, oily, cold foods, excess dairy. Favour light, warm, spiced meals.',
    'Mild external applications of Haridra (turmeric) and Nimba (neem) paste. Generally benign — monitoring advised.',
    'Sushruta Samhita, Chikitsa Sthana — Arbuda/Granthi context',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'fungal_infection',
    'Kapha-Pitta (Dadru Kushta)',
    'Avoid sugar, refined carbs, fermented foods, alcohol. Include garlic, turmeric, neem in diet.',
    'Keep affected area dry. Apply neem oil or Marichyadi Tailam. Maintain strict hygiene. Wear breathable cotton clothing.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Dadru',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'vitiligo',
    'Tridosha — Vata-Pitta-Kapha (Shvitra / Kilasa)',
    'Avoid sour foods, curd, fish with milk, incompatible combinations. Include Bakuchi seeds (Psoralea corylifolia), copper-vessel water.',
    'Bakuchi (Psoralea) oil topical application with controlled sun exposure. Avoid stress. Practice Sadvritta (good conduct).',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Shvitra; Ashtanga Hridaya Uttarasthana',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'urticaria',
    'Pitta-Kapha (Sheetapitta / Udarda)',
    'Avoid known allergens, shellfish, excessive salt, fermented foods. Include Haridra Khanda (turmeric preparation) in diet.',
    'Cool compresses. Avoid excessive heat and tight clothing. Stress reduction through meditation. Panchakarma: Virechana if chronic.',
    'Madhava Nidana Ch.50 — Sheetapitta',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'dermatofibroma',
    'Kapha (Granthi)',
    'Light Kapha-pacifying diet. Reduce heavy, oily foods.',
    'Generally benign — monitoring recommended. Mild Lepa (paste) applications of turmeric and sandalwood may be used externally.',
    'Sushruta Samhita, Chikitsa Sthana — Granthi Chikitsa',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'basal_cell_carcinoma',
    'Tridosha — Vata-Pitta-Kapha (Arbuda)',
    'Immune-supportive diet: Ashwagandha, Guduchi (Tinospora), Amalaki (Indian gooseberry). Avoid processed foods.',
    'CRITICAL: Modern medical treatment (excision, Mohs surgery) is primary. Ayurvedic support is strictly adjunctive. Consult oncologist first.',
    'Sushruta Samhita, Nidana Sthana Ch.11 — Arbuda',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'melanoma',
    'Tridosha — Sannipataja Arbuda',
    'Immune-supportive diet with Rasayana herbs under practitioner guidance only.',
    'CRITICAL: This is a life-threatening condition. Modern oncological treatment is non-negotiable. Ayurveda ONLY as adjunctive supportive care under qualified supervision.',
    'Sushruta Samhita, Nidana Sthana Ch.11 — Arbuda; modern integration required',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'actinic_keratosis',
    'Pitta (Daha-predominant Kushta)',
    'Cooling Pitta-pacifying diet: coconut water, mint, coriander. Avoid excess sun-related heating.',
    'Strict sun protection. Aloe vera gel topically. Must be monitored for malignant transformation — regular dermatological follow-up essential.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — general Kushta',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'vascular_lesion',
    'Pitta-Rakta (Raktaja Vikara)',
    'Blood-cooling diet: pomegranate, amla, leafy greens. Avoid hot, spicy, fermented foods.',
    'Raktamokshana (therapeutic bloodletting) under supervision if indicated. Cool Lepas externally. Monitor for changes.',
    'Sushruta Samhita, Sutra Sthana — Raktapitta context',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'warts',
    'Kapha (Charmakeela)',
    'Reduce Kapha-aggravating diet. Include immune-supporting herbs: Guduchi, Tulsi.',
    'Local application of Snuhi Kshira (Euphorbia latex) or Agnikarma (thermal cautery) by qualified practitioner.',
    'Sushruta Samhita, Chikitsa Sthana — Charmakeela',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'rosacea',
    'Pitta (Mukhadaha)',
    'Strictly avoid spicy food, alcohol, hot beverages, tomatoes. Favour cooling foods: cucumber, coconut, fennel.',
    'Gentle skincare with sandalwood and rose water. Avoid sun exposure and extreme temperatures. Stress management essential.',
    'Ashtanga Hridaya — Pitta Kushta context',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'contact_dermatitis',
    'Pitta (Vaipadika / Sparsha-janya Kushta)',
    'Anti-inflammatory diet. Avoid known contact allergens in food (nickel-rich foods if nickel allergy).',
    'Identify and remove causative agent. Neem wash, turmeric paste externally. Aloe vera for soothing.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Kushta general principles',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'seborrheic_dermatitis',
    'Kapha-Pitta (Darunaka)',
    'Avoid excess oily, sweet, and fermented foods. Include bitter and astringent tastes.',
    'Scalp: wash with Triphala or Nimba decoction. Apply Eladi Tailam. Maintain hygiene of affected areas.',
    'Ashtanga Hridaya, Uttarasthana — Kshudra Roga (Darunaka)',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'lichen_planus',
    'Pitta-Vata (Kushta variant)',
    'Cooling, Pitta-pacifying diet. Avoid sour, spicy, fermented foods. Include ghee, bitter vegetables.',
    'Panchatikta Ghrita internally under supervision. Topical Jatyadi Tailam. Stress reduction critical.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Kushta Chikitsa',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'squamous_cell_carcinoma',
    'Tridosha — Dushta Arbuda',
    'Immune-supportive Rasayana diet under practitioner guidance.',
    'CRITICAL: Modern surgical/oncological treatment is primary. Ayurvedic support strictly adjunctive. Urgent dermatology referral required.',
    'Sushruta Samhita, Nidana Sthana Ch.11 — Arbuda',
    'SEED_DATA_UNVERIFIED', NULL
  ),
  (
    'tinea',
    'Kapha-Pitta (Dadru)',
    'Avoid sugar, yeast-containing foods, excess moisture-producing foods. Garlic and turmeric in diet.',
    'Keep area dry. Apply Marichyadi Tailam or neem oil. Maintain hygiene. Avoid shared towels/clothing.',
    'Charaka Samhita, Chikitsa Sthana Ch.7 — Dadru Kushta',
    'SEED_DATA_UNVERIFIED', NULL
  );
