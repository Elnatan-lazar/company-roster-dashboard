-- ================================================================
-- seed_company.sql — מילוי נתוני פלוגה מלאה
--
-- כיצד הסקריפט עובד:
--
-- 1. שלב א׳ — שליפת מזהי המחלקות (platoon IDs) מהטבלה הקיימת
--    לפי שם המחלקה. המחלקות נוצרו כבר בסכמה הראשית, כך שאנחנו
--    רק שולפים את ה-UUID שלהן ושומרים אותן במשתנים.
--
-- 2. שלב ב׳ — יצירת הצוותים (crews).
--    כל צוות מקבל UUID חדש (gen_random_uuid()) ומשויך ל-platoon_id
--    שנשלף בשלב א׳.
--
-- 3. שלב ג׳ — יצירת משתמשי auth.users.
--    כל חייל מקבל שורה ב-auth.users (ללא סיסמה, כי מערכת OTP).
--    ה-UUID של ה-auth.users חייב להיות זהה ל-UUID ב-public.users
--    כי יש בין הטבלאות FK: public.users.id → auth.users.id.
--
-- 4. שלב ד׳ — יצירת שורות public.users עם כל הפרטים:
--    שם פרטי, שם משפחה, מס׳ אישי, טלפון, תפקיד, מחלקה, צוות.
--
-- 5. שלב ה׳ — עדכון commander_id בטבלת crews.
--    לא ניתן לעשות זאת בעת ה-INSERT כי ה-users לא קיימים עדיין.
--    לכן מגדירים אחרי ה-INSERT.
--
-- 6. שלב ו׳ — עדכון commander_id בטבלת platoons.
--    כנ״ל — מעדכנים מי מפקד כל מחלקה.
--
-- 7. שלב ז׳ — הוספת כל האימיילים לרשימת הלבנה (email_whitelist).
--
-- הסקריפט רץ בתוך DO $$ ... $$ שהוא בלוק PL/pgSQL אנונימי.
-- הוא עובר את RLS (Row Level Security) כי הוא רץ כ-superuser
-- בסביבת ה-SQL Editor של Supabase.
-- ================================================================

