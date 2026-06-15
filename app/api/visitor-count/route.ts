import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVisitorCount } from "@/lib/visitor-count";

// GET — returns current visitor count (cached)
export async function GET() {
  const count = await getVisitorCount();
  return NextResponse.json({ count });
}

// POST — increment visitor count (called once per unique visit, never cached)
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_visitor_count");

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  // Keep the cached GET value in sync after a mutation
  revalidateTag("visitor-count", { expire: 0 });

  return NextResponse.json({ count: data ?? 0 });
}
