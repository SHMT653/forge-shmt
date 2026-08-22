'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchOpenFoodFacts, offPortion, defaultPortionG } from '@/data/foodSearch';
import { searchFood as searchStatic, estimateMacros } from '@/domain/foodDatabase';
import { resolveFood, type FoodCandidate, type ScoredCandidate } from '@/domain/foodResolver';
import type { FoodItem, Recipe } from '@/domain/types';
import type { MealEntry } from '@/data/nutrition';

/**
 * One search box over every food source FORGE knows.
 *
 * Local sources answer instantly on every keystroke; Open Food Facts is
 * debounced and only consulted once the local ones look thin, so a query the
 * user's own library already answers never leaves the device.
 */
export function useFoodSearch(sources: {
  foods: readonly FoodItem[];
  recipes: readonly Recipe[];
  recentMeals: readonly MealEntry[];
}) {
  const [query, setQuery] = useState('');
  const [offResults, setOffResults] = useState<FoodCandidate[]>([]);
  const [searchingOff, setSearchingOff] = useState(false);
  const requestId = useRef(0);

  // ── Local candidates: free, instant, no network ────────────────────
  const localCandidates = useMemo<FoodCandidate[]>(() => {
    const candidates: FoodCandidate[] = [];

    for (const food of sources.foods) {
      candidates.push({
        id: `lib-${food.id}`,
        source: 'library',
        name: food.name,
        brand: food.brand,
        macros: food.macros,
        portionLabel: food.servingLabel,
        portionG: food.servingG,
        dataQuality: food.dataQuality,
        libraryId: food.id,
        libraryKind: 'food',
      });
    }

    for (const recipe of sources.recipes) {
      candidates.push({
        id: `rec-${recipe.id}`,
        source: 'library',
        name: recipe.name,
        brand: '',
        macros: recipe.perServing,
        portionLabel: recipe.servingLabel,
        portionG: null,
        dataQuality: 'verified',
        libraryId: recipe.id,
        libraryKind: 'recipe',
      });
    }

    // Recently eaten things the user never got round to saving.
    const savedNames = new Set(sources.foods.map((f) => f.name.toLowerCase()));
    for (const meal of sources.recentMeals) {
      if (savedNames.has(meal.name.toLowerCase())) continue;
      candidates.push({
        id: `recent-${meal.id}`,
        source: 'recent',
        name: meal.name,
        brand: '',
        macros: { kcal: meal.kcal, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG },
        portionLabel: '1 Portion',
        portionG: null,
        dataQuality: meal.dataQuality,
      });
    }

    return candidates;
  }, [sources.foods, sources.recipes, sources.recentMeals]);

  const staticCandidates = useMemo<FoodCandidate[]>(() => {
    if (query.trim().length < 2) return [];
    return searchStatic(query).map((item) => {
      const { carbsG, fatG } = estimateMacros(item);
      return {
        id: `static-${item.name}`,
        source: 'static' as const,
        name: item.name,
        brand: '',
        macros: { kcal: item.kcal, proteinG: item.proteinG, carbsG, fatG },
        portionLabel: item.portionLabel,
        portionG: item.portionG,
        // The curated table holds typical values for a dish, not a measurement.
        dataQuality: 'estimated' as const,
      };
    });
  }, [query]);

  // ── Open Food Facts: debounced, and only when needed ───────────────
  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 3) {
      setOffResults([]);
      return;
    }

    // A confident local hit makes a network round trip pointless.
    const localBest = resolveFood(needle, [...localCandidates, ...staticCandidates], { limit: 1 });
    if ((localBest[0]?.score ?? 0) >= 95) {
      setOffResults([]);
      return;
    }

    const id = ++requestId.current;
    setSearchingOff(true);
    const timer = setTimeout(async () => {
      const found = await searchOpenFoodFacts(needle);
      // A slower earlier request must not overwrite a newer one's results.
      if (id !== requestId.current) return;

      setOffResults(
        found.map((product) => {
          const grams = defaultPortionG(product);
          return {
            id: `off-${product.code}`,
            source: 'off' as const,
            name: product.name,
            brand: product.brand,
            macros: offPortion(product, grams),
            portionLabel: product.servingSizeG ? `${grams} g (Portion)` : '100 g',
            portionG: grams,
            // Crowdsourced: plausible, but nobody measured it for this user.
            dataQuality: 'estimated' as const,
            imageUrl: product.imageUrl,
            popularity: product.popularity,
          };
        }),
      );
      setSearchingOff(false);
    }, 350);

    return () => {
      clearTimeout(timer);
      setSearchingOff(false);
    };
  }, [query, localCandidates, staticCandidates]);

  const results: ScoredCandidate[] = useMemo(() => {
    if (query.trim().length < 2) return [];
    return resolveFood(query, [...localCandidates, ...staticCandidates, ...offResults]);
  }, [query, localCandidates, staticCandidates, offResults]);

  const reset = useCallback(() => {
    setQuery('');
    setOffResults([]);
  }, []);

  return { query, setQuery, results, searchingOff, reset };
}
