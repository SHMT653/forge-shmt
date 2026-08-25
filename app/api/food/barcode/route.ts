import { NextResponse } from 'next/server';
import { findOpenFoodFactsByBarcode, normalizeBarcode } from '@/data/foodSearch';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const code = normalizeBarcode(new URL(request.url).searchParams.get('code') ?? '');
  if (!code) {
    return NextResponse.json({ product: null }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const product = await findOpenFoodFactsByBarcode(code);
  return NextResponse.json({ product }, {
    headers: {
      'Cache-Control': product
        ? 'public, s-maxage=86400, stale-while-revalidate=604800'
        : 'public, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
