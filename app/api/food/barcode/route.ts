import { NextResponse } from 'next/server';
import { findOpenFoodFactsByBarcode, normalizeBarcode } from '@/data/foodSearch';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const code = normalizeBarcode(new URL(request.url).searchParams.get('code') ?? '');
  if (!code) {
    return NextResponse.json({ product: null }, { status: 400 });
  }

  const product = await findOpenFoodFactsByBarcode(code);
  return NextResponse.json({ product });
}
