"use client";

import type { CategoryInfo, MyCategoryContent } from "@/types/course";
import { Books, GraduationCap, Plus, Gear } from "@gravity-ui/icons";

import { useEffect, useState } from "react";
import {
  Accordion,
  Card,
  Chip,
  Skeleton,
  Spinner,
  ButtonGroup,
  Button,
  Modal,
  InputGroup,
  Separator,
} from "@heroui/react";

import PieChartWithBreakdownDemo from "@/components/learnwords/pie-chart-with-breakdown-demo";
import { courseApi } from "@/lib/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function CourseChartSkeleton() {
  return (
    <Card className="word-search-glass !bg-transparent rounded-2xl">
      <Card.Header>
        <Skeleton className="h-6 w-32 rounded-lg" />
      </Card.Header>
      <Card.Content className="flex flex-row items-center justify-between gap-6">
        <Skeleton className="size-[110px] shrink-0 rounded-full" />
        <div className="flex min-w-[150px] max-w-[250px] flex-1 flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-3 shrink-0 rounded-full" />
              <Skeleton className="h-5 flex-1 rounded-lg" />
              <Skeleton className="h-5 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function CategoryAccordionSkeleton() {
  return (
    <div className="flex min-h-28 w-full items-center justify-center">
      <Spinner aria-label="课程加载中" />
    </div>
  );
}

function LearnWordsSkeleton() {
  return (
    <>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <CourseChartSkeleton />
        <CourseChartSkeleton />
      </div>

      <div className="flex flex-col gap-1.5 px-4 pt-2">
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
      <CategoryAccordionSkeleton />

      <div className="flex flex-col gap-1.5 px-4 pt-2">
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
      <CategoryAccordionSkeleton />
    </>
  );
}

