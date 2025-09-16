import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone")?.replace(/-/g, "").trim();

  if (!phone) {
    return json({ exists: false, isUser: false });
  }

  const user = await db.user.findUnique({
    where: { phoneNumber: phone },
  });

  // user가 존재하고, 정식 회원(ACTIVE)인지 여부도 함께 반환
  return json({ exists: !!user, isUser: user?.status === 'ACTIVE' });
};