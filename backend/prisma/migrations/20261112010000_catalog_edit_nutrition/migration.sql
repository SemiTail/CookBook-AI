ALTER TABLE Ingredient ADD COLUMN gramsPerUnit REAL;
ALTER TABLE Ingredient ADD COLUMN densityGramsPerMl REAL;
ALTER TABLE Recipe ADD COLUMN nutritionAuto BOOLEAN NOT NULL DEFAULT false;
UPDATE Recipe SET nutritionAuto=true;
