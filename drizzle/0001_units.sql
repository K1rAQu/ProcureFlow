CREATE TABLE IF NOT EXISTS units_of_measurement (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name_ru VARCHAR(160) NOT NULL,
  name_uk VARCHAR(160) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO units_of_measurement (code, name_ru, name_uk, description, sort_order)
VALUES
  ('pcs', 'шт', 'шт', 'Штуки', 10),
  ('m', 'м', 'м', 'Метри погонні', 20),
  ('kg', 'кг', 'кг', 'Кілограми', 30),
  ('l', 'л', 'л', 'Літри', 40),
  ('set', 'компл', 'компл', 'Комплекти', 50),
  ('pack', 'пач', 'пач', 'Пачки', 60),
  ('t', 'т', 'т', 'Тонни', 70),
  ('roll', 'рул', 'рул', 'Рулони', 80),
  ('m2', 'м²', 'м²', 'Квадратні метри', 90),
  ('m3', 'м³', 'м³', 'Кубічні метри', 100),
  ('box', 'ящ', 'ящ', 'Ящики / коробки', 110)
ON CONFLICT (code) DO NOTHING;
