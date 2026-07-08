"use client";

import type { CategoryInfo, MyCategoryContent } from "@/types/course";

import { useEffect, useState } from "react";
import { Accordion, Card } from "@heroui/react";

import PieChartWithBreakdownDemo from "@/components/learnwords/pie-chart-with-breakdown-demo";
import { courseApi } from "@/lib/api";

export default function LearnWordsPage() {
  const [data, setData] = useState<MyCategoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    courseApi
      .getMyCategoryContent(1)
      .then((res) => setData(res))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("加载课程分类失败:", err);
        setError(err?.message ?? "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  const renderCategoryAccordion = (categories: CategoryInfo[]) => (
    <Accordion
      allowsMultipleExpanded
      className="w-full overflow-hidden rounded-[25px]  word-search-glass !bg-transparent"
    >
      {categories.map((cat) => (
        <Accordion.Item key={cat.id}>
          <Accordion.Heading>
            <Accordion.Trigger>
              {cat.name}
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div className="  grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {cat.courseInfos.map((course) => (
                  <Card
                    key={course.courseId}
                    className=" rounded-2xl"
                  >
                    <PieChartWithBreakdownDemo
                      courseName={course.courseName}
                      doneCount={course.doneCount}
                      notDoneCount={course.notDoneCount}
                      notLearned={course.notLearned}
                    />
                  </Card>
                ))}
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="  grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="word-search-glass !bg-transparent rounded-2xl">
          <PieChartWithBreakdownDemo
            courseName={data?.newWord.courseName}
            doneCount={data?.newWord.doneCount}
            notDoneCount={data?.newWord.notDoneCount}
            notLearned={data?.newWord.notLearned}
          />
        </Card>
        <Card className="word-search-glass !bg-transparent rounded-2xl">
          <PieChartWithBreakdownDemo
            courseName={data?.strengthenWord.courseName}
            doneCount={data?.strengthenWord.doneCount}
            notDoneCount={data?.strengthenWord.notDoneCount}
            notLearned={data?.strengthenWord.notLearned}
          />
        </Card>
      </div>

      {loading ? (
        <div className="text-muted px-4 text-sm">加载中...</div>
      ) : error ? (
        <div className="text-danger px-4 text-sm">{error}</div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 px-4 pt-2">
            <span className="text-foreground text-base font-semibold">
              我的课程
            </span>
          </div>

          {data && data.myCategoryInfos.length > 0
            ? renderCategoryAccordion(data.myCategoryInfos)
            : null}

          <div className="flex flex-col gap-1.5 px-4 pt-2">
            <span className="text-foreground text-base font-semibold">
              精选课程
            </span>
          </div>

          {data && data.categoryInfos.length > 0
            ? renderCategoryAccordion(data.categoryInfos)
            : null}
        </>
      )}
    </div>
  );
}