export default function LearnWordsPage() {
  const [data, setData] = useState<MyCategoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  // 添加/编辑课程弹框状态
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  // 当前操作的课程 id：0 表示新增，>0 表示编辑
  const [editCourseId, setEditCourseId] = useState(0);
  const [courseName, setCourseName] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除课程确认弹框状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState(0);
  const [deleteCourseName, setDeleteCourseName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadData = () =>
    courseApi.getMyCategoryContent(1).then((res) => setData(res));

  useEffect(() => {
    loadData()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("加载课程分类失败:", err);
        setError(err?.message ?? "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  // 打开「添加课程」弹框
  const openAddCourseModal = () => {
    setEditCourseId(0);
    setCourseName("");
    setCourseModalOpen(true);
  };

  // 打开「编辑课程」弹框
  const openEditCourseModal = (id: number, name: string) => {
    setEditCourseId(id);
    setCourseName(name);
    setCourseModalOpen(true);
  };

  // 保存课程：新增 setcourseId 传 0，编辑传当前课程 id，type 固定为 1
  const handleSaveCourse = async () => {
    const name = courseName.trim();

    if (!name) return;

    setSaving(true);
    try {
      await courseApi.saveCourse(editCourseId, name, 1);
      setCourseModalOpen(false);
      await loadData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("保存课程失败:", err);
    } finally {
      setSaving(false);
    }
  };

  // 打开「删除课程」确认弹框
  const openDeleteCourseModal = (id: number, name: string) => {
    setDeleteCourseId(id);
    setDeleteCourseName(name);
    setDeleteModalOpen(true);
  };

  // 确认删除课程：setcourseId 传当前选择的课程 id，成功后刷新页面
  const handleDeleteCourse = async () => {
    setDeleting(true);
    try {
      await courseApi.deleteCourse(deleteCourseId);
      setDeleteModalOpen(false);
      await loadData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("删除课程失败:", err);
    } finally {
      setDeleting(false);
    }
  };

  const renderCategoryAccordion = (
    categories: CategoryInfo[],
    menuMode: "full" | "remove",
  ) => (
    <Accordion
      allowsMultipleExpanded
      className="w-full overflow-hidden rounded-[25px]  word-search-glass !bg-transparent"
    >
      <div className="flex items-center gap-1.5 px-6 py-3 bg-white/15 dark:bg-black/15">
        <span className="text-foreground text-base font-semibold">
          {menuMode == "full" ? "我的课程" : "精选课程"}
        </span>

        {menuMode === "full" && (
          <Button
            isIconOnly
            size={isDesktop ? "md" : "sm"}
            variant="primary"
            onPress={openAddCourseModal}
          >
            <Plus />
          </Button>
        )}

        {menuMode === "remove" && (
          <Button
            isIconOnly
            size={isDesktop ? "md" : "sm"}
            variant="primary"
           
          >
            <Plus />
          </Button>
        )}
      </div>

      <hr className="border-t border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)]" />

      {categories.every((cat) => cat.courseInfos.length === 0) ? (
        <div className="px-6 py-5 text-center text-sm text-muted">
          暂无课程，请先添加课程
        </div>
      ) : null}

      {categories
        .filter((cat) => cat.courseInfos.length > 0)
        .map((cat) => (
          <Accordion.Item key={cat.id}>
            <Accordion.Heading>
              <Accordion.Trigger>
                <div>
                  <span className="inline-flex rounded-xl  min-h-9 items-center gap-2 rounded-medium bg-white/50 px-3 text-small dark:bg-black/30">
                    {menuMode == "full" ? (
                      <GraduationCap className="size-3.5" />
                    ) : (
                      <Books className="size-3.5" />
                    )}

                    {cat.name}
                    <Chip color="accent" size="sm" variant="soft">
                      {cat.courseInfos.length}
                    </Chip>
                  </span>
                </div>

                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <div className="  grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {cat.courseInfos.map((course) => (
                    <Card key={course.courseId} className=" rounded-2xl">
                      <PieChartWithBreakdownDemo
                        courseId={course.courseId}
                        courseName={course.courseName}
                        doneCount={course.doneCount}
                        notDoneCount={course.notDoneCount}
                        notLearned={course.notLearned}
                        menuMode={menuMode}
                        onEdit={openEditCourseModal}
                        onDelete={openDeleteCourseModal}
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
      {loading ? (
        <LearnWordsSkeleton />
      ) : error ? (
        <div className="text-danger px-4 text-sm">{error}</div>
      ) : (
        <>
          <div className="  grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="word-search-glass !bg-transparent rounded-2xl ">
              <div className="absolute inset-0 bg-[url('/images/scb.png')] bg-[width:100%] bg-center bg-no-repeat bg-cover z-[-1] mt-[20px] absolute top-1/2 -translate-y-1/2 h-[130px] w-[130px] ml-[10px]"></div>
              <PieChartWithBreakdownDemo
                courseName={data?.newWord.courseName}
                doneCount={data?.newWord.doneCount}
                notDoneCount={data?.newWord.notDoneCount}
                notLearned={data?.newWord.notLearned}
                menuMode="none"
              />
            </Card>
            <Card className="word-search-glass !bg-transparent rounded-2xl ">
              <div className="absolute inset-0 bg-[url('/images/qhq.png')] bg-[width:100%] bg-center bg-no-repeat bg-cover z-[-1] mt-[20px] absolute top-1/2 -translate-y-1/2 h-[130px] w-[130px] ml-[10px]"></div>
              <PieChartWithBreakdownDemo
                courseName={data?.strengthenWord.courseName}
                doneCount={data?.strengthenWord.doneCount}
                notDoneCount={data?.strengthenWord.notDoneCount}
                notLearned={data?.strengthenWord.notLearned}
                menuMode="none"
              />
            </Card>
          </div>

          <div className="relative isolate">
            {data && data.myCategoryInfos.length > 0
              ? renderCategoryAccordion(data.myCategoryInfos, "full")
              : null}
          </div>
          <div className="relative isolate">
            {data && data.categoryInfos.length > 0
              ? renderCategoryAccordion(data.categoryInfos, "remove")
              : null}
          </div>
        </>
      )}

      {/* 添加/编辑课程弹框（受控） */}
      <Modal.Backdrop
        isDismissable={false}
        isOpen={courseModalOpen}
        variant="blur"
        onOpenChange={setCourseModalOpen}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Gear className="size-5" />
              </Modal.Icon>
              <Modal.Heading>
                {editCourseId === 0 ? "添加课程" : "编辑课程"}
              </Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                {editCourseId === 0
                  ? "添加课程后，在课程中录入单词便可开始学习"
                  : "修改课程名称后保存即可生效"}
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-5 py-2">
              <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
                <label
                  className="text-sm text-foreground"
                  htmlFor="course-name-input"
                >
                  课程名称
                </label>

                <InputGroup>
                  <InputGroup.Prefix>
                    <GraduationCap className="size-4 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    className="w-full max-w-[280px]"
                    id="course-name-input"
                    placeholder="输入课程名称"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                  />

                  <button
                    aria-label="清空内容"
                    className="inline-flex items-center justify-center px-2 hover:opacity-70"
                    type="button"
                    onClick={() => setCourseName("")}
                  >
                    <svg
                      height="16"
                      viewBox="0 0 16 16"
                      width="16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        clipRule="evenodd"
                        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M6.53 5.47a.75.75 0 0 0-1.06 1.06L6.94 8L5.47 9.47a.75.75 0 1 0 1.06 1.06L8 9.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.06 8l1.47-1.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                        fill="currentColor"
                        fillRule="evenodd"
                      />
                    </svg>
                  </button>
                </InputGroup>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button
                isDisabled={saving || courseName.trim().length === 0}
                onPress={handleSaveCourse}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 删除课程确认弹框（受控） */}
      <Modal.Backdrop
        isDismissable={false}
        isOpen={deleteModalOpen}
        variant="blur"
        onOpenChange={setDeleteModalOpen}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>移除课程</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                将课程【{deleteCourseName}】在学习列表中移除
              </p>
            </Modal.Header>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button
                isDisabled={deleting}
                variant="danger"
                onPress={handleDeleteCourse}
              >
                {deleting ? "移除中..." : "确定"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
