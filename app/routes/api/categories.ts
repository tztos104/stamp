// app/routes/api/categories.ts
import { Prisma } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // 요청 메서드(POST, DELETE 등)에 따라 다른 작업을 수행합니다.
  switch (request.method) {
    case "POST": {
      // --- 카테고리 생성 로직 ---
      const formData = await request.formData();
      const name = formData.get("name") as string;
       if (!name) {
        return json({ error: "카테고리 이름이 필요합니다." }, { status: 400 });
      }
      try {
        const newCategory = await db.eventCategory.create({ data: { name } });
        return json({ success: true, newCategory });
      } catch (e: unknown) {
        // 👇 Prisma의 고유 제약 조건 위반 오류(P2002)를 확인합니다.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return json({ error: "이미 존재하는 카테고리 이름입니다." }, { status: 409 }); // 409 Conflict 상태 코드
        }
        return json({ error: "카테고리 생성에 실패했습니다." }, { status: 500 });
      }
    }
    
    case "DELETE": {
      // --- 카테고리 삭제 로직 ---
      const formData = await request.formData();
      const id = Number(formData.get("id"));
      if (!id) {
        return json({ error: "ID가 필요합니다." }, { status: 400 });
      }
      try {
        await db.eventCategory.delete({ where: { id } });
        return json({ success: true });
      } catch (error) {
        return json({ error: "카테고리 삭제에 실패했습니다." }, { status: 500 });
      }
    }
    default: {
      return json({ message: "허용되지 않는 메서드입니다." }, { status: 405 });
    }
  }
};