import ExamDetailPage from "../exam-detail";

export default async function ExamDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const examId = Number(id);

  if (!Number.isInteger(examId) || examId <= 0) {
    return (
      <p className="py-20 text-center text-sm text-danger">无效的试题编号</p>
    );
  }

  return <ExamDetailPage examId={examId} />;
}
