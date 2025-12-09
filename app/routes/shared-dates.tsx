
import { SharedDateFinder } from "~/components/SharedDateFinder";

export default function SharedDatesPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">날짜 조율하기</h1>
      <SharedDateFinder />
    </div>
  );
}
