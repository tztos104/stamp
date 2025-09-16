
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query) {
    return json({ users: [] });
  }

  const users = await db.user.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { phoneNumber: { contains: query } },
      ],
    },
    take: 10, // 검색 결과는 최대 10개로 제한
  });

  return json({ users });
};