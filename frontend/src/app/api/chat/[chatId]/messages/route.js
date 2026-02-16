import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req, { params }) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { chatId } = params;

    // TODO: Replace with your real DB query
    // Example:
    // const messages = await db.message.findMany({
    //   where: { chatId },
    //   orderBy: { createdAt: "asc" },
    // });

    const messages = []; // temporary

    return NextResponse.json(messages);
  } catch (error) {
    console.error("GET messages error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
