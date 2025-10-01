import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabasedamin";

export async function GET() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data.users);
}

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data.user);
}

export async function PUT(req: Request) {
  const { id, password } = await req.json();
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data.user);
}