DO $$
DECLARE
  -- === מזהי מחלקות ===
  p_hq   UUID;  -- מטה פלוגה
  p1     UUID;  -- מחלקה 1
  p2     UUID;  -- מחלקה 2
  p3     UUID;  -- מחלקה 3
  p4     UUID;  -- מחלקה 4

  -- === מזהי צוותים — מטה פלוגה ===
  c_hq1  UUID := gen_random_uuid();  -- צוות מ"פ
  c_hq2  UUID := gen_random_uuid();  -- צוות סמ"פ
  c_hq3  UUID := gen_random_uuid();  -- צוות מטה

  -- === מזהי צוותים — מחלקה 1 ===
  c1_1   UUID := gen_random_uuid();  -- צוות א׳
  c1_2   UUID := gen_random_uuid();  -- צוות ב׳
  c1_3   UUID := gen_random_uuid();  -- צוות ג׳

  -- === מזהי צוותים — מחלקה 2 ===
  c2_1   UUID := gen_random_uuid();
  c2_2   UUID := gen_random_uuid();
  c2_3   UUID := gen_random_uuid();

  -- === מזהי צוותים — מחלקה 3 ===
  c3_1   UUID := gen_random_uuid();
  c3_2   UUID := gen_random_uuid();
  c3_3   UUID := gen_random_uuid();

  -- === מזהי צוותים — מחלקה 4 ===
  c4_1   UUID := gen_random_uuid();
  c4_2   UUID := gen_random_uuid();
  c4_3   UUID := gen_random_uuid();

  -- ================================================================
  -- מזהי חיילים — סה"כ 58 איש
  -- מטה פלוגה: 10 (סמ"פ + 3 צוותים × 3 אנשים)
  -- כל מחלקה קרבית: 12 (מ"מ + 3 צוותים × 4 אנשים, כשהמ"מ הוא גם מט"ק צוות א׳)
  -- ================================================================

  -- מטה פלוגה
  u_dep    UUID := gen_random_uuid();  -- סמ"פ / מ"מ מטה

  u_hq1_1  UUID := gen_random_uuid();  -- מפקד צוות מ"פ
  u_hq1_2  UUID := gen_random_uuid();  -- תותחן
  u_hq1_3  UUID := gen_random_uuid();  -- נהג

  u_hq2_1  UUID := gen_random_uuid();  -- מפקד צוות סמ"פ
  u_hq2_2  UUID := gen_random_uuid();  -- תותחן
  u_hq2_3  UUID := gen_random_uuid();  -- נהג

  u_hq3_1  UUID := gen_random_uuid();  -- מפקד צוות מטה
  u_hq3_2  UUID := gen_random_uuid();  -- תותחן
  u_hq3_3  UUID := gen_random_uuid();  -- נהג

  -- מחלקה 1
  u_p1_mm   UUID := gen_random_uuid();  -- מ"מ 1 (גם מפקד צוות א׳)
  u_p1_1_2  UUID := gen_random_uuid();  -- תותחן
  u_p1_1_3  UUID := gen_random_uuid();  -- טוען
  u_p1_1_4  UUID := gen_random_uuid();  -- נהג
  u_p1_2_1  UUID := gen_random_uuid();  -- מפקד צוות ב׳
  u_p1_2_2  UUID := gen_random_uuid();  -- תותחן
  u_p1_2_3  UUID := gen_random_uuid();  -- טוען
  u_p1_2_4  UUID := gen_random_uuid();  -- נהג
  u_p1_3_1  UUID := gen_random_uuid();  -- מפקד צוות ג׳
  u_p1_3_2  UUID := gen_random_uuid();  -- תותחן
  u_p1_3_3  UUID := gen_random_uuid();  -- טוען
  u_p1_3_4  UUID := gen_random_uuid();  -- נהג

  -- מחלקה 2
  u_p2_mm   UUID := gen_random_uuid();
  u_p2_1_2  UUID := gen_random_uuid();
  u_p2_1_3  UUID := gen_random_uuid();
  u_p2_1_4  UUID := gen_random_uuid();
  u_p2_2_1  UUID := gen_random_uuid();
  u_p2_2_2  UUID := gen_random_uuid();
  u_p2_2_3  UUID := gen_random_uuid();
  u_p2_2_4  UUID := gen_random_uuid();
  u_p2_3_1  UUID := gen_random_uuid();
  u_p2_3_2  UUID := gen_random_uuid();
  u_p2_3_3  UUID := gen_random_uuid();
  u_p2_3_4  UUID := gen_random_uuid();

  -- מחלקה 3
  u_p3_mm   UUID := gen_random_uuid();
  u_p3_1_2  UUID := gen_random_uuid();
  u_p3_1_3  UUID := gen_random_uuid();
  u_p3_1_4  UUID := gen_random_uuid();
  u_p3_2_1  UUID := gen_random_uuid();
  u_p3_2_2  UUID := gen_random_uuid();
  u_p3_2_3  UUID := gen_random_uuid();
  u_p3_2_4  UUID := gen_random_uuid();
  u_p3_3_1  UUID := gen_random_uuid();
  u_p3_3_2  UUID := gen_random_uuid();
  u_p3_3_3  UUID := gen_random_uuid();
  u_p3_3_4  UUID := gen_random_uuid();

  -- מחלקה 4
  u_p4_mm   UUID := gen_random_uuid();
  u_p4_1_2  UUID := gen_random_uuid();
  u_p4_1_3  UUID := gen_random_uuid();
  u_p4_1_4  UUID := gen_random_uuid();
  u_p4_2_1  UUID := gen_random_uuid();
  u_p4_2_2  UUID := gen_random_uuid();
  u_p4_2_3  UUID := gen_random_uuid();
  u_p4_2_4  UUID := gen_random_uuid();
  u_p4_3_1  UUID := gen_random_uuid();
  u_p4_3_2  UUID := gen_random_uuid();
  u_p4_3_3  UUID := gen_random_uuid();
  u_p4_3_4  UUID := gen_random_uuid();

BEGIN

  -- ================================================================
  -- שלב א׳ — שליפת מזהי המחלקות הקיימות
  -- ================================================================
  SELECT id INTO p_hq FROM public.platoons WHERE platoon_number = 0;
  SELECT id INTO p1   FROM public.platoons WHERE platoon_number = 1;
  SELECT id INTO p2   FROM public.platoons WHERE platoon_number = 2;
  SELECT id INTO p3   FROM public.platoons WHERE platoon_number = 3;
  SELECT id INTO p4   FROM public.platoons WHERE platoon_number = 4;

  IF p_hq IS NULL THEN RAISE EXCEPTION 'מטה פלוגה לא נמצא — הרץ תחילה את schema.sql'; END IF;
  IF p1   IS NULL THEN RAISE EXCEPTION 'מחלקה 1 לא נמצאה'; END IF;
  IF p2   IS NULL THEN RAISE EXCEPTION 'מחלקה 2 לא נמצאה'; END IF;
  IF p3   IS NULL THEN RAISE EXCEPTION 'מחלקה 3 לא נמצאה'; END IF;
  IF p4   IS NULL THEN RAISE EXCEPTION 'מחלקה 4 לא נמצאה'; END IF;

  -- ================================================================
  -- שלב ב׳ — יצירת צוותים
  -- ================================================================
  INSERT INTO public.crews (id, platoon_id, name) VALUES
    -- מטה פלוגה
    (c_hq1, p_hq, 'צוות מ"פ'),
    (c_hq2, p_hq, 'צוות סמ"פ'),
    (c_hq3, p_hq, 'צוות מטה'),
    -- מחלקה 1
    (c1_1, p1, 'צוות א׳'),
    (c1_2, p1, 'צוות ב׳'),
    (c1_3, p1, 'צוות ג׳'),
    -- מחלקה 2
    (c2_1, p2, 'צוות א׳'),
    (c2_2, p2, 'צוות ב׳'),
    (c2_3, p2, 'צוות ג׳'),
    -- מחלקה 3
    (c3_1, p3, 'צוות א׳'),
    (c3_2, p3, 'צוות ב׳'),
    (c3_3, p3, 'צוות ג׳'),
    -- מחלקה 4
    (c4_1, p4, 'צוות א׳'),
    (c4_2, p4, 'צוות ב׳'),
    (c4_3, p4, 'צוות ג׳');

  -- ================================================================
  -- שלב ג׳ — יצירת משתמשי auth.users (ללא סיסמה — מערכת OTP)
  -- ================================================================
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES
    -- מטה פלוגה
    ('00000000-0000-0000-0000-000000000000', u_dep,   'authenticated', 'authenticated', 'david.levi@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq1_1, 'authenticated', 'authenticated', 'yossi.cohen@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq1_2, 'authenticated', 'authenticated', 'avi.shemesh@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq1_3, 'authenticated', 'authenticated', 'benny.golan@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq2_1, 'authenticated', 'authenticated', 'moshe.peretz@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq2_2, 'authenticated', 'authenticated', 'danny.biton@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq2_3, 'authenticated', 'authenticated', 'harel.sadoon@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq3_1, 'authenticated', 'authenticated', 'oren.levi@idf.il',        '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq3_2, 'authenticated', 'authenticated', 'ziv.nachmias@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_hq3_3, 'authenticated', 'authenticated', 'chen.sagi@idf.il',        '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    -- מחלקה 1
    ('00000000-0000-0000-0000-000000000000', u_p1_mm,  'authenticated', 'authenticated', 'roee.shamir@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_1_2, 'authenticated', 'authenticated', 'amit.haim@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_1_3, 'authenticated', 'authenticated', 'pinhas.valensi@idf.il',  '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_1_4, 'authenticated', 'authenticated', 'tsachi.maroko@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_2_1, 'authenticated', 'authenticated', 'kobi.dahan@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_2_2, 'authenticated', 'authenticated', 'reuven.sarah@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_2_3, 'authenticated', 'authenticated', 'shimon.ohana@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_2_4, 'authenticated', 'authenticated', 'tomer.elbaz@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_3_1, 'authenticated', 'authenticated', 'eli.ben-david@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_3_2, 'authenticated', 'authenticated', 'nachum.tayeb@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_3_3, 'authenticated', 'authenticated', 'michael.pinto@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p1_3_4, 'authenticated', 'authenticated', 'liran.azulay@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    -- מחלקה 2
    ('00000000-0000-0000-0000-000000000000', u_p2_mm,  'authenticated', 'authenticated', 'noam.bar@idf.il',        '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_1_2, 'authenticated', 'authenticated', 'yuval.mizrahi@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_1_3, 'authenticated', 'authenticated', 'idan.friedman@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_1_4, 'authenticated', 'authenticated', 'roi.toledano@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_2_1, 'authenticated', 'authenticated', 'guy.shapira@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_2_2, 'authenticated', 'authenticated', 'matan.cohen@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_2_3, 'authenticated', 'authenticated', 'omer.kaplan@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_2_4, 'authenticated', 'authenticated', 'bar.levy@idf.il',        '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_3_1, 'authenticated', 'authenticated', 'alon.hakimi@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_3_2, 'authenticated', 'authenticated', 'tal.mor@idf.il',         '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_3_3, 'authenticated', 'authenticated', 'nir.avraham@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p2_3_4, 'authenticated', 'authenticated', 'shay.zarfati@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    -- מחלקה 3
    ('00000000-0000-0000-0000-000000000000', u_p3_mm,  'authenticated', 'authenticated', 'itay.berger@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_1_2, 'authenticated', 'authenticated', 'nimrod.cohen@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_1_3, 'authenticated', 'authenticated', 'liron.alfasi@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_1_4, 'authenticated', 'authenticated', 'eitan.yisrael@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_2_1, 'authenticated', 'authenticated', 'tamir.abu@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_2_2, 'authenticated', 'authenticated', 'barak.shilo@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_2_3, 'authenticated', 'authenticated', 'dan.gross@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_2_4, 'authenticated', 'authenticated', 'ariel.hadad@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_3_1, 'authenticated', 'authenticated', 'ofir.nissim@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_3_2, 'authenticated', 'authenticated', 'doron.gabay@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_3_3, 'authenticated', 'authenticated', 'shai.eldad@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p3_3_4, 'authenticated', 'authenticated', 'raz.peleg@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    -- מחלקה 4
    ('00000000-0000-0000-0000-000000000000', u_p4_mm,  'authenticated', 'authenticated', 'yoni.klein@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_1_2, 'authenticated', 'authenticated', 'dean.shmuel@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_1_3, 'authenticated', 'authenticated', 'rani.halevi@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_1_4, 'authenticated', 'authenticated', 'yogev.mashiah@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_2_1, 'authenticated', 'authenticated', 'adi.zohar@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_2_2, 'authenticated', 'authenticated', 'shlomi.hazan@idf.il',    '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_2_3, 'authenticated', 'authenticated', 'yoav.arbel@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_2_4, 'authenticated', 'authenticated', 'eden.tzur@idf.il',       '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_3_1, 'authenticated', 'authenticated', 'shachar.amara@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_3_2, 'authenticated', 'authenticated', 'keshet.reuven@idf.il',   '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_3_3, 'authenticated', 'authenticated', 'ori.peretz@idf.il',      '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', u_p4_3_4, 'authenticated', 'authenticated', 'gal.eliyahu@idf.il',     '', NOW(), '{"provider":"email","providers":["email"]}', '{}', false, NOW(), NOW());

  -- ================================================================
  -- שלב ד׳ — יצירת שורות public.users
  -- מ"ס אישי 9000001–9000058, טלפון 050-9000001 ואילך
  -- ================================================================
  INSERT INTO public.users (
    id, email, first_name, last_name, personal_id, phone_number,
    role, primary_platoon_id, crew_id, crew_position, status, medical_fitness
  ) VALUES

    -- *** מטה פלוגה ***
    -- סמ"פ (מ"מ מטה)
    (u_dep,   'david.levi@idf.il',    'דוד',    'לוי',      '9000001', '0509000001', 'platoon_commander', p_hq, NULL,  NULL,        'available', TRUE),
    -- צוות מ"פ
    (u_hq1_1, 'yossi.cohen@idf.il',   'יוסי',   'כהן',      '9000002', '0509000002', 'crew_commander',   p_hq, c_hq1, 'commander', 'available', TRUE),
    (u_hq1_2, 'avi.shemesh@idf.il',   'אבי',    'שמש',      '9000003', '0509000003', 'soldier',          p_hq, c_hq1, 'gunner',    'available', TRUE),
    (u_hq1_3, 'benny.golan@idf.il',   'בני',    'גולן',     '9000004', '0509000004', 'soldier',          p_hq, c_hq1, 'driver',    'available', TRUE),
    -- צוות סמ"פ
    (u_hq2_1, 'moshe.peretz@idf.il',  'משה',    'פרץ',      '9000005', '0509000005', 'crew_commander',   p_hq, c_hq2, 'commander', 'available', TRUE),
    (u_hq2_2, 'danny.biton@idf.il',   'דני',    'ביטון',    '9000006', '0509000006', 'soldier',          p_hq, c_hq2, 'gunner',    'available', TRUE),
    (u_hq2_3, 'harel.sadoon@idf.il',  'הראל',   'סעדון',    '9000007', '0509000007', 'soldier',          p_hq, c_hq2, 'driver',    'available', TRUE),
    -- צוות מטה
    (u_hq3_1, 'oren.levi@idf.il',     'אורן',   'לוי',      '9000008', '0509000008', 'crew_commander',   p_hq, c_hq3, 'commander', 'available', TRUE),
    (u_hq3_2, 'ziv.nachmias@idf.il',  'זיו',    'נחמיאס',   '9000009', '0509000009', 'soldier',          p_hq, c_hq3, 'gunner',    'available', TRUE),
    (u_hq3_3, 'chen.sagi@idf.il',     'חן',     'שגיא',     '9000010', '0509000010', 'soldier',          p_hq, c_hq3, 'driver',    'available', TRUE),

    -- *** מחלקה 1 ***
    -- צוות א׳ — מ"מ מפקד
    (u_p1_mm,  'roee.shamir@idf.il',   'רועי',   'שמיר',     '9000011', '0509000011', 'platoon_commander', p1, c1_1, 'commander', 'available', TRUE),
    (u_p1_1_2, 'amit.haim@idf.il',     'עמית',   'חיים',     '9000012', '0509000012', 'soldier',           p1, c1_1, 'gunner',    'available', TRUE),
    (u_p1_1_3, 'pinhas.valensi@idf.il','פנחס',   'ולנסי',    '9000013', '0509000013', 'soldier',           p1, c1_1, 'loader',    'available', TRUE),
    (u_p1_1_4, 'tsachi.maroko@idf.il', 'צחי',    'מרוקו',    '9000014', '0509000014', 'soldier',           p1, c1_1, 'driver',    'available', TRUE),
    -- צוות ב׳
    (u_p1_2_1, 'kobi.dahan@idf.il',    'קובי',   'דהן',      '9000015', '0509000015', 'crew_commander',    p1, c1_2, 'commander', 'available', TRUE),
    (u_p1_2_2, 'reuven.sarah@idf.il',  'ראובן',  'שרה',      '9000016', '0509000016', 'soldier',           p1, c1_2, 'gunner',    'available', TRUE),
    (u_p1_2_3, 'shimon.ohana@idf.il',  'שמעון',  'אוחנה',    '9000017', '0509000017', 'soldier',           p1, c1_2, 'loader',    'available', TRUE),
    (u_p1_2_4, 'tomer.elbaz@idf.il',   'תומר',   'אלבז',     '9000018', '0509000018', 'soldier',           p1, c1_2, 'driver',    'available', TRUE),
    -- צוות ג׳
    (u_p1_3_1, 'eli.ben-david@idf.il', 'אלי',    'בן-דוד',   '9000019', '0509000019', 'crew_commander',    p1, c1_3, 'commander', 'available', TRUE),
    (u_p1_3_2, 'nachum.tayeb@idf.il',  'נחום',   'טייב',     '9000020', '0509000020', 'soldier',           p1, c1_3, 'gunner',    'available', TRUE),
    (u_p1_3_3, 'michael.pinto@idf.il', 'מיכאל',  'פינטו',    '9000021', '0509000021', 'soldier',           p1, c1_3, 'loader',    'available', TRUE),
    (u_p1_3_4, 'liran.azulay@idf.il',  'לירן',   'אזולאי',   '9000022', '0509000022', 'soldier',           p1, c1_3, 'driver',    'available', TRUE),

    -- *** מחלקה 2 ***
    (u_p2_mm,  'noam.bar@idf.il',      'נועם',   'בר',       '9000023', '0509000023', 'platoon_commander', p2, c2_1, 'commander', 'available', TRUE),
    (u_p2_1_2, 'yuval.mizrahi@idf.il', 'יובל',   'מזרחי',    '9000024', '0509000024', 'soldier',           p2, c2_1, 'gunner',    'available', TRUE),
    (u_p2_1_3, 'idan.friedman@idf.il', 'אידן',   'פרידמן',   '9000025', '0509000025', 'soldier',           p2, c2_1, 'loader',    'available', TRUE),
    (u_p2_1_4, 'roi.toledano@idf.il',  'רועי',   'טולדנו',   '9000026', '0509000026', 'soldier',           p2, c2_1, 'driver',    'available', TRUE),
    (u_p2_2_1, 'guy.shapira@idf.il',   'גיא',    'שפירא',    '9000027', '0509000027', 'crew_commander',    p2, c2_2, 'commander', 'available', TRUE),
    (u_p2_2_2, 'matan.cohen@idf.il',   'מתן',    'כהן',      '9000028', '0509000028', 'soldier',           p2, c2_2, 'gunner',    'available', TRUE),
    (u_p2_2_3, 'omer.kaplan@idf.il',   'עומר',   'קפלן',     '9000029', '0509000029', 'soldier',           p2, c2_2, 'loader',    'available', TRUE),
    (u_p2_2_4, 'bar.levy@idf.il',      'בר',     'לוי',      '9000030', '0509000030', 'soldier',           p2, c2_2, 'driver',    'available', TRUE),
    (u_p2_3_1, 'alon.hakimi@idf.il',   'אלון',   'חקימי',    '9000031', '0509000031', 'crew_commander',    p2, c2_3, 'commander', 'available', TRUE),
    (u_p2_3_2, 'tal.mor@idf.il',       'טל',     'מור',      '9000032', '0509000032', 'soldier',           p2, c2_3, 'gunner',    'available', TRUE),
    (u_p2_3_3, 'nir.avraham@idf.il',   'ניר',    'אברהם',    '9000033', '0509000033', 'soldier',           p2, c2_3, 'loader',    'available', TRUE),
    (u_p2_3_4, 'shay.zarfati@idf.il',  'שי',     'זרפתי',    '9000034', '0509000034', 'soldier',           p2, c2_3, 'driver',    'available', TRUE),

    -- *** מחלקה 3 ***
    (u_p3_mm,  'itay.berger@idf.il',   'איתי',   'ברגר',     '9000035', '0509000035', 'platoon_commander', p3, c3_1, 'commander', 'available', TRUE),
    (u_p3_1_2, 'nimrod.cohen@idf.il',  'נימרוד', 'כהן',      '9000036', '0509000036', 'soldier',           p3, c3_1, 'gunner',    'available', TRUE),
    (u_p3_1_3, 'liron.alfasi@idf.il',  'לירון',  'אלפסי',    '9000037', '0509000037', 'soldier',           p3, c3_1, 'loader',    'available', TRUE),
    (u_p3_1_4, 'eitan.yisrael@idf.il', 'איתן',   'ישראל',    '9000038', '0509000038', 'soldier',           p3, c3_1, 'driver',    'available', TRUE),
    (u_p3_2_1, 'tamir.abu@idf.il',     'תמיר',   'אבו',      '9000039', '0509000039', 'crew_commander',    p3, c3_2, 'commander', 'available', TRUE),
    (u_p3_2_2, 'barak.shilo@idf.il',   'ברק',    'שילה',     '9000040', '0509000040', 'soldier',           p3, c3_2, 'gunner',    'available', TRUE),
    (u_p3_2_3, 'dan.gross@idf.il',     'דן',     'גרוס',     '9000041', '0509000041', 'soldier',           p3, c3_2, 'loader',    'available', TRUE),
    (u_p3_2_4, 'ariel.hadad@idf.il',   'אריאל',  'חדד',      '9000042', '0509000042', 'soldier',           p3, c3_2, 'driver',    'available', TRUE),
    (u_p3_3_1, 'ofir.nissim@idf.il',   'עופר',   'ניסים',    '9000043', '0509000043', 'crew_commander',    p3, c3_3, 'commander', 'available', TRUE),
    (u_p3_3_2, 'doron.gabay@idf.il',   'דורון',  'גבאי',     '9000044', '0509000044', 'soldier',           p3, c3_3, 'gunner',    'available', TRUE),
    (u_p3_3_3, 'shai.eldad@idf.il',    'שי',     'אלדד',     '9000045', '0509000045', 'soldier',           p3, c3_3, 'loader',    'available', TRUE),
    (u_p3_3_4, 'raz.peleg@idf.il',     'רז',     'פלג',      '9000046', '0509000046', 'soldier',           p3, c3_3, 'driver',    'available', TRUE),

    -- *** מחלקה 4 ***
    (u_p4_mm,  'yoni.klein@idf.il',    'יוני',   'קליין',    '9000047', '0509000047', 'platoon_commander', p4, c4_1, 'commander', 'available', TRUE),
    (u_p4_1_2, 'dean.shmuel@idf.il',   'דין',    'שמואל',    '9000048', '0509000048', 'soldier',           p4, c4_1, 'gunner',    'available', TRUE),
    (u_p4_1_3, 'rani.halevi@idf.il',   'רני',    'הלוי',     '9000049', '0509000049', 'soldier',           p4, c4_1, 'loader',    'available', TRUE),
    (u_p4_1_4, 'yogev.mashiah@idf.il', 'יוגב',   'משיח',     '9000050', '0509000050', 'soldier',           p4, c4_1, 'driver',    'available', TRUE),
    (u_p4_2_1, 'adi.zohar@idf.il',     'עדי',    'זהר',      '9000051', '0509000051', 'crew_commander',    p4, c4_2, 'commander', 'available', TRUE),
    (u_p4_2_2, 'shlomi.hazan@idf.il',  'שלומי',  'חזן',      '9000052', '0509000052', 'soldier',           p4, c4_2, 'gunner',    'available', TRUE),
    (u_p4_2_3, 'yoav.arbel@idf.il',    'יואב',   'ארבל',     '9000053', '0509000053', 'soldier',           p4, c4_2, 'loader',    'available', TRUE),
    (u_p4_2_4, 'eden.tzur@idf.il',     'עדן',    'צור',      '9000054', '0509000054', 'soldier',           p4, c4_2, 'driver',    'available', TRUE),
    (u_p4_3_1, 'shachar.amara@idf.il', 'שחר',    'עמארה',    '9000055', '0509000055', 'crew_commander',    p4, c4_3, 'commander', 'available', TRUE),
    (u_p4_3_2, 'keshet.reuven@idf.il', 'קשת',    'ראובן',    '9000056', '0509000056', 'soldier',           p4, c4_3, 'gunner',    'available', TRUE),
    (u_p4_3_3, 'ori.peretz@idf.il',    'אורי',   'פרץ',      '9000057', '0509000057', 'soldier',           p4, c4_3, 'loader',    'available', TRUE),
    (u_p4_3_4, 'gal.eliyahu@idf.il',   'גל',     'אליהו',    '9000058', '0509000058', 'soldier',           p4, c4_3, 'driver',    'available', TRUE);

  -- ================================================================
  -- שלב ה׳ — עדכון מפקדי הצוותים
  -- עושים אחרי INSERT של users כי יש FK מ-crews.commander_id → users.id
  -- ================================================================
  UPDATE public.crews SET commander_id = u_hq1_1 WHERE id = c_hq1;
  UPDATE public.crews SET commander_id = u_hq2_1 WHERE id = c_hq2;
  UPDATE public.crews SET commander_id = u_hq3_1 WHERE id = c_hq3;

  UPDATE public.crews SET commander_id = u_p1_mm  WHERE id = c1_1;
  UPDATE public.crews SET commander_id = u_p1_2_1 WHERE id = c1_2;
  UPDATE public.crews SET commander_id = u_p1_3_1 WHERE id = c1_3;

  UPDATE public.crews SET commander_id = u_p2_mm  WHERE id = c2_1;
  UPDATE public.crews SET commander_id = u_p2_2_1 WHERE id = c2_2;
  UPDATE public.crews SET commander_id = u_p2_3_1 WHERE id = c2_3;

  UPDATE public.crews SET commander_id = u_p3_mm  WHERE id = c3_1;
  UPDATE public.crews SET commander_id = u_p3_2_1 WHERE id = c3_2;
  UPDATE public.crews SET commander_id = u_p3_3_1 WHERE id = c3_3;

  UPDATE public.crews SET commander_id = u_p4_mm  WHERE id = c4_1;
  UPDATE public.crews SET commander_id = u_p4_2_1 WHERE id = c4_2;
  UPDATE public.crews SET commander_id = u_p4_3_1 WHERE id = c4_3;

  -- ================================================================
  -- שלב ו׳ — עדכון מפקדי המחלקות
  -- ================================================================
  UPDATE public.platoons SET commander_id = u_dep   WHERE id = p_hq;
  UPDATE public.platoons SET commander_id = u_p1_mm WHERE id = p1;
  UPDATE public.platoons SET commander_id = u_p2_mm WHERE id = p2;
  UPDATE public.platoons SET commander_id = u_p3_mm WHERE id = p3;
  UPDATE public.platoons SET commander_id = u_p4_mm WHERE id = p4;

  -- ================================================================
  -- שלב ז׳ — הוספה לרשימת הלבנה (whitelist)
  -- ON CONFLICT DO NOTHING — בטוח להריץ שוב אם המייל כבר קיים
  -- ================================================================
  INSERT INTO public.email_whitelist (email) VALUES
    ('david.levi@idf.il'),
    ('yossi.cohen@idf.il'),
    ('avi.shemesh@idf.il'),
    ('benny.golan@idf.il'),
    ('moshe.peretz@idf.il'),
    ('danny.biton@idf.il'),
    ('harel.sadoon@idf.il'),
    ('oren.levi@idf.il'),
    ('ziv.nachmias@idf.il'),
    ('chen.sagi@idf.il'),
    ('roee.shamir@idf.il'),
    ('amit.haim@idf.il'),
    ('pinhas.valensi@idf.il'),
    ('tsachi.maroko@idf.il'),
    ('kobi.dahan@idf.il'),
    ('reuven.sarah@idf.il'),
    ('shimon.ohana@idf.il'),
    ('tomer.elbaz@idf.il'),
    ('eli.ben-david@idf.il'),
    ('nachum.tayeb@idf.il'),
    ('michael.pinto@idf.il'),
    ('liran.azulay@idf.il'),
    ('noam.bar@idf.il'),
    ('yuval.mizrahi@idf.il'),
    ('idan.friedman@idf.il'),
    ('roi.toledano@idf.il'),
    ('guy.shapira@idf.il'),
    ('matan.cohen@idf.il'),
    ('omer.kaplan@idf.il'),
    ('bar.levy@idf.il'),
    ('alon.hakimi@idf.il'),
    ('tal.mor@idf.il'),
    ('nir.avraham@idf.il'),
    ('shay.zarfati@idf.il'),
    ('itay.berger@idf.il'),
    ('nimrod.cohen@idf.il'),
    ('liron.alfasi@idf.il'),
    ('eitan.yisrael@idf.il'),
    ('tamir.abu@idf.il'),
    ('barak.shilo@idf.il'),
    ('dan.gross@idf.il'),
    ('ariel.hadad@idf.il'),
    ('ofir.nissim@idf.il'),
    ('doron.gabay@idf.il'),
    ('shai.eldad@idf.il'),
    ('raz.peleg@idf.il'),
    ('yoni.klein@idf.il'),
    ('dean.shmuel@idf.il'),
    ('rani.halevi@idf.il'),
    ('yogev.mashiah@idf.il'),
    ('adi.zohar@idf.il'),
    ('shlomi.hazan@idf.il'),
    ('yoav.arbel@idf.il'),
    ('eden.tzur@idf.il'),
    ('shachar.amara@idf.il'),
    ('keshet.reuven@idf.il'),
    ('ori.peretz@idf.il'),
    ('gal.eliyahu@idf.il')
  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE '✅ Seed הושלם בהצלחה! 58 חיילים, 15 צוותים.';
END $$;
