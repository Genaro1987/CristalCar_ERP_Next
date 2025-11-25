import { listarMotivosFaltaAtivos } from "@/db/rhFaltas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const motivos = await listarMotivosFaltaAtivos();
    return NextResponse.json({ success: true, data: motivos });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
