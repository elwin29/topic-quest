import { prisma } from "@/lib/db";
import { getAuthSession } from "@/lib/next-auth";
import { quizCreationSchema } from "@/schemas/forms/quiz";
import { NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";

export async function POST(req: Request) {
  try {
    // Get authenticated session
    const session = await getAuthSession();
    if (!session?.user) {
      console.error("User not authenticated");
      return NextResponse.json(
        { error: "You must be logged in to create a game." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log("Request body:", body);

    const { topic, type, amount } = quizCreationSchema.parse(body);

    // Create game in database
    const game = await prisma.game.create({
      data: {
        gameType: type,
        timeStarted: new Date(),
        userId: session.user.id,
        topic,
      },
    });
    console.log("Game created:", game);

    // Update or insert topic_count in the database
    await prisma.topic_count.upsert({
      where: { topic },
      create: { topic, count: 1 },
      update: { count: { increment: 1 } },
    });
    console.log(`Topic count for ${topic} updated or created.`);

    // Ensure API_URL is defined
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("API_URL environment variable is not defined");
      return NextResponse.json(
        { error: "Internal Server Error: API_URL not configured." },
        { status: 500 }
      );
    }

    // Fetch questions from external API
    let data;
    try {
      const response = await axios.post(`${apiUrl}/api/questions`, {
        amount,
        topic,
        type,
      });
      data = response.data;
      console.log("Questions fetched from external API:", data);
    } catch (apiError: unknown) {
      // Explicitly declare it as unknown
      // Check if it's an Axios error
      if (axios.isAxiosError(apiError)) {
        console.error(
          "Axios error response:",
          apiError.response?.data || apiError.message
        );
        return NextResponse.json(
          { error: "Failed to fetch questions from the external API." },
          { status: 500 }
        );
      } else {
        // Handle any other error types
        console.error("Unexpected error:", apiError);
        return NextResponse.json(
          { error: "An unexpected error occurred while fetching questions." },
          { status: 500 }
        );
      }
    }

    // Store questions in the database based on question type
    if (type === "mcq") {
      type mcqQuestion = {
        question: string;
        answer: string;
        option1: string;
        option2: string;
        option3: string;
      };

      const manyData = data.questions.map((question: mcqQuestion) => {
        const options = [
          question.option1,
          question.option2,
          question.option3,
          question.answer,
        ].sort(() => Math.random() - 0.5); // Shuffle options

        return {
          question: question.question,
          answer: question.answer,
          options: JSON.stringify(options), // Store options as a string
          gameId: game.id,
          questionType: "mcq",
        };
      });

      await prisma.question.createMany({ data: manyData });
      console.log(`MCQ questions stored for game ${game.id}`);
    } else if (type === "open_ended") {
      type openQuestion = {
        question: string;
        answer: string;
      };

      const openEndedData = data.questions.map((question: openQuestion) => ({
        question: question.question,
        answer: question.answer,
        gameId: game.id,
        questionType: "open_ended",
      }));

      await prisma.question.createMany({ data: openEndedData });
      console.log(`Open-ended questions stored for game ${game.id}`);
    }

    // Return success response
    return NextResponse.json({ gameId: game.id }, { status: 200 });
  } catch (error) {
    console.error("Error creating game:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
