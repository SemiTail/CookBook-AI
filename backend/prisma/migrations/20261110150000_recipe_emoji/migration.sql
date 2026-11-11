ALTER TABLE "Recipe" ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '🍽️';

UPDATE "Recipe" SET "emoji" = CASE "id"
  WHEN 'demo-omelet' THEN '🍳'
  WHEN 'demo-buckwheat-mushrooms' THEN '🍄'
  WHEN 'demo-salad' THEN '🥗'
  WHEN 'demo-potato-soup' THEN '🥔'
  WHEN 'demo-pasta' THEN '🍝'
  WHEN 'demo-lentils' THEN '🫘'
  WHEN 'demo-chicken-rice' THEN '🍗'
  WHEN 'demo-pumpkin-stew' THEN '🎃'
  WHEN 'demo-cottage-banana' THEN '🍌'
  WHEN 'demo-pea-soup' THEN '🍲'
  ELSE "emoji" END;
