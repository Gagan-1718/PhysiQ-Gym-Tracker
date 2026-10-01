-- =============================================================================
-- Seed Data: Foods Master Nutrition Library (Values normalized per 100g)
-- =============================================================================

USE physiq_db;

INSERT INTO foods (name, calories, protein, carbs, fat, serving_unit) VALUES
-- Proteins / Meats / Dairy
('Chicken Breast (Raw/Skinless)', 165.00, 31.00, 0.00, 3.60, '100g'),
('Chicken Breast (Cooked/Grilled)', 197.00, 37.00, 0.00, 4.50, '100g'),
('Eggs (Whole, Raw)', 143.00, 12.60, 0.70, 9.50, '100g (~2 eggs)'),
('Egg Whites', 52.00, 11.00, 0.70, 0.20, '100g (~3 whites)'),
('Whey Protein Powder (Standard)', 380.00, 75.00, 8.00, 5.00, '100g'),
('Greek Yogurt (Non-fat / Plain)', 59.00, 10.00, 3.60, 0.40, '100g'),
('Paneer (Cottage Cheese, Indian)', 265.00, 18.00, 3.00, 20.00, '100g'),
('Tofu (Firm)', 76.00, 8.00, 1.90, 4.80, '100g'),
('Salmon (Atlantic, Raw)', 208.00, 20.40, 0.00, 13.40, '100g'),
('Tuna (Canned in Water)', 116.00, 25.50, 0.00, 1.00, '100g'),

-- Carbohydrates & Grains
('White Rice (Raw)', 365.00, 7.10, 80.00, 0.70, '100g'),
('White Rice (Cooked)', 130.00, 2.70, 28.20, 0.30, '100g'),
('Rolled Oats (Raw)', 389.00, 16.90, 66.30, 6.90, '100g'),
('Brown Rice (Cooked)', 123.00, 2.70, 25.60, 1.00, '100g'),
('Whole Wheat Bread', 247.00, 13.00, 41.00, 3.40, '100g (~3 slices)'),
('Sweet Potato (Boiled/Baked)', 86.00, 1.60, 20.10, 0.10, '100g'),
('Potato (Boiled)', 87.00, 1.90, 20.00, 0.10, '100g'),
('Banana', 89.00, 1.10, 22.80, 0.30, '100g (~1 medium)'),
('Apple', 52.00, 0.30, 13.80, 0.20, '100g'),

-- Fats & Nuts
('Peanut Butter (Natural)', 588.00, 25.00, 20.00, 50.00, '100g'),
('Almonds (Raw)', 579.00, 21.20, 21.60, 49.90, '100g'),
('Olive Oil', 884.00, 0.00, 0.00, 100.00, '100ml'),
('Avocado', 160.00, 2.00, 8.50, 14.70, '100g'),

-- Vegetables / Legumes
('Broccoli (Raw)', 34.00, 2.80, 6.60, 0.40, '100g'),
('Spinach (Raw)', 23.00, 2.90, 3.60, 0.40, '100g'),
('Lentils / Dal (Boiled)', 116.00, 9.00, 20.10, 0.40, '100g'),
('Chickpeas / Chana (Boiled)', 164.00, 8.90, 27.40, 2.60, '100g');
