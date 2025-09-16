// app/routes/admin/events/$eventId.edit.tsx

import { type LoaderFunctionArgs, json, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { db } from "~/lib/db.server";
import { EventForm } from "../eventform"; // 👈 다음 단계에서 만들 재사용 폼 컴포넌트
import { getFlashSession, commitSession } from "~/lib/session.server";

// 1. loader: URL의 eventId를 사용해 수정할 이벤트의 데이터를 불러옵니다.
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const eventId = params.eventId;
  if (!eventId) {
    throw new Response("Event not found", { status: 404 });
  }

  const [event, categories] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      include: { images: true, participants: { include: { user: true } } },
    }),
    db.eventCategory.findMany(),
  ]);

  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  return json({ event, categories });
};

// 2. action: 폼 제출 시, 데이터를 받아 이벤트를 '수정'합니다. (다음 단계에서 완성)
export const action = async ({ request, params }: ActionFunctionArgs) => {
    const eventId = params.eventId!;
    // TODO: 여기에 이벤트 수정 로직을 구현합니다.
    console.log(`Event ${eventId} updated!`);

    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    flashSession.flash("toast", {
        type: "success",
        message: "이벤트가 성공적으로 수정되었습니다.",
    });

    return redirect(`/admin/events`, {
        headers: { "Set-Cookie": await commitSession(flashSession) },
    });
};


export default function EditEventPage() {
  const { event, categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <EventForm 
      fetcher={fetcher}
      categories={categories}
      defaultValues={event} // 👈 loader가 불러온 기존 데이터를 폼에 채워줍니다.
    />
  );
}