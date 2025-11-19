import { NextResponse } from "next/server";
import { db } from "@/db/client";

export async function GET() {
  try {
    const result = await db.execute("SELECT 1 as ok");
    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? "Erro inesperado",
      },
      { status: 500 }
    );
  }
}
