import type { ExamMode } from "../types";

import ExamDetailPage from "../exam-detail";
import { EXAM_MODES } from "../utils";

export default async function ExamDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const examId = Number(id);
  const requestedMode = Array.isArray(mode) ? mode[0] : mode;
  const initialMode: ExamMode = EXAM_MODES.includes(requestedMode as ExamMode)
    ? (requestedMode as ExamMode)
    : "en-cn";

  if (!Number.isInteger(examId) || examId <= 0) {
    return (
      <p className="py-20 text-center text-sm text-danger">无效的试题编号</p>
    );
  }

  return <ExamDetailPage examId={examId} initialMode={initialMode} />;
}
