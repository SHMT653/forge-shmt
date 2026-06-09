export type FoodItem = {
  name: string;
  kcal: number;
  proteinG: number;
  portionG: number;
  portionLabel: string;
};

export const FOOD_DATABASE: FoodItem[] = [
  // ── Pasta & Nudeln ──────────────────────────────────────────────
  { name: 'Nudeln mit Bolognese',         kcal: 520, proteinG: 28, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Pasta Carbonara',              kcal: 620, proteinG: 24, portionG: 380, portionLabel: '1 Portion' },
  { name: 'Spaghetti Aglio e Olio',       kcal: 480, proteinG: 12, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Penne Arrabiata',              kcal: 420, proteinG: 14, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Nudeln mit Tomatensauce',      kcal: 380, proteinG: 12, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Lasagne',                      kcal: 580, proteinG: 30, portionG: 400, portionLabel: '1 Stück' },
  { name: 'Mac and Cheese',               kcal: 550, proteinG: 20, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Nudeln mit Pesto',             kcal: 560, proteinG: 16, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Fusilli mit Gemüsesauce',      kcal: 360, proteinG: 13, portionG: 350, portionLabel: '1 Portion' },

  // ── Fleisch & Geflügel ──────────────────────────────────────────
  { name: 'Hähnchenbrust gegrillt',       kcal: 165, proteinG: 31, portionG: 150, portionLabel: '150 g' },
  { name: 'Hähnchenkeule gebacken',       kcal: 280, proteinG: 26, portionG: 200, portionLabel: '200 g' },
  { name: 'Schweinefilet gebraten',       kcal: 220, proteinG: 30, portionG: 180, portionLabel: '180 g' },
  { name: 'Rindersteaks (Rumpsteak)',      kcal: 300, proteinG: 34, portionG: 200, portionLabel: '200 g' },
  { name: 'Hackfleisch (gemischt)',        kcal: 250, proteinG: 22, portionG: 150, portionLabel: '150 g' },
  { name: 'Würstchen (Bratwurst)',         kcal: 320, proteinG: 14, portionG: 150, portionLabel: '2 Stück' },
  { name: 'Schnitzel paniert',            kcal: 420, proteinG: 30, portionG: 200, portionLabel: '1 Stück' },
  { name: 'Putenbrust gebraten',          kcal: 175, proteinG: 33, portionG: 150, portionLabel: '150 g' },
  { name: 'Gyros mit Tzatziki',           kcal: 480, proteinG: 32, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Döner Kebab',                  kcal: 580, proteinG: 30, portionG: 350, portionLabel: '1 Stück' },
  { name: 'Cheeseburger',                 kcal: 490, proteinG: 25, portionG: 200, portionLabel: '1 Stück' },
  { name: 'Hamburger',                    kcal: 420, proteinG: 22, portionG: 180, portionLabel: '1 Stück' },
  { name: 'Chicken Nuggets (10 Stück)',   kcal: 460, proteinG: 25, portionG: 200, portionLabel: '10 Stück' },

  // ── Fisch & Meeresfrüchte ────────────────────────────────────────
  { name: 'Lachs gebraten',               kcal: 280, proteinG: 30, portionG: 180, portionLabel: '180 g' },
  { name: 'Thunfisch (Dose)',              kcal: 130, proteinG: 28, portionG: 120, portionLabel: '1 Dose' },
  { name: 'Kabeljau gedünstet',           kcal: 160, proteinG: 30, portionG: 180, portionLabel: '180 g' },
  { name: 'Shrimps gebraten',             kcal: 140, proteinG: 26, portionG: 150, portionLabel: '150 g' },
  { name: 'Fischstäbchen (5 Stück)',      kcal: 350, proteinG: 18, portionG: 200, portionLabel: '5 Stück' },
  { name: 'Forelle gebacken',             kcal: 220, proteinG: 28, portionG: 180, portionLabel: '180 g' },

  // ── Reis & Getreide ──────────────────────────────────────────────
  { name: 'Reis gekocht (Basmati)',        kcal: 360, proteinG: 7,  portionG: 200, portionLabel: '200 g' },
  { name: 'Fried Rice mit Ei',            kcal: 480, proteinG: 14, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Risotto',                      kcal: 420, proteinG: 12, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Quinoa gekocht',               kcal: 220, proteinG: 8,  portionG: 185, portionLabel: '185 g' },
  { name: 'Couscous mit Gemüse',          kcal: 300, proteinG: 9,  portionG: 250, portionLabel: '250 g' },
  { name: 'Haferbrei (Overnight Oats)',   kcal: 310, proteinG: 10, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Müsli mit Milch',              kcal: 380, proteinG: 12, portionG: 300, portionLabel: '1 Schüssel' },
  { name: 'Granola mit Joghurt',          kcal: 350, proteinG: 14, portionG: 250, portionLabel: '1 Portion' },

  // ── Kartoffeln ───────────────────────────────────────────────────
  { name: 'Kartoffeln gekocht',           kcal: 160, proteinG: 3,  portionG: 200, portionLabel: '200 g' },
  { name: 'Bratkartoffeln',               kcal: 280, proteinG: 4,  portionG: 200, portionLabel: '200 g' },
  { name: 'Pommes Frites',                kcal: 400, proteinG: 5,  portionG: 200, portionLabel: '1 Portion' },
  { name: 'Kartoffelbrei',                kcal: 220, proteinG: 4,  portionG: 250, portionLabel: '250 g' },
  { name: 'Backkartoffel mit Quark',      kcal: 280, proteinG: 12, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Kartoffelsuppe',               kcal: 240, proteinG: 6,  portionG: 350, portionLabel: '1 Teller' },

  // ── Salate & Gemüse ──────────────────────────────────────────────
  { name: 'Gemischter Salat',             kcal: 80,  proteinG: 3,  portionG: 200, portionLabel: '1 Teller' },
  { name: 'Caeser Salad',                 kcal: 280, proteinG: 12, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Griechischer Salat',           kcal: 220, proteinG: 8,  portionG: 300, portionLabel: '1 Portion' },
  { name: 'Brokkoli gedämpft',            kcal: 55,  proteinG: 4,  portionG: 200, portionLabel: '200 g' },
  { name: 'Spinat gedünstet',             kcal: 40,  proteinG: 4,  portionG: 180, portionLabel: '180 g' },
  { name: 'Ratatouille',                  kcal: 130, proteinG: 4,  portionG: 300, portionLabel: '1 Portion' },
  { name: 'Gemüsecurry',                  kcal: 280, proteinG: 8,  portionG: 350, portionLabel: '1 Portion' },

  // ── Suppen & Eintöpfe ────────────────────────────────────────────
  { name: 'Tomatensuppe',                 kcal: 160, proteinG: 4,  portionG: 350, portionLabel: '1 Teller' },
  { name: 'Hühnersuppe',                  kcal: 180, proteinG: 14, portionG: 350, portionLabel: '1 Teller' },
  { name: 'Linsensuppe',                  kcal: 260, proteinG: 14, portionG: 350, portionLabel: '1 Teller' },
  { name: 'Erbsensuppe mit Speck',        kcal: 320, proteinG: 18, portionG: 350, portionLabel: '1 Teller' },
  { name: 'Gulasch',                      kcal: 480, proteinG: 36, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Chili con Carne',              kcal: 420, proteinG: 28, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Kürbissuppe',                  kcal: 140, proteinG: 3,  portionG: 350, portionLabel: '1 Teller' },

  // ── Eier & Milchprodukte ─────────────────────────────────────────
  { name: 'Spiegelei (2 Stück)',          kcal: 180, proteinG: 12, portionG: 100, portionLabel: '2 Stück' },
  { name: 'Rührei (3 Eier)',              kcal: 260, proteinG: 18, portionG: 150, portionLabel: '1 Portion' },
  { name: 'Gekochtes Ei',                 kcal: 77,  proteinG: 6,  portionG: 60,  portionLabel: '1 Ei' },
  { name: 'Omelette mit Käse',            kcal: 320, proteinG: 22, portionG: 200, portionLabel: '1 Portion' },
  { name: 'Magerquark (250 g)',           kcal: 100, proteinG: 22, portionG: 250, portionLabel: '250 g' },
  { name: 'Griechischer Joghurt (200 g)', kcal: 140, proteinG: 18, portionG: 200, portionLabel: '200 g' },
  { name: 'Hüttenkäse',                   kcal: 100, proteinG: 12, portionG: 150, portionLabel: '150 g' },
  { name: 'Skyr natur (200 g)',           kcal: 130, proteinG: 20, portionG: 200, portionLabel: '200 g' },

  // ── Brot & Brötchen ──────────────────────────────────────────────
  { name: 'Vollkornbrot mit Käse',        kcal: 280, proteinG: 14, portionG: 120, portionLabel: '2 Scheiben' },
  { name: 'Brot mit Butter',              kcal: 200, proteinG: 5,  portionG: 80,  portionLabel: '2 Scheiben' },
  { name: 'Brötchen mit Wurst',           kcal: 320, proteinG: 14, portionLabel: '1 Brötchen', portionG: 130 },
  { name: 'Toast Hawaii',                 kcal: 380, proteinG: 18, portionG: 160, portionLabel: '1 Portion' },
  { name: 'Bagel mit Lachs & Frischkäse',kcal: 420, proteinG: 20, portionG: 200, portionLabel: '1 Stück' },
  { name: 'Avocado Toast',                kcal: 350, proteinG: 10, portionG: 180, portionLabel: '1 Portion' },

  // ── Asiatisch ────────────────────────────────────────────────────
  { name: 'Sushi (10 Stück)',             kcal: 350, proteinG: 18, portionG: 250, portionLabel: '10 Stück' },
  { name: 'Ramen',                        kcal: 480, proteinG: 22, portionG: 500, portionLabel: '1 Portion' },
  { name: 'Pad Thai',                     kcal: 520, proteinG: 20, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Fried Chicken (asiatisch)',    kcal: 380, proteinG: 26, portionG: 200, portionLabel: '1 Portion' },
  { name: 'Dim Sum (6 Stück)',            kcal: 320, proteinG: 14, portionG: 200, portionLabel: '6 Stück' },
  { name: 'Miso Suppe',                   kcal: 80,  proteinG: 5,  portionG: 250, portionLabel: '1 Schüssel' },
  { name: 'Edamame (100 g)',              kcal: 120, proteinG: 11, portionG: 100, portionLabel: '100 g' },
  { name: 'Chicken Teriyaki mit Reis',    kcal: 540, proteinG: 32, portionG: 400, portionLabel: '1 Portion' },

  // ── Pizza ────────────────────────────────────────────────────────
  { name: 'Pizza Margherita',             kcal: 560, proteinG: 22, portionG: 300, portionLabel: '2 Stücke' },
  { name: 'Pizza Salami',                 kcal: 640, proteinG: 26, portionG: 300, portionLabel: '2 Stücke' },
  { name: 'Pizza Hawaii',                 kcal: 600, proteinG: 24, portionG: 300, portionLabel: '2 Stücke' },
  { name: 'Pizza Tonno',                  kcal: 580, proteinG: 28, portionG: 300, portionLabel: '2 Stücke' },

  // ── Frühstück ────────────────────────────────────────────────────
  { name: 'Pancakes (3 Stück)',           kcal: 360, proteinG: 10, portionG: 180, portionLabel: '3 Stück' },
  { name: 'French Toast',                 kcal: 380, proteinG: 12, portionG: 180, portionLabel: '2 Scheiben' },
  { name: 'Acai Bowl',                    kcal: 300, proteinG: 8,  portionG: 250, portionLabel: '1 Schüssel' },
  { name: 'Smoothie Bowl',                kcal: 350, proteinG: 10, portionG: 300, portionLabel: '1 Schüssel' },

  // ── Proteinreich ─────────────────────────────────────────────────
  { name: 'Protein Shake (1 Scoop)',      kcal: 130, proteinG: 25, portionG: 300, portionLabel: '1 Shake' },
  { name: 'Protein Shake (2 Scoops)',     kcal: 260, proteinG: 50, portionG: 500, portionLabel: '1 Shake' },
  { name: 'Protein Riegel',               kcal: 200, proteinG: 20, portionG: 60,  portionLabel: '1 Riegel' },
  { name: 'Hähnchen Bowl (High Protein)', kcal: 520, proteinG: 48, portionG: 450, portionLabel: '1 Bowl' },
  { name: 'Thunfisch Reis Bowl',          kcal: 420, proteinG: 38, portionG: 400, portionLabel: '1 Bowl' },
  { name: 'Linsen Dal',                   kcal: 360, proteinG: 20, portionG: 400, portionLabel: '1 Portion' },

  // ── Snacks & Kleinigkeiten ───────────────────────────────────────
  { name: 'Nüsse gemischt (50 g)',        kcal: 310, proteinG: 9,  portionG: 50,  portionLabel: '50 g' },
  { name: 'Mandeln (30 g)',               kcal: 185, proteinG: 6,  portionG: 30,  portionLabel: '30 g' },
  { name: 'Cashews (30 g)',               kcal: 180, proteinG: 5,  portionG: 30,  portionLabel: '30 g' },
  { name: 'Naturjoghurt mit Beeren',      kcal: 160, proteinG: 8,  portionG: 250, portionLabel: '1 Portion' },
  { name: 'Apfel',                        kcal: 80,  proteinG: 0,  portionG: 150, portionLabel: '1 Stück' },
  { name: 'Banane',                       kcal: 100, proteinG: 1,  portionG: 120, portionLabel: '1 Stück' },
  { name: 'Schokolade (1 Riegel 50 g)',   kcal: 270, proteinG: 4,  portionG: 50,  portionLabel: '50 g' },
  { name: 'Erdnussbutter (2 EL)',         kcal: 190, proteinG: 7,  portionG: 32,  portionLabel: '2 EL' },
  { name: 'Hummus mit Gemüse',            kcal: 180, proteinG: 6,  portionG: 150, portionLabel: '1 Portion' },

  // ── Getränke (kalorienhaltig) ────────────────────────────────────
  { name: 'Orangensaft (250 ml)',         kcal: 110, proteinG: 1,  portionG: 250, portionLabel: '250 ml' },
  { name: 'Milch (250 ml, 3,5%)',         kcal: 160, proteinG: 8,  portionG: 250, portionLabel: '250 ml' },
  { name: 'Latte Macchiato',              kcal: 140, proteinG: 6,  portionG: 350, portionLabel: '1 Glas' },
  { name: 'Cappuccino',                   kcal: 90,  proteinG: 5,  portionG: 150, portionLabel: '1 Tasse' },

  // ── Indisch ──────────────────────────────────────────────────────
  { name: 'Chicken Tikka Masala',         kcal: 480, proteinG: 34, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Butter Chicken',               kcal: 520, proteinG: 32, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Saag Paneer',                  kcal: 380, proteinG: 16, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Naan Brot',                    kcal: 260, proteinG: 7,  portionG: 100, portionLabel: '1 Stück' },
];

export function searchFood(query: string): FoodItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return FOOD_DATABASE
    .filter((f) => f.name.toLowerCase().includes(needle))
    .slice(0, 10);
}
