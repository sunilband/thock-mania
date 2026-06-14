import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — returns current visitor count
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_visitor_count");

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  return NextResponse.json({ count: data ?? 0 });
}

// POST — increment visitor count (called once per unique visit)
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_visitor_count");

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  return NextResponse.json({ count: data ?? 0 });
}
