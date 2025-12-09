
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");

  // If userId is provided, we might want to allow viewing other's dates
  // For now, if targetUserId is present, return that user's dates.
  // Otherwise return current user's dates.
  // The requirement says "Store, View, Modify, Delete user's available date slots".

  const userIdToFetch = targetUserId || user.id;

  const availableDates = await db.availableDate.findMany({
    where: { userId: userIdToFetch },
    select: {
      date: true,
      userId: true,
    },
    orderBy: { date: "asc" },
  });

  return json({ availableDates });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const method = request.method.toUpperCase();

  if (method === "POST") {
    // Add a date
    const dateStr = formData.get("date");
    if (typeof dateStr !== "string") {
      return json({ error: "Invalid date" }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return json({ error: "Invalid date format" }, { status: 400 });
    }

    // Try to create. If exists, it's fine (idempotent) or we catch duplicate error
    try {
      await db.availableDate.create({
        data: {
          userId: user.id,
          date: date,
        },
      });
      return json({ success: true });
    } catch (e: any) {
        // If unique constraint failed, it's already there
        if (e.code === 'P2002') {
            return json({ success: true, message: "Already exists" });
        }
        throw e;
    }
  } else if (method === "DELETE") {
    // Remove a date
    const dateStr = formData.get("date");
    if (typeof dateStr !== "string") {
      return json({ error: "Invalid date" }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return json({ error: "Invalid date format" }, { status: 400 });
    }

    // We need to delete by userId + date.
    // Since we don't pass ID, we use deleteMany or delete with composite key logic if Prisma supports it easily.
    // But schema says @@unique([userId, date]), so we can use delete on that unique constraint?
    // Not directly with `delete` unless we have the composite ID or unique compound.
    // Yes, Prisma `delete` supports `where: { userId_date: { userId, date } }` if the unique constraint is named or default.
    // Default name for @@unique([userId, date]) is `userId_date` (fields separated by underscore).

    try {
      await db.availableDate.delete({
        where: {
          userId_date: {
            userId: user.id,
            date: date,
          },
        },
      });
      return json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') {
            // Record to delete does not exist.
            return json({ success: true, message: "Already deleted" });
        }
        throw e;
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};
