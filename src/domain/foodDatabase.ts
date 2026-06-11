export type FoodItem = {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  portionG: number;
  portionLabel: string;
};

/** Estimate carbs/fat from kcal and protein if not explicitly provided */
export function estimateMacros(item: FoodItem): { carbsG: number; fatG: number } {
  if (item.carbsG !== undefined && item.fatG !== undefined) {
    return { carbsG: item.carbsG, fatG: item.fatG };
  }
  const remaining = Math.max(0, item.kcal - item.proteinG * 4);
  return {
    carbsG: Math.round((remaining * 0.62) / 4),
    fatG:   Math.round((remaining * 0.38) / 9),
  };
}

export const FOOD_DATABASE: FoodItem[] = [
  // ── Pasta & Nudeln ──────────────────────────────────────────────
  { name: 'Nudeln mit Bolognese',         kcal: 520, proteinG: 28, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Pasta Carbonara',              kcal: 820, proteinG: 32, portionG: 380, portionLabel: '1 Teller' },
  { name: 'Spaghetti Aglio e Olio',       kcal: 480, proteinG: 12, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Penne Arrabiata',              kcal: 420, proteinG: 14, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Nudeln mit Tomatensauce',      kcal: 380, proteinG: 12, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Lasagne',                      kcal: 700, proteinG: 35, portionG: 400, portionLabel: '1 Portion' },
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
  { name: 'Döner Kebab',                  kcal: 700, proteinG: 35, portionG: 400, portionLabel: '1 Stück' },
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

  // ── Indisch ──────────────────────────────────────────────────────
  { name: 'Chicken Tikka Masala',         kcal: 480, proteinG: 34, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Butter Chicken',               kcal: 520, proteinG: 32, portionG: 400, portionLabel: '1 Portion' },
  { name: 'Saag Paneer',                  kcal: 380, proteinG: 16, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Naan Brot',                    kcal: 260, proteinG: 7,  portionG: 100, portionLabel: '1 Stück' },
  { name: 'Dal Makhani',                  kcal: 340, proteinG: 14, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Samosa (2 Stück)',             kcal: 270, proteinG: 6,  portionG: 120, portionLabel: '2 Stück' },

  // ── Mexikanisch ──────────────────────────────────────────────────
  { name: 'Burrito (Hähnchen)',           kcal: 560, proteinG: 34, portionG: 350, portionLabel: '1 Stück' },
  { name: 'Tacos (2 Stück)',              kcal: 380, proteinG: 22, portionG: 200, portionLabel: '2 Stück' },
  { name: 'Quesadilla (Käse & Hähnchen)',kcal: 480, proteinG: 28, portionG: 280, portionLabel: '1 Stück' },
  { name: 'Nachos mit Käse & Guacamole', kcal: 540, proteinG: 10, portionG: 200, portionLabel: '1 Portion' },
  { name: 'Guacamole (100 g)',            kcal: 160, proteinG: 2,  portionG: 100, portionLabel: '100 g' },
  { name: 'Enchiladas (2 Stück)',         kcal: 480, proteinG: 26, portionG: 300, portionLabel: '2 Stück' },

  // ── Mediterran & Naher Osten ─────────────────────────────────────
  { name: 'Falafel (4 Stück)',            kcal: 280, proteinG: 10, portionG: 160, portionLabel: '4 Stück' },
  { name: 'Shakshuka',                    kcal: 280, proteinG: 16, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Kebab Teller (Gemüse & Reis)', kcal: 520, proteinG: 30, portionG: 450, portionLabel: '1 Teller' },
  { name: 'Taboulé (200 g)',              kcal: 180, proteinG: 5,  portionG: 200, portionLabel: '200 g' },
  { name: 'Dolma (6 Stück)',              kcal: 220, proteinG: 6,  portionG: 180, portionLabel: '6 Stück' },
  { name: 'Pita mit Falafel',             kcal: 460, proteinG: 15, portionG: 300, portionLabel: '1 Stück' },

  // ── Deutsche Klassiker ───────────────────────────────────────────
  { name: 'Currywurst mit Pommes',        kcal: 900, proteinG: 25, portionG: 450, portionLabel: '1 Portion' },
  { name: 'Schnitzel mit Pommes',         kcal: 1100, proteinG: 45, portionG: 600, portionLabel: '1 Portion' },
  { name: 'Sauerbraten mit Klößen',       kcal: 620, proteinG: 36, portionG: 450, portionLabel: '1 Portion' },
  { name: 'Maultaschen mit Brühe',        kcal: 420, proteinG: 20, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Reibekuchen (3 Stück)',        kcal: 380, proteinG: 6,  portionG: 180, portionLabel: '3 Stück' },
  { name: 'Sauerkraut (150 g)',           kcal: 35,  proteinG: 2,  portionG: 150, portionLabel: '150 g' },
  { name: 'Kassler mit Sauerkraut',       kcal: 480, proteinG: 34, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Flammkuchen',                  kcal: 560, proteinG: 16, portionG: 320, portionLabel: '1 Stück' },

  // ── Sandwiches & Wraps ───────────────────────────────────────────
  { name: 'Club Sandwich',                kcal: 540, proteinG: 30, portionG: 300, portionLabel: '1 Stück' },
  { name: 'BLT Sandwich',                 kcal: 420, proteinG: 22, portionG: 220, portionLabel: '1 Stück' },
  { name: 'Wrap (Hähnchen & Gemüse)',     kcal: 440, proteinG: 28, portionG: 280, portionLabel: '1 Stück' },
  { name: 'Wrap (Thunfisch)',             kcal: 380, proteinG: 26, portionG: 250, portionLabel: '1 Stück' },
  { name: 'Bruschetta (2 Scheiben)',      kcal: 220, proteinG: 6,  portionG: 120, portionLabel: '2 Scheiben' },
  { name: 'Panini (Käse & Tomate)',       kcal: 380, proteinG: 16, portionG: 200, portionLabel: '1 Stück' },

  // ── Bäckerei & Süßes ────────────────────────────────────────────
  { name: 'Croissant',                    kcal: 240, proteinG: 5,  portionG: 75,  portionLabel: '1 Stück' },
  { name: 'Muffin (Blueberry)',           kcal: 340, proteinG: 5,  portionG: 120, portionLabel: '1 Stück' },
  { name: 'Donut',                        kcal: 280, proteinG: 4,  portionG: 75,  portionLabel: '1 Stück' },
  { name: 'Brezel',                       kcal: 220, proteinG: 7,  portionG: 80,  portionLabel: '1 Stück' },
  { name: 'Zimtschnecke',                 kcal: 380, proteinG: 6,  portionG: 130, portionLabel: '1 Stück' },
  { name: 'Waffel (2 Stück)',             kcal: 320, proteinG: 7,  portionG: 120, portionLabel: '2 Stück' },

  // ── Desserts ─────────────────────────────────────────────────────
  { name: 'Eis (1 Kugel)',                kcal: 110, proteinG: 2,  portionG: 80,  portionLabel: '1 Kugel' },
  { name: 'Eis (2 Kugeln)',               kcal: 220, proteinG: 4,  portionG: 160, portionLabel: '2 Kugeln' },
  { name: 'Cheesecake',                   kcal: 420, proteinG: 7,  portionG: 150, portionLabel: '1 Stück' },
  { name: 'Tiramisu',                     kcal: 380, proteinG: 6,  portionG: 150, portionLabel: '1 Portion' },
  { name: 'Apfelkuchen',                  kcal: 320, proteinG: 4,  portionG: 120, portionLabel: '1 Stück' },
  { name: 'Mousse au Chocolat',           kcal: 280, proteinG: 5,  portionG: 100, portionLabel: '1 Portion' },
  { name: 'Pudding (Vanille)',            kcal: 160, proteinG: 4,  portionG: 150, portionLabel: '1 Portion' },

  // ── Weitere Salate & Bowl-Optionen ───────────────────────────────
  { name: 'Buddha Bowl',                  kcal: 460, proteinG: 18, portionG: 400, portionLabel: '1 Bowl' },
  { name: 'Quinoa Salat',                 kcal: 280, proteinG: 10, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Poke Bowl (Lachs)',            kcal: 480, proteinG: 30, portionG: 400, portionLabel: '1 Bowl' },
  { name: 'Wrap Bowl (Hähnchen)',         kcal: 420, proteinG: 34, portionG: 380, portionLabel: '1 Bowl' },
  { name: 'Avocado Salat',                kcal: 240, proteinG: 5,  portionG: 250, portionLabel: '1 Portion' },

  // ── Getränke · Kaffee & Tee ─────────────────────────────────────
  { name: 'Wasser (250 ml)',              kcal: 0,   proteinG: 0,  carbsG: 0, fatG: 0, portionG: 250, portionLabel: '250 ml' },
  { name: 'Mineralwasser (500 ml)',       kcal: 0,   proteinG: 0,  carbsG: 0, fatG: 0, portionG: 500, portionLabel: '500 ml' },
  { name: 'Kaffee schwarz',              kcal: 2,   proteinG: 0,  carbsG: 0, fatG: 0, portionG: 200, portionLabel: '1 Tasse' },
  { name: 'Kaffee mit Milch',            kcal: 35,  proteinG: 2,  carbsG: 3, fatG: 1, portionG: 250, portionLabel: '1 Tasse' },
  { name: 'Espresso',                    kcal: 5,   proteinG: 0,  carbsG: 1, fatG: 0, portionG: 30,  portionLabel: '1 Tasse' },
  { name: 'Americano',                   kcal: 10,  proteinG: 0,  carbsG: 1, fatG: 0, portionG: 200, portionLabel: '1 Tasse' },
  { name: 'Latte Macchiato',             kcal: 140, proteinG: 6,  carbsG: 14, fatG: 5, portionG: 350, portionLabel: '1 Glas' },
  { name: 'Cappuccino',                  kcal: 90,  proteinG: 5,  carbsG: 8,  fatG: 3, portionG: 150, portionLabel: '1 Tasse' },
  { name: 'Flat White',                  kcal: 120, proteinG: 6,  carbsG: 10, fatG: 5, portionG: 200, portionLabel: '1 Tasse' },
  { name: 'Oat Milk Latte',              kcal: 170, proteinG: 4,  carbsG: 22, fatG: 5, portionG: 350, portionLabel: '1 Glas' },
  { name: 'Tee schwarz / grün',          kcal: 0,   proteinG: 0,  carbsG: 0, fatG: 0, portionG: 250, portionLabel: '1 Tasse' },
  { name: 'Pfefferminztee',              kcal: 0,   proteinG: 0,  carbsG: 0, fatG: 0, portionG: 250, portionLabel: '1 Tasse' },
  { name: 'Eistee (500 ml)',             kcal: 150, proteinG: 0,  carbsG: 36, fatG: 0, portionG: 500, portionLabel: '500 ml' },

  // ── Getränke · Softdrinks & Säfte ───────────────────────────────
  { name: 'Cola (330 ml)',               kcal: 139, proteinG: 0,  carbsG: 35, fatG: 0, portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Cola (500 ml)',               kcal: 210, proteinG: 0,  carbsG: 53, fatG: 0, portionG: 500, portionLabel: '500 ml Flasche' },
  { name: 'Cola Zero (330 ml)',          kcal: 1,   proteinG: 0,  carbsG: 0,  fatG: 0, portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Fanta Orange (330 ml)',       kcal: 148, proteinG: 0,  carbsG: 37, fatG: 0, portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Sprite (330 ml)',             kcal: 139, proteinG: 0,  carbsG: 35, fatG: 0, portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Red Bull (250 ml)',           kcal: 113, proteinG: 1,  carbsG: 28, fatG: 0, portionG: 250, portionLabel: '250 ml Dose' },
  { name: 'Monster Energy (500 ml)',     kcal: 226, proteinG: 0,  carbsG: 55, fatG: 0, portionG: 500, portionLabel: '500 ml Dose' },
  { name: 'Orangensaft (250 ml)',        kcal: 110, proteinG: 1,  carbsG: 26, fatG: 0, portionG: 250, portionLabel: '250 ml' },
  { name: 'Apfelsaft (250 ml)',          kcal: 115, proteinG: 0,  carbsG: 28, fatG: 0, portionG: 250, portionLabel: '250 ml' },
  { name: 'Traubensaft (250 ml)',        kcal: 170, proteinG: 1,  carbsG: 41, fatG: 0, portionG: 250, portionLabel: '250 ml' },
  { name: 'Smoothie Mango-Banane',       kcal: 180, proteinG: 2,  carbsG: 42, fatG: 1, portionG: 300, portionLabel: '300 ml' },
  { name: 'Grüner Smoothie',             kcal: 100, proteinG: 3,  carbsG: 20, fatG: 1, portionG: 300, portionLabel: '300 ml' },
  { name: 'Iso-Drink (500 ml)',          kcal: 135, proteinG: 0,  carbsG: 34, fatG: 0, portionG: 500, portionLabel: '500 ml' },
  { name: 'Coconut Water (330 ml)',      kcal: 62,  proteinG: 1,  carbsG: 15, fatG: 0, portionG: 330, portionLabel: '330 ml' },
  { name: 'Kombucha (330 ml)',           kcal: 40,  proteinG: 0,  carbsG: 9,  fatG: 0, portionG: 330, portionLabel: '330 ml' },

  // ── Getränke · Milch & Alternativen ─────────────────────────────
  { name: 'Milch 3,5% (250 ml)',         kcal: 160, proteinG: 8,  carbsG: 12, fatG: 8, portionG: 250, portionLabel: '250 ml' },
  { name: 'Milch 1,5% (250 ml)',         kcal: 105, proteinG: 8,  carbsG: 12, fatG: 4, portionG: 250, portionLabel: '250 ml' },
  { name: 'Hafermilch (250 ml)',         kcal: 125, proteinG: 3,  carbsG: 20, fatG: 4, portionG: 250, portionLabel: '250 ml' },
  { name: 'Sojamilch (250 ml)',          kcal: 100, proteinG: 7,  carbsG: 7,  fatG: 4, portionG: 250, portionLabel: '250 ml' },
  { name: 'Mandelmilch (250 ml)',        kcal: 40,  proteinG: 1,  carbsG: 3,  fatG: 3, portionG: 250, portionLabel: '250 ml' },

  // ── Getränke · Alkohol ───────────────────────────────────────────
  { name: 'Bier (330 ml)',               kcal: 154, proteinG: 1,  carbsG: 13, fatG: 0, portionG: 330, portionLabel: '330 ml' },
  { name: 'Bier (500 ml)',               kcal: 234, proteinG: 2,  carbsG: 20, fatG: 0, portionG: 500, portionLabel: '500 ml' },
  { name: 'Weißbier (500 ml)',           kcal: 250, proteinG: 3,  carbsG: 24, fatG: 0, portionG: 500, portionLabel: '500 ml' },
  { name: 'Alkoholfreies Bier (330 ml)', kcal: 80,  proteinG: 1,  carbsG: 16, fatG: 0, portionG: 330, portionLabel: '330 ml' },
  { name: 'Weißwein (150 ml)',           kcal: 105, proteinG: 0,  carbsG: 3,  fatG: 0, portionG: 150, portionLabel: '150 ml' },
  { name: 'Rotwein (150 ml)',            kcal: 128, proteinG: 0,  carbsG: 4,  fatG: 0, portionG: 150, portionLabel: '150 ml' },
  { name: 'Sekt / Prosecco (150 ml)',    kcal: 110, proteinG: 0,  carbsG: 5,  fatG: 0, portionG: 150, portionLabel: '150 ml' },
  { name: 'Wodka (40 ml)',               kcal: 96,  proteinG: 0,  carbsG: 0,  fatG: 0, portionG: 40,  portionLabel: '40 ml' },
  { name: 'Whisky (40 ml)',              kcal: 96,  proteinG: 0,  carbsG: 0,  fatG: 0, portionG: 40,  portionLabel: '40 ml' },
  { name: 'Rum & Cola (200 ml)',         kcal: 165, proteinG: 0,  carbsG: 18, fatG: 0, portionG: 200, portionLabel: '200 ml' },
  { name: 'Gin Tonic (200 ml)',          kcal: 143, proteinG: 0,  carbsG: 14, fatG: 0, portionG: 200, portionLabel: '200 ml' },
  { name: 'Aperol Spritz (200 ml)',      kcal: 120, proteinG: 0,  carbsG: 13, fatG: 0, portionG: 200, portionLabel: '200 ml' },
  { name: 'Hugo (200 ml)',               kcal: 110, proteinG: 0,  carbsG: 14, fatG: 0, portionG: 200, portionLabel: '200 ml' },
  { name: 'Pils (500 ml)',               kcal: 215, proteinG: 2,  carbsG: 17, fatG: 0, portionG: 500, portionLabel: '500 ml' },

  // ── Fast Food ────────────────────────────────────────────────────
  { name: 'Big Mac',                     kcal: 500, proteinG: 26, carbsG: 44, fatG: 26, portionG: 214, portionLabel: '1 Stück' },
  { name: 'McDonald\'s Cheeseburger',   kcal: 300, proteinG: 15, carbsG: 32, fatG: 12, portionG: 114, portionLabel: '1 Stück' },
  { name: 'McDonald\'s Double Cheeseburger', kcal: 450, proteinG: 26, carbsG: 34, fatG: 22, portionG: 166, portionLabel: '1 Stück' },
  { name: 'McDonald\'s Hamburger',      kcal: 250, proteinG: 13, carbsG: 30, fatG: 9,  portionG: 100, portionLabel: '1 Stück' },
  { name: 'McChicken',                  kcal: 480, proteinG: 22, carbsG: 46, fatG: 22, portionG: 175, portionLabel: '1 Stück' },
  { name: 'Whopper',                    kcal: 657, proteinG: 28, carbsG: 49, fatG: 40, portionG: 290, portionLabel: '1 Stück' },
  { name: 'McFlurry Oreo',              kcal: 510, proteinG: 10, carbsG: 76, fatG: 17, portionG: 300, portionLabel: '1 Becher' },
  { name: 'Pommes groß (McDonald\'s)',  kcal: 440, proteinG: 5,  carbsG: 56, fatG: 22, portionG: 154, portionLabel: '1 Portion groß' },
  { name: 'Pommes mittel (McDonald\'s)',kcal: 337, proteinG: 4,  carbsG: 43, fatG: 17, portionG: 117, portionLabel: '1 Portion mittel' },
  { name: 'Chicken McNuggets (9 St.)',  kcal: 390, proteinG: 23, carbsG: 24, fatG: 22, portionG: 162, portionLabel: '9 Stück' },
  { name: 'Döner im Fladenbrot',        kcal: 700, proteinG: 35, carbsG: 58, fatG: 26, portionG: 420, portionLabel: '1 Stück' },
  { name: 'Döner im Dürüm',            kcal: 640, proteinG: 32, carbsG: 52, fatG: 22, portionG: 390, portionLabel: '1 Stück' },
  { name: 'Lahmacun',                   kcal: 380, proteinG: 18, carbsG: 42, fatG: 14, portionG: 280, portionLabel: '1 Stück' },
  { name: 'Pommes Currywurst',          kcal: 720, proteinG: 26, carbsG: 68, fatG: 36, portionG: 450, portionLabel: '1 Portion' },

  // ── Koreanisch ───────────────────────────────────────────────────
  { name: 'Bibimbap',                    kcal: 490, proteinG: 26, carbsG: 62, fatG: 14, portionG: 450, portionLabel: '1 Bowl' },
  { name: 'Korean BBQ (Bulgogi)',        kcal: 420, proteinG: 34, carbsG: 18, fatG: 22, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Kimchi (100 g)',              kcal: 30,  proteinG: 2,  carbsG: 5,  fatG: 0,  portionG: 100, portionLabel: '100 g' },
  { name: 'Tteokbokki',                  kcal: 380, proteinG: 10, carbsG: 70, fatG: 7,  portionG: 300, portionLabel: '1 Portion' },
  { name: 'Korean Fried Chicken (200 g)',kcal: 540, proteinG: 34, carbsG: 32, fatG: 30, portionG: 200, portionLabel: '200 g' },

  // ── Vietnamesisch ────────────────────────────────────────────────
  { name: 'Pho Bo (Rindfleisch)',        kcal: 420, proteinG: 30, carbsG: 48, fatG: 10, portionG: 600, portionLabel: '1 Schüssel' },
  { name: 'Pho Ga (Hähnchen)',           kcal: 380, proteinG: 28, carbsG: 44, fatG: 8,  portionG: 600, portionLabel: '1 Schüssel' },
  { name: 'Bánh Mì (Hähnchen)',         kcal: 440, proteinG: 24, carbsG: 54, fatG: 14, portionG: 280, portionLabel: '1 Sandwich' },
  { name: 'Frühlingsrollen (3 Stück)',   kcal: 280, proteinG: 10, carbsG: 30, fatG: 14, portionG: 180, portionLabel: '3 Stück' },
  { name: 'Bun Bo (Reisnudeln)',         kcal: 460, proteinG: 26, carbsG: 58, fatG: 12, portionG: 500, portionLabel: '1 Schüssel' },

  // ── Türkisch ─────────────────────────────────────────────────────
  { name: 'Iskender Kebab',              kcal: 580, proteinG: 36, carbsG: 40, fatG: 28, portionG: 380, portionLabel: '1 Portion' },
  { name: 'Adana Kebab',                 kcal: 480, proteinG: 40, carbsG: 12, fatG: 30, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Türkische Pizza (Lahmacun)', kcal: 420, proteinG: 20, carbsG: 46, fatG: 16, portionG: 300, portionLabel: '1 Stück' },
  { name: 'Köfte (4 Stück)',             kcal: 360, proteinG: 28, carbsG: 8,  fatG: 24, portionG: 200, portionLabel: '4 Stück' },
  { name: 'Börek (Käse)',                kcal: 320, proteinG: 12, carbsG: 30, fatG: 18, portionG: 150, portionLabel: '1 Stück' },
  { name: 'Mercimek Çorbası (Linsensuppe)', kcal: 220, proteinG: 12, carbsG: 30, fatG: 6, portionG: 350, portionLabel: '1 Teller' },

  // ── Libanesisch / Arabisch ───────────────────────────────────────
  { name: 'Shawarma (Hähnchen)',         kcal: 510, proteinG: 36, carbsG: 44, fatG: 18, portionG: 350, portionLabel: '1 Wrap' },
  { name: 'Hummus (150 g)',              kcal: 250, proteinG: 10, carbsG: 22, fatG: 14, portionG: 150, portionLabel: '150 g' },
  { name: 'Baba Ganoush (100 g)',        kcal: 140, proteinG: 3,  carbsG: 10, fatG: 10, portionG: 100, portionLabel: '100 g' },
  { name: 'Fattoush Salat',             kcal: 180, proteinG: 4,  carbsG: 22, fatG: 8,  portionG: 250, portionLabel: '1 Portion' },
  { name: 'Mezze Teller',               kcal: 420, proteinG: 14, carbsG: 36, fatG: 24, portionG: 300, portionLabel: '1 Teller' },

  // ── Japanisch ────────────────────────────────────────────────────
  { name: 'Sushi (12 Stück gemischt)',   kcal: 420, proteinG: 22, carbsG: 60, fatG: 8,  portionG: 300, portionLabel: '12 Stück' },
  { name: 'Nigiri Lachs (6 Stück)',      kcal: 280, proteinG: 18, carbsG: 34, fatG: 6,  portionG: 200, portionLabel: '6 Stück' },
  { name: 'Maki (8 Stück)',              kcal: 200, proteinG: 8,  carbsG: 36, fatG: 2,  portionG: 160, portionLabel: '8 Stück' },
  { name: 'Tonkatsu',                    kcal: 520, proteinG: 34, carbsG: 36, fatG: 24, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Gyoza (6 Stück)',             kcal: 280, proteinG: 14, carbsG: 28, fatG: 12, portionG: 180, portionLabel: '6 Stück' },
  { name: 'Udon Nudelsuppe',             kcal: 400, proteinG: 16, carbsG: 60, fatG: 10, portionG: 500, portionLabel: '1 Schüssel' },
  { name: 'Chirashi Bowl',               kcal: 520, proteinG: 32, carbsG: 58, fatG: 14, portionG: 400, portionLabel: '1 Bowl' },
  { name: 'Okonomiyaki',                 kcal: 380, proteinG: 16, carbsG: 44, fatG: 16, portionG: 250, portionLabel: '1 Stück' },

  // ── Mehr Fleisch / High Protein ──────────────────────────────────
  { name: 'Rinderfilet (200 g)',         kcal: 340, proteinG: 46, carbsG: 0,  fatG: 16, portionG: 200, portionLabel: '200 g' },
  { name: 'Hähnchenstreifen gegrillt',   kcal: 185, proteinG: 36, carbsG: 1,  fatG: 4,  portionG: 170, portionLabel: '170 g' },
  { name: 'Lammkeule gebacken (200 g)',  kcal: 320, proteinG: 38, carbsG: 0,  fatG: 18, portionG: 200, portionLabel: '200 g' },
  { name: 'Thunfisch frisch (180 g)',    kcal: 200, proteinG: 42, carbsG: 0,  fatG: 3,  portionG: 180, portionLabel: '180 g' },
  { name: 'Garnelen gegrillt (150 g)',   kcal: 130, proteinG: 28, carbsG: 0,  fatG: 2,  portionG: 150, portionLabel: '150 g' },
  { name: 'Beef Jerky (30 g)',           kcal: 80,  proteinG: 14, carbsG: 3,  fatG: 1,  portionG: 30,  portionLabel: '30 g' },
  { name: 'Rührei mit Schinken (3 Eier)',kcal: 360, proteinG: 28, carbsG: 2,  fatG: 26, portionG: 200, portionLabel: '1 Portion' },
  { name: 'Lachs Bowl (Hähnchen & Avocado)', kcal: 560, proteinG: 42, carbsG: 32, fatG: 28, portionG: 450, portionLabel: '1 Bowl' },
  { name: 'Griechischer Joghurt (500 g)',kcal: 340, proteinG: 44, carbsG: 20, fatG: 8,  portionG: 500, portionLabel: '500 g' },
  { name: 'Hüttenkäse (250 g)',          kcal: 165, proteinG: 20, carbsG: 6,  fatG: 7,  portionG: 250, portionLabel: '250 g' },
  { name: 'Magerquark (500 g)',          kcal: 200, proteinG: 44, carbsG: 10, fatG: 1,  portionG: 500, portionLabel: '500 g' },

  // ── Käse & Milchprodukte ─────────────────────────────────────────
  { name: 'Mozarella (125 g)',           kcal: 310, proteinG: 22, carbsG: 2,  fatG: 24, portionG: 125, portionLabel: '125 g' },
  { name: 'Feta (100 g)',                kcal: 260, proteinG: 14, carbsG: 2,  fatG: 22, portionG: 100, portionLabel: '100 g' },
  { name: 'Gouda Scheibe (30 g)',        kcal: 120, proteinG: 8,  carbsG: 0,  fatG: 10, portionG: 30,  portionLabel: '1 Scheibe' },
  { name: 'Parmesan (20 g)',             kcal: 83,  proteinG: 7,  carbsG: 0,  fatG: 6,  portionG: 20,  portionLabel: '20 g' },
  { name: 'Frischkäse (50 g)',           kcal: 130, proteinG: 3,  carbsG: 2,  fatG: 13, portionG: 50,  portionLabel: '50 g' },
  { name: 'Skyr (500 g)',                kcal: 320, proteinG: 50, carbsG: 26, fatG: 2,  portionG: 500, portionLabel: '500 g' },

  // ── Gemüse & Beilagen ────────────────────────────────────────────
  { name: 'Avocado (½ Stück)',           kcal: 160, proteinG: 2,  carbsG: 2,  fatG: 15, portionG: 100, portionLabel: '½ Stück' },
  { name: 'Süßkartoffel gebacken',       kcal: 130, proteinG: 2,  carbsG: 30, fatG: 0,  portionG: 180, portionLabel: '180 g' },
  { name: 'Mais (100 g)',                kcal: 90,  proteinG: 3,  carbsG: 19, fatG: 1,  portionG: 100, portionLabel: '100 g' },
  { name: 'Edamame (150 g)',             kcal: 180, proteinG: 17, carbsG: 10, fatG: 8,  portionG: 150, portionLabel: '150 g' },
  { name: 'Linsen gekocht (200 g)',      kcal: 230, proteinG: 18, carbsG: 38, fatG: 1,  portionG: 200, portionLabel: '200 g' },
  { name: 'Kichererbsen (150 g)',        kcal: 230, proteinG: 12, carbsG: 36, fatG: 4,  portionG: 150, portionLabel: '150 g' },
  { name: 'Bohnen schwarz (150 g)',      kcal: 180, proteinG: 11, carbsG: 30, fatG: 1,  portionG: 150, portionLabel: '150 g' },
  { name: 'Tofu natur (150 g)',          kcal: 115, proteinG: 13, carbsG: 2,  fatG: 6,  portionG: 150, portionLabel: '150 g' },
  { name: 'Tofu gebraten (150 g)',       kcal: 220, proteinG: 16, carbsG: 4,  fatG: 16, portionG: 150, portionLabel: '150 g' },
  { name: 'Tempeh (100 g)',              kcal: 195, proteinG: 20, carbsG: 8,  fatG: 11, portionG: 100, portionLabel: '100 g' },

  // ── Obst & Süßes (einzeln) ───────────────────────────────────────
  { name: 'Orange',                      kcal: 60,  proteinG: 1,  carbsG: 14, fatG: 0,  portionG: 130, portionLabel: '1 Stück' },
  { name: 'Erdbeeren (150 g)',           kcal: 50,  proteinG: 1,  carbsG: 11, fatG: 0,  portionG: 150, portionLabel: '150 g' },
  { name: 'Blaubeeren (100 g)',          kcal: 57,  proteinG: 1,  carbsG: 14, fatG: 0,  portionG: 100, portionLabel: '100 g' },
  { name: 'Weintrauben (150 g)',         kcal: 100, proteinG: 1,  carbsG: 26, fatG: 0,  portionG: 150, portionLabel: '150 g' },
  { name: 'Mango (150 g)',               kcal: 95,  proteinG: 1,  carbsG: 24, fatG: 0,  portionG: 150, portionLabel: '150 g' },
  { name: 'Ananas (150 g)',              kcal: 78,  proteinG: 1,  carbsG: 20, fatG: 0,  portionG: 150, portionLabel: '150 g' },
  { name: 'Kiwi (2 Stück)',             kcal: 80,  proteinG: 1,  carbsG: 18, fatG: 0,  portionG: 150, portionLabel: '2 Stück' },
  { name: 'Dunkle Schokolade 85% (30g)',kcal: 170, proteinG: 3,  carbsG: 10, fatG: 14, portionG: 30,  portionLabel: '30 g' },
  { name: 'Milchschokolade (50 g)',      kcal: 265, proteinG: 4,  carbsG: 29, fatG: 15, portionG: 50,  portionLabel: '50 g' },
  { name: 'Haribo (75 g)',               kcal: 255, proteinG: 4,  carbsG: 58, fatG: 1,  portionG: 75,  portionLabel: '75 g' },
  { name: 'Chips (40 g)',                kcal: 210, proteinG: 2,  carbsG: 24, fatG: 12, portionG: 40,  portionLabel: '40 g' },
  { name: 'Popcorn gesalzen (50 g)',     kcal: 200, proteinG: 3,  carbsG: 38, fatG: 5,  portionG: 50,  portionLabel: '50 g' },

  // ── Fitness & Supplements ────────────────────────────────────────
  { name: 'Whey Protein (1 Scoop, 30g)',  kcal: 120, proteinG: 24, carbsG: 3,  fatG: 2,  portionG: 300, portionLabel: '1 Shake' },
  { name: 'Casein Shake (1 Scoop)',       kcal: 120, proteinG: 24, carbsG: 4,  fatG: 1,  portionG: 300, portionLabel: '1 Shake' },
  { name: 'Protein Shake Fertig (500ml)',  kcal: 170, proteinG: 30, carbsG: 8,  fatG: 3,  portionG: 500, portionLabel: '500 ml Flasche' },
  { name: 'Oats & Whey (100 g)',          kcal: 370, proteinG: 28, carbsG: 50, fatG: 6,  portionG: 100, portionLabel: '100 g' },
  { name: 'BCAA Drink (500 ml)',          kcal: 20,  proteinG: 5,  carbsG: 1,  fatG: 0,  portionG: 500, portionLabel: '500 ml' },
  { name: 'Pre-Workout (300 ml)',         kcal: 15,  proteinG: 0,  carbsG: 3,  fatG: 0,  portionG: 300, portionLabel: '300 ml' },
  { name: 'Erdnussbutter (100 g)',        kcal: 600, proteinG: 26, carbsG: 20, fatG: 50, portionG: 100, portionLabel: '100 g' },
  { name: 'Mandelmus (30 g)',             kcal: 185, proteinG: 6,  carbsG: 6,  fatG: 17, portionG: 30,  portionLabel: '30 g' },

  // ── Brot, Getreide & Müsli ───────────────────────────────────────
  { name: 'Haferflocken roh (80 g)',      kcal: 290, proteinG: 10, carbsG: 52, fatG: 5,  portionG: 80,  portionLabel: '80 g' },
  { name: 'Overnight Oats (Fertig)',      kcal: 380, proteinG: 14, carbsG: 56, fatG: 10, portionG: 350, portionLabel: '1 Glas' },
  { name: 'Vollkornbrot (2 Scheiben)',    kcal: 170, proteinG: 7,  carbsG: 32, fatG: 2,  portionG: 90,  portionLabel: '2 Scheiben' },
  { name: 'Laugenbrezel groß',           kcal: 300, proteinG: 9,  carbsG: 58, fatG: 2,  portionG: 120, portionLabel: '1 Stück' },
  { name: 'Knäckebrot (3 Scheiben)',     kcal: 120, proteinG: 4,  carbsG: 24, fatG: 1,  portionG: 45,  portionLabel: '3 Scheiben' },
  { name: 'Protein-Müsli (80 g)',        kcal: 300, proteinG: 20, carbsG: 38, fatG: 8,  portionG: 80,  portionLabel: '80 g trocken' },
  { name: 'Cornflakes (60 g)',           kcal: 220, proteinG: 4,  carbsG: 50, fatG: 1,  portionG: 60,  portionLabel: '60 g' },

  // ── Convenience & Fertiggerichte ─────────────────────────────────
  { name: 'Dosenravioli (400 g)',        kcal: 360, proteinG: 14, carbsG: 56, fatG: 10, portionG: 400, portionLabel: '1 Dose' },
  { name: 'Instant Nudeln (1 Pack)',     kcal: 350, proteinG: 8,  carbsG: 52, fatG: 14, portionG: 85,  portionLabel: '1 Pack' },
  { name: 'Gefrorene Pizza (300 g)',     kcal: 750, proteinG: 28, carbsG: 84, fatG: 32, portionG: 300, portionLabel: '300 g' },
  { name: 'Tiefkühl-Lasagne (350 g)',   kcal: 560, proteinG: 24, carbsG: 62, fatG: 24, portionG: 350, portionLabel: '1 Pack' },
  { name: 'Fertigsalat (200 g)',         kcal: 180, proteinG: 6,  carbsG: 12, fatG: 12, portionG: 200, portionLabel: '200 g' },

  // ── Mehr heiße Getränke ──────────────────────────────────────────
  { name: 'Doppio Espresso',             kcal: 10,  proteinG: 0,  carbsG: 1,  fatG: 0,  portionG: 60,  portionLabel: '2 Shots' },
  { name: 'Cortado',                     kcal: 50,  proteinG: 3,  carbsG: 4,  fatG: 2,  portionG: 100, portionLabel: '1 Tasse' },
  { name: 'Macchiato',                   kcal: 35,  proteinG: 2,  carbsG: 3,  fatG: 1,  portionG: 80,  portionLabel: '1 Tasse' },
  { name: 'Chai Latte (350 ml)',         kcal: 190, proteinG: 6,  carbsG: 30, fatG: 5,  portionG: 350, portionLabel: '1 Glas' },
  { name: 'Heiße Schokolade (250 ml)',  kcal: 220, proteinG: 7,  carbsG: 32, fatG: 8,  portionG: 250, portionLabel: '250 ml' },
  { name: 'Matcha Latte (250 ml)',       kcal: 130, proteinG: 5,  carbsG: 18, fatG: 4,  portionG: 250, portionLabel: '250 ml' },
  { name: 'Iced Coffee (350 ml)',        kcal: 80,  proteinG: 2,  carbsG: 14, fatG: 2,  portionG: 350, portionLabel: '350 ml' },
  { name: 'Cold Brew (300 ml)',          kcal: 15,  proteinG: 0,  carbsG: 2,  fatG: 0,  portionG: 300, portionLabel: '300 ml' },
  { name: 'Frappuccino (350 ml)',        kcal: 280, proteinG: 5,  carbsG: 44, fatG: 9,  portionG: 350, portionLabel: '350 ml' },

  // ── Mehr Säfte & Smoothies ───────────────────────────────────────
  { name: 'Multivitaminsaft (200 ml)',   kcal: 100, proteinG: 0,  carbsG: 24, fatG: 0,  portionG: 200, portionLabel: '200 ml' },
  { name: 'Kirschsaft (200 ml)',         kcal: 110, proteinG: 1,  carbsG: 26, fatG: 0,  portionG: 200, portionLabel: '200 ml' },
  { name: 'Tomatensaft (200 ml)',        kcal: 38,  proteinG: 2,  carbsG: 7,  fatG: 0,  portionG: 200, portionLabel: '200 ml' },
  { name: 'Protein Smoothie Banane',     kcal: 310, proteinG: 28, carbsG: 40, fatG: 5,  portionG: 400, portionLabel: '400 ml' },
  { name: 'Grüner Detox Smoothie',       kcal: 120, proteinG: 4,  carbsG: 22, fatG: 2,  portionG: 400, portionLabel: '400 ml' },
  { name: 'Rote-Bete-Saft (200 ml)',    kcal: 80,  proteinG: 2,  carbsG: 18, fatG: 0,  portionG: 200, portionLabel: '200 ml' },

  // ── Mehr Softdrinks ──────────────────────────────────────────────
  { name: 'Fanta Zero (330 ml)',         kcal: 3,   proteinG: 0,  carbsG: 1,  fatG: 0,  portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Sprite Zero (330 ml)',        kcal: 2,   proteinG: 0,  carbsG: 0,  fatG: 0,  portionG: 330, portionLabel: '330 ml Dose' },
  { name: 'Lipton Ice Tea (500 ml)',     kcal: 160, proteinG: 0,  carbsG: 40, fatG: 0,  portionG: 500, portionLabel: '500 ml Flasche' },
  { name: 'Bionade Holunder (330 ml)',   kcal: 62,  proteinG: 0,  carbsG: 15, fatG: 0,  portionG: 330, portionLabel: '330 ml' },
  { name: 'Spezi (330 ml)',              kcal: 145, proteinG: 0,  carbsG: 36, fatG: 0,  portionG: 330, portionLabel: '330 ml' },
  { name: 'Mate (330 ml)',               kcal: 30,  proteinG: 0,  carbsG: 7,  fatG: 0,  portionG: 330, portionLabel: '330 ml' },
  { name: 'Club Mate (330 ml)',          kcal: 63,  proteinG: 0,  carbsG: 15, fatG: 0,  portionG: 330, portionLabel: '330 ml' },

  // ── Nudeln & Spätzle ─────────────────────────────────────────────
  { name: 'Nudeln mit Parmesansahnesoße', kcal: 780, proteinG: 24, portionG: 400, portionLabel: '1 Teller' },
  { name: 'Spaghetti Bolognese',         kcal: 700, proteinG: 35, portionG: 450, portionLabel: '1 Teller' },
  { name: 'Käsespätzle',                 kcal: 850, proteinG: 28, portionG: 500, portionLabel: '1 Teller' },
  { name: 'Spätzle mit Rahmsoße',        kcal: 700, proteinG: 18, portionG: 450, portionLabel: '1 Teller' },
  { name: 'Spätzle mit Rahmsoße & Köttbullar', kcal: 1050, proteinG: 42, portionG: 600, portionLabel: '1 Teller' },

  // ── Pfannkuchen (2 Stück) ────────────────────────────────────────
  { name: 'Pfannkuchen pur (2 Stück)',           kcal: 380, proteinG: 12, portionG: 200, portionLabel: '2 Stück' },
  { name: 'Pfannkuchen mit Nutella (2 Stück)',   kcal: 580, proteinG: 14, portionG: 240, portionLabel: '2 Stück' },
  { name: 'Pfannkuchen mit Marmelade (2 Stück)', kcal: 500, proteinG: 12, portionG: 230, portionLabel: '2 Stück' },
  { name: 'Pfannkuchen mit Honig (2 Stück)',     kcal: 500, proteinG: 12, portionG: 230, portionLabel: '2 Stück' },
  { name: 'Pfannkuchen mit Erdnussbutter (2 Stück)', kcal: 650, proteinG: 22, portionG: 250, portionLabel: '2 Stück' },
  { name: 'Pfannkuchen mit Banane (2 Stück)',    kcal: 480, proteinG: 13, portionG: 240, portionLabel: '2 Stück' },

  // ── Müsli & Cerealien (mit Milch) ───────────────────────────────
  { name: 'Haferflocken mit Milch (1 Schüssel)', kcal: 450, proteinG: 20, portionG: 350, portionLabel: '1 Schüssel' },
  { name: 'Schokomüsli mit Milch',       kcal: 550, proteinG: 15, portionG: 350, portionLabel: '1 Schüssel' },
  { name: 'Knuspermüsli mit Milch',      kcal: 600, proteinG: 14, portionG: 380, portionLabel: '1 Schüssel' },
  { name: 'Früchtemüsli mit Milch',      kcal: 500, proteinG: 15, portionG: 360, portionLabel: '1 Schüssel' },
  { name: 'Protein-Müsli mit Milch',     kcal: 550, proteinG: 35, portionG: 370, portionLabel: '1 Schüssel' },
  { name: 'Cornflakes mit Milch',        kcal: 420, proteinG: 14, portionG: 320, portionLabel: '1 Schüssel' },
  { name: 'Cini Minis mit Milch',        kcal: 520, proteinG: 12, portionG: 340, portionLabel: '1 Schüssel' },
  { name: 'Lion Cereals mit Milch',      kcal: 550, proteinG: 13, portionG: 350, portionLabel: '1 Schüssel' },

  // ── Frühstück ────────────────────────────────────────────────────
  { name: '2 Toasts mit Nutella',        kcal: 340, proteinG: 8,  portionG: 140, portionLabel: '2 Scheiben' },
  { name: '2 Toasts mit Erdnussbutter',  kcal: 390, proteinG: 15, portionG: 140, portionLabel: '2 Scheiben' },
  { name: 'Schokocroissant',             kcal: 330, proteinG: 6,  portionG: 100, portionLabel: '1 Stück' },
  { name: '2 Brötchen mit Käse',         kcal: 500, proteinG: 22, portionG: 220, portionLabel: '2 Brötchen' },
  { name: '2 Brötchen mit Salami',       kcal: 550, proteinG: 20, portionG: 220, portionLabel: '2 Brötchen' },

  // ── Red Bull Varianten ───────────────────────────────────────────
  { name: 'Red Bull Sugarfree (250 ml)', kcal: 8,   proteinG: 0,  carbsG: 1,  fatG: 0, portionG: 250, portionLabel: '250 ml Dose' },
  { name: 'Red Bull Zero (250 ml)',      kcal: 8,   proteinG: 0,  carbsG: 0,  fatG: 0, portionG: 250, portionLabel: '250 ml Dose' },
  { name: 'Red Bull Edition (250 ml)',   kcal: 112, proteinG: 0,  carbsG: 28, fatG: 0, portionG: 250, portionLabel: '250 ml Dose' },

  // ── Ganze Pizzen ─────────────────────────────────────────────────
  { name: 'Pizza Margherita (ganze Pizza)',  kcal: 850, proteinG: 30, portionG: 500, portionLabel: '1 ganze Pizza' },
  { name: 'Pizza Salami (ganze Pizza)',      kcal: 1000, proteinG: 40, portionG: 550, portionLabel: '1 ganze Pizza' },
  { name: 'Pizza Tonno (ganze Pizza)',       kcal: 920, proteinG: 44, portionG: 530, portionLabel: '1 ganze Pizza' },
  { name: 'Pizza Hawaii (ganze Pizza)',      kcal: 960, proteinG: 38, portionG: 540, portionLabel: '1 ganze Pizza' },

  // ── Kombinationsgerichte ─────────────────────────────────────────
  { name: 'Burger mit Pommes',           kcal: 1000, proteinG: 40, portionG: 550, portionLabel: '1 Portion' },

  // ── Bäckerei Snacks & belegte Brötchen ───────────────────────────
  { name: 'Frikadellenbrötchen',         kcal: 420, proteinG: 22, carbsG: 36, fatG: 20, portionG: 180, portionLabel: '1 Stück' },
  { name: 'Bratwurst im Brötchen',       kcal: 480, proteinG: 18, carbsG: 36, fatG: 28, portionG: 180, portionLabel: '1 Stück' },
  { name: 'Currywurst im Brötchen',      kcal: 520, proteinG: 18, carbsG: 44, fatG: 28, portionG: 200, portionLabel: '1 Stück' },
  { name: 'Hotdog (klassisch)',          kcal: 380, proteinG: 14, carbsG: 38, fatG: 18, portionG: 155, portionLabel: '1 Stück' },
  { name: 'Hotdog mit Käse',            kcal: 450, proteinG: 18, carbsG: 38, fatG: 24, portionG: 175, portionLabel: '1 Stück' },
  { name: 'Leberkäsebrötchen',          kcal: 460, proteinG: 20, carbsG: 36, fatG: 26, portionG: 175, portionLabel: '1 Stück' },
  { name: 'Leberkäse mit Ei im Brötchen', kcal: 530, proteinG: 26, carbsG: 36, fatG: 30, portionG: 210, portionLabel: '1 Stück' },
  { name: 'Schnitzelbrötchen',          kcal: 550, proteinG: 28, carbsG: 42, fatG: 26, portionG: 220, portionLabel: '1 Stück' },
  { name: 'Fleischkäsebrötchen',        kcal: 450, proteinG: 20, carbsG: 36, fatG: 24, portionG: 175, portionLabel: '1 Stück' },
  { name: 'Döner-Brötchen (mini)',      kcal: 380, proteinG: 22, carbsG: 36, fatG: 16, portionG: 160, portionLabel: '1 Stück' },
  { name: 'Salami-Brötchen',            kcal: 360, proteinG: 16, carbsG: 34, fatG: 18, portionG: 145, portionLabel: '1 Stück' },
  { name: 'Thunfisch-Brötchen',         kcal: 340, proteinG: 22, carbsG: 34, fatG: 12, portionG: 145, portionLabel: '1 Stück' },
  { name: 'Ei-Brötchen mit Mayo',       kcal: 380, proteinG: 14, carbsG: 32, fatG: 22, portionG: 155, portionLabel: '1 Stück' },
  { name: 'Käse-Schinken-Brötchen',    kcal: 390, proteinG: 20, carbsG: 34, fatG: 18, portionG: 155, portionLabel: '1 Stück' },
  { name: 'Lachs-Brötchen mit Frischkäse', kcal: 360, proteinG: 20, carbsG: 34, fatG: 16, portionG: 150, portionLabel: '1 Stück' },
  { name: 'Mett-Brötchen',             kcal: 400, proteinG: 22, carbsG: 32, fatG: 20, portionG: 155, portionLabel: '1 Stück' },
  { name: 'Graved Lachs Baguette',      kcal: 420, proteinG: 24, carbsG: 42, fatG: 16, portionG: 180, portionLabel: '1 Stück' },
  { name: 'Chicken-Brötchen (Bäcker)',  kcal: 430, proteinG: 26, carbsG: 36, fatG: 18, portionG: 175, portionLabel: '1 Stück' },
  { name: 'Käsebrötchen warm',         kcal: 320, proteinG: 14, carbsG: 34, fatG: 14, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Bäcker-Pizza-Schnitte',     kcal: 380, proteinG: 14, carbsG: 42, fatG: 16, portionG: 150, portionLabel: '1 Stück' },
  { name: 'Laugenbrezel mit Obatzda',  kcal: 420, proteinG: 14, carbsG: 42, fatG: 22, portionG: 160, portionLabel: '1 Portion' },
  { name: 'Wurstsemmel (Bayern)',      kcal: 430, proteinG: 18, carbsG: 36, fatG: 24, portionG: 165, portionLabel: '1 Stück' },
  { name: 'Käsewurst-Brötchen',        kcal: 480, proteinG: 20, carbsG: 36, fatG: 26, portionG: 180, portionLabel: '1 Stück' },

  // ── Bäckerei · Brötchen & Brot ───────────────────────────────────
  { name: 'Brötchen pur',                kcal: 165, proteinG: 5,  carbsG: 32, fatG: 1,  portionG: 55,  portionLabel: '1 Stück' },
  { name: 'Vollkornbrötchen',            kcal: 155, proteinG: 6,  carbsG: 29, fatG: 2,  portionG: 55,  portionLabel: '1 Stück' },
  { name: 'Roggenbrötchen',             kcal: 150, proteinG: 5,  carbsG: 30, fatG: 1,  portionG: 55,  portionLabel: '1 Stück' },
  { name: 'Körnerbrötchen',             kcal: 170, proteinG: 6,  carbsG: 30, fatG: 3,  portionG: 55,  portionLabel: '1 Stück' },
  { name: 'Sesambrötchen',              kcal: 180, proteinG: 6,  carbsG: 31, fatG: 4,  portionG: 58,  portionLabel: '1 Stück' },
  { name: 'Laugenbrötchen',            kcal: 190, proteinG: 6,  carbsG: 34, fatG: 3,  portionG: 60,  portionLabel: '1 Stück' },
  { name: 'Toastbrot (1 Scheibe)',      kcal: 75,  proteinG: 3,  carbsG: 14, fatG: 1,  portionG: 30,  portionLabel: '1 Scheibe' },
  { name: 'Vollkorntoast (1 Scheibe)',  kcal: 70,  proteinG: 3,  carbsG: 12, fatG: 1,  portionG: 28,  portionLabel: '1 Scheibe' },
  { name: 'Baguette (100 g)',           kcal: 265, proteinG: 9,  carbsG: 53, fatG: 1,  portionG: 100, portionLabel: '100 g' },
  { name: 'Baguette (halbes)',          kcal: 330, proteinG: 11, carbsG: 66, fatG: 2,  portionG: 125, portionLabel: '½ Stück' },
  { name: 'Ciabatta (100 g)',           kcal: 270, proteinG: 9,  carbsG: 53, fatG: 2,  portionG: 100, portionLabel: '100 g' },
  { name: 'Sauerteigbrot (2 Scheiben)', kcal: 180, proteinG: 6,  carbsG: 36, fatG: 1,  portionG: 80,  portionLabel: '2 Scheiben' },
  { name: 'Roggenbrot (2 Scheiben)',    kcal: 170, proteinG: 6,  carbsG: 34, fatG: 1,  portionG: 80,  portionLabel: '2 Scheiben' },
  { name: 'Weißbrot (2 Scheiben)',      kcal: 165, proteinG: 5,  carbsG: 33, fatG: 1,  portionG: 70,  portionLabel: '2 Scheiben' },

  // ── Bäckerei · Süße Teilchen ─────────────────────────────────────
  { name: 'Butter-Croissant',           kcal: 240, proteinG: 5,  carbsG: 26, fatG: 13, portionG: 75,  portionLabel: '1 Stück' },
  { name: 'Schokocroissant',            kcal: 330, proteinG: 6,  carbsG: 40, fatG: 16, portionG: 100, portionLabel: '1 Stück' },
  { name: 'Mandelcroissant',            kcal: 380, proteinG: 8,  carbsG: 38, fatG: 22, portionG: 110, portionLabel: '1 Stück' },
  { name: 'Nussschnecke',              kcal: 380, proteinG: 7,  carbsG: 50, fatG: 17, portionG: 120, portionLabel: '1 Stück' },
  { name: 'Rosinenschnecke',           kcal: 320, proteinG: 6,  carbsG: 52, fatG: 10, portionG: 110, portionLabel: '1 Stück' },
  { name: 'Mohnschnecke',              kcal: 350, proteinG: 7,  carbsG: 50, fatG: 14, portionG: 115, portionLabel: '1 Stück' },
  { name: 'Franzbrötchen',             kcal: 360, proteinG: 6,  carbsG: 48, fatG: 17, portionG: 110, portionLabel: '1 Stück' },
  { name: 'Berliner / Pfannkuchen',    kcal: 340, proteinG: 5,  carbsG: 46, fatG: 15, portionG: 100, portionLabel: '1 Stück' },
  { name: 'Donut mit Glasur',          kcal: 300, proteinG: 4,  carbsG: 38, fatG: 15, portionG: 80,  portionLabel: '1 Stück' },
  { name: 'Donut mit Schokolade',      kcal: 340, proteinG: 4,  carbsG: 42, fatG: 18, portionG: 90,  portionLabel: '1 Stück' },
  { name: 'Eclair (Windbeutel)',        kcal: 280, proteinG: 5,  carbsG: 30, fatG: 16, portionG: 90,  portionLabel: '1 Stück' },
  { name: 'Käsekuchen (1 Stück)',       kcal: 380, proteinG: 10, carbsG: 38, fatG: 21, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Streuselkuchen (1 Stück)',  kcal: 350, proteinG: 5,  carbsG: 52, fatG: 14, portionG: 120, portionLabel: '1 Stück' },
  { name: 'Bienenstich (1 Stück)',     kcal: 420, proteinG: 7,  carbsG: 48, fatG: 23, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Apfelkuchen mit Streusel',  kcal: 340, proteinG: 4,  carbsG: 50, fatG: 14, portionG: 120, portionLabel: '1 Stück' },
  { name: 'Pflaumenkuchen (1 Stück)',  kcal: 280, proteinG: 4,  carbsG: 44, fatG: 10, portionG: 110, portionLabel: '1 Stück' },
  { name: 'Marmorkuchen (1 Stück)',    kcal: 360, proteinG: 6,  carbsG: 46, fatG: 18, portionG: 110, portionLabel: '1 Stück' },
  { name: 'Schwarzwälder Kirschtorte', kcal: 420, proteinG: 5,  carbsG: 44, fatG: 26, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Schokoladenkuchen (1 Stück)',kcal: 440, proteinG: 6,  carbsG: 52, fatG: 24, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Waffel mit Sahne',          kcal: 380, proteinG: 6,  carbsG: 44, fatG: 20, portionG: 140, portionLabel: '1 Portion' },
  { name: 'Brezeln (1 Stück)',         kcal: 220, proteinG: 7,  carbsG: 43, fatG: 2,  portionG: 80,  portionLabel: '1 Stück' },
  { name: 'Laugenbrezel mit Butter',   kcal: 310, proteinG: 8,  carbsG: 44, fatG: 11, portionG: 110, portionLabel: '1 Portion' },
  { name: 'Muffin Schoko',             kcal: 380, proteinG: 5,  carbsG: 52, fatG: 18, portionG: 120, portionLabel: '1 Stück' },
  { name: 'Muffin Blueberry',          kcal: 340, proteinG: 5,  carbsG: 50, fatG: 14, portionG: 115, portionLabel: '1 Stück' },
  { name: 'Cookie (Schoko-Chip)',       kcal: 210, proteinG: 2,  carbsG: 28, fatG: 10, portionG: 50,  portionLabel: '1 Stück' },
  { name: 'Shortbread (3 Stück)',       kcal: 230, proteinG: 3,  carbsG: 27, fatG: 13, portionG: 50,  portionLabel: '3 Stück' },

  // ── Bäckerei · Belegte Brote & Snacks ────────────────────────────
  { name: 'Brötchen mit Butter & Käse', kcal: 310, proteinG: 14, carbsG: 33, fatG: 13, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Brötchen mit Butter & Marmelade', kcal: 270, proteinG: 5, carbsG: 48, fatG: 7, portionG: 120, portionLabel: '1 Stück' },
  { name: 'Brötchen mit Schinken & Käse', kcal: 320, proteinG: 18, carbsG: 33, fatG: 12, portionG: 135, portionLabel: '1 Stück' },
  { name: 'Brötchen mit Ei',            kcal: 290, proteinG: 13, carbsG: 32, fatG: 12, portionG: 130, portionLabel: '1 Stück' },
  { name: 'Laugenstange mit Käse',      kcal: 360, proteinG: 16, carbsG: 38, fatG: 16, portionG: 140, portionLabel: '1 Stück' },
  { name: 'Baguette mit Butter',        kcal: 380, proteinG: 10, carbsG: 55, fatG: 13, portionG: 140, portionLabel: '½ Baguette' },
  { name: 'Toast mit Butter & Käse',    kcal: 280, proteinG: 12, carbsG: 26, fatG: 14, portionG: 110, portionLabel: '2 Scheiben' },
  { name: 'Focaccia (100 g)',           kcal: 290, proteinG: 7,  carbsG: 40, fatG: 11, portionG: 100, portionLabel: '100 g' },

  // ── Snacks & Kleinigkeiten (mehr) ────────────────────────────────
  { name: 'Salzstangen (50 g)',         kcal: 190, proteinG: 5,  carbsG: 38, fatG: 2,  portionG: 50,  portionLabel: '50 g' },
  { name: 'Cracker (30 g)',             kcal: 130, proteinG: 3,  carbsG: 20, fatG: 5,  portionG: 30,  portionLabel: '30 g' },
  { name: 'Reiswaffeln (3 Stück)',      kcal: 110, proteinG: 2,  carbsG: 24, fatG: 1,  portionG: 30,  portionLabel: '3 Stück' },
  { name: 'Pringles (50 g)',            kcal: 270, proteinG: 3,  carbsG: 28, fatG: 17, portionG: 50,  portionLabel: '50 g' },
  { name: 'Gummibärchen (50 g)',        kcal: 165, proteinG: 4,  carbsG: 37, fatG: 0,  portionG: 50,  portionLabel: '50 g' },
  { name: 'Schokoriegel (Mars)',        kcal: 230, proteinG: 2,  carbsG: 35, fatG: 9,  portionG: 51,  portionLabel: '1 Riegel' },
  { name: 'Schokoriegel (Snickers)',    kcal: 250, proteinG: 4,  carbsG: 33, fatG: 12, portionG: 52,  portionLabel: '1 Riegel' },
  { name: 'Schokoriegel (Twix)',        kcal: 240, proteinG: 2,  carbsG: 34, fatG: 11, portionG: 50,  portionLabel: '1 Riegel' },
  { name: 'Kinder Riegel',             kcal: 145, proteinG: 2,  carbsG: 19, fatG: 7,  portionG: 35,  portionLabel: '1 Riegel' },
  { name: 'Hanuta',                    kcal: 115, proteinG: 2,  carbsG: 12, fatG: 7,  portionG: 25,  portionLabel: '1 Stück' },
  { name: 'Kinderschokolade (4 Riegel)',kcal: 220, proteinG: 3,  carbsG: 25, fatG: 13, portionG: 50,  portionLabel: '4 Riegel' },
  { name: 'Joghurt Frucht (200 g)',     kcal: 160, proteinG: 5,  carbsG: 28, fatG: 3,  portionG: 200, portionLabel: '200 g' },
  { name: 'Quark mit Früchten (200 g)', kcal: 140, proteinG: 12, carbsG: 18, fatG: 2,  portionG: 200, portionLabel: '200 g' },
  { name: 'Dickmilch (200 g)',          kcal: 120, proteinG: 7,  carbsG: 9,  fatG: 6,  portionG: 200, portionLabel: '200 g' },
  { name: 'Buttermilch (250 ml)',       kcal: 95,  proteinG: 8,  carbsG: 12, fatG: 1,  portionG: 250, portionLabel: '250 ml' },

  // ── Heiße Mahlzeiten & Beilagen (mehr) ───────────────────────────
  { name: 'Kartoffelgratin',            kcal: 380, proteinG: 10, carbsG: 30, fatG: 24, portionG: 250, portionLabel: '1 Portion' },
  { name: 'Rösti (2 Stück)',            kcal: 280, proteinG: 4,  carbsG: 34, fatG: 14, portionG: 150, portionLabel: '2 Stück' },
  { name: 'Käsekartoffeln',             kcal: 440, proteinG: 14, carbsG: 46, fatG: 22, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Gnocchi mit Tomatensauce',  kcal: 420, proteinG: 10, carbsG: 68, fatG: 12, portionG: 380, portionLabel: '1 Portion' },
  { name: 'Gnocchi mit Pesto',         kcal: 520, proteinG: 12, carbsG: 62, fatG: 26, portionG: 380, portionLabel: '1 Portion' },
  { name: 'Tortellini (Käse)',          kcal: 480, proteinG: 18, carbsG: 64, fatG: 18, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Ravioli (Ricotta & Spinat)', kcal: 420, proteinG: 16, carbsG: 56, fatG: 16, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Quiche Lorraine (1 Stück)', kcal: 420, proteinG: 14, carbsG: 24, fatG: 30, portionG: 150, portionLabel: '1 Stück' },
  { name: 'Flammkuchen (komplett)',     kcal: 700, proteinG: 22, carbsG: 76, fatG: 34, portionG: 380, portionLabel: '1 ganzer' },
  { name: 'Zwiebelsuppe mit Croutons', kcal: 220, proteinG: 8,  carbsG: 22, fatG: 12, portionG: 350, portionLabel: '1 Teller' },
  { name: 'Minestrone',                kcal: 160, proteinG: 6,  carbsG: 24, fatG: 4,  portionG: 350, portionLabel: '1 Teller' },
  { name: 'Gazpacho (350 ml)',          kcal: 120, proteinG: 3,  carbsG: 16, fatG: 5,  portionG: 350, portionLabel: '1 Teller' },
  { name: 'Rote Grütze mit Sahne',     kcal: 220, proteinG: 2,  carbsG: 30, fatG: 10, portionG: 200, portionLabel: '1 Portion' },
  { name: 'Kaiserschmarrn',            kcal: 480, proteinG: 10, carbsG: 68, fatG: 18, portionG: 250, portionLabel: '1 Portion' },
  { name: 'Palatschinken (2 Stück)',   kcal: 360, proteinG: 10, carbsG: 48, fatG: 14, portionG: 200, portionLabel: '2 Stück' },

  // ── Salate (mehr Varianten) ───────────────────────────────────────
  { name: 'Nicoise Salat',             kcal: 320, proteinG: 24, carbsG: 18, fatG: 16, portionG: 350, portionLabel: '1 Portion' },
  { name: 'Waldorf Salat',             kcal: 280, proteinG: 6,  carbsG: 18, fatG: 22, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Caprese Salat',             kcal: 280, proteinG: 16, carbsG: 4,  fatG: 22, portionG: 250, portionLabel: '1 Portion' },
  { name: 'Linsensalat mit Feta',      kcal: 320, proteinG: 18, carbsG: 36, fatG: 12, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Kichererbsensalat',         kcal: 290, proteinG: 14, carbsG: 36, fatG: 10, portionG: 300, portionLabel: '1 Portion' },
  { name: 'Avocado-Thunfisch-Salat',   kcal: 340, proteinG: 26, carbsG: 8,  fatG: 24, portionG: 300, portionLabel: '1 Portion' },
];

export function searchFood(query: string): FoodItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return FOOD_DATABASE
    .filter((f) => f.name.toLowerCase().includes(needle))
    .slice(0, 10);
}
