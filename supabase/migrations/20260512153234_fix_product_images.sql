
-- 1. Create missing categories
INSERT INTO public.categories (slug, name, hindi_name, description)
VALUES 
('ayurvedic-skincare', 'Ayurvedic Skincare', 'आयुर्वेदिक स्किनकेयर', 'Natural care for radiant skin'),
('wellness-drinks', 'Wellness Drinks', 'वेलनेस ड्रिंक्स', 'Healthy and refreshing herbal drinks')
ON CONFLICT (slug) DO NOTHING;

-- 2. Update existing products with working ImageKit URLs
UPDATE public.products SET images = '{"https://ik.imagekit.io/jain100/chyawanprash_classic_v2_B8mCc_EFE.png"}' WHERE slug = 'chyawanprash-classic';
UPDATE public.products SET images = '{"https://ik.imagekit.io/jain100/ashwagandha_tablets_v2_w8b-U4epF.png"}' WHERE slug = 'ashwagandha-tablets';
UPDATE public.products SET images = '{"https://ik.imagekit.io/jain100/triphala_churna_v2_oTr-Haytt.png"}' WHERE slug = 'triphala-churna';
UPDATE public.products SET images = '{"https://ik.imagekit.io/jain100/kumkumadi_tailam_OMpDfW7Ti.png"}' WHERE slug = 'kumkumadi-tailam';

-- 3. Add the brand new products
INSERT INTO public.products (slug, name, hindi_name, description, short_description, price, discount_price, stock, category_id, dosage_type, images, rating, num_reviews, is_featured)
VALUES 
('brahmi-capsules', 'Brahmi Capsules', 'ब्राह्मी कैप्सूल', 'Traditional brain tonic for memory and focus.', 'Memory & Focus', 599, 499, 80, (SELECT id FROM categories WHERE slug = 'ayurvedic-supplements'), 'Capsule', '{"https://ik.imagekit.io/jain100/brahmi_capsules_dSYgz7xn0.png"}', 4.8, 142, true),

('neem-face-wash', 'Neem Face Wash', 'नीम फेस वॉश', 'Purifying face wash with neem and turmeric for acne-free skin.', 'Purifying Skincare', 350, 299, 120, (SELECT id FROM categories WHERE slug = 'ayurvedic-skincare'), 'Liquid', '{"https://ik.imagekit.io/jain100/neem_face_wash_QRw4BpV71.png"}', 4.7, 95, true),

('shatavari-powder', 'Shatavari Powder', 'शतावरी चूर्ण', 'Hormonal balance and vitality support for women.', 'Women’s Wellness', 450, 399, 60, (SELECT id FROM categories WHERE slug = 'ayurvedic-supplements'), 'Powder', '{"https://ik.imagekit.io/jain100/shatavari_powder_v2_Vs-EhrDtZ.png"}', 4.9, 110, true),

('giloy-juice', 'Giloy Juice', 'गिलोय जूस', 'Powerful immunity booster juice from fresh giloy stems.', 'Immunity Booster', 399, 349, 100, (SELECT id FROM categories WHERE slug = 'wellness-drinks'), 'Liquid', '{"https://ik.imagekit.io/jain100/giloy_juice_mq2LNwlmb.png"}', 4.6, 78, true),

('turmeric-latte', 'Turmeric Latte Mix', 'हल्दी दूध मिक्स', 'Golden milk mix with turmeric, ginger, and black pepper.', 'Healthy Comfort', 299, 249, 150, (SELECT id FROM categories WHERE slug = 'wellness-drinks'), 'Powder', '{"https://ik.imagekit.io/jain100/turmeric_latte_mix_1jLXevHvA.png"}', 4.8, 165, true),

('kesar-chandan-pack', 'Kesar Chandan Pack', 'केसर चंदन पैक', 'Premium saffron and sandalwood face pack for radiant glow.', 'Beauty & Glow', 699, 599, 45, (SELECT id FROM categories WHERE slug = 'ayurvedic-skincare'), 'Pack', '{"https://ik.imagekit.io/jain100/kesar_chandan_face_pack_ysM2vbDDX.png"}', 4.9, 56, true)
ON CONFLICT (slug) DO NOTHING;
