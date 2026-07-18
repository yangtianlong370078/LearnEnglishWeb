"use client";

import type {
  AvailableCategoryInfo,
  AvailableCourseInfo,
  CategoryInfo,
  MyCategoryContent,
} from "@/types/course";
import type { Key } from "@heroui/react";
import {
  Books,
  Book,
  GraduationCap,
  Plus,
  Gear,
  BookOpen,
  Flame,
  ClockArrowRotateLeft,
} from "@gravity-ui/icons";

import { ItemCard } from "@heroui-pro/react";

import { useEffect, useState } from "react";
import {
  Accordion,
  Card,
  Chip,
  Skeleton,
  Spinner,
  Button,
  Modal,
  InputGroup,
  ScrollShadow,
  Tooltip,
} from "@heroui/react";

import PieChartWithBreakdownDemo from "@/components/learnwords/pie-chart-with-breakdown-demo";
import { courseApi } from "@/lib/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function CourseChartSkeleton() {
  return (
    <Card className="word-search-glass  rounded-3xl">
      <Card.Header className="min-h-[76px] p-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col items-center gap-4 p-4">
        <Skeleton className="size-[174px] shrink-0 rounded-full" />
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-black/[0.025] p-1.5 dark:bg-white/[0.035]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-1.5 px-1 py-2"
            >
              <Skeleton className="h-3 w-10 rounded-md" />
              <Skeleton className="h-4 w-7 rounded-md" />
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
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <CourseChartSkeleton />
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

  // 从精选课程中选择并加入学习列表
  const [availableCourseModalOpen, setAvailableCourseModalOpen] =
    useState(false);
  const [availableCategories, setAvailableCategories] = useState<
    AvailableCategoryInfo[]
  >([]);
  const [availableCoursesLoading, setAvailableCoursesLoading] = useState(false);
  const [availableCoursesError, setAvailableCoursesError] = useState<
    string | null
  >(null);
  const [availableExpandedKeys, setAvailableExpandedKeys] = useState<Set<Key>>(
    new Set<Key>(),
  );
  const [selectedCourse, setSelectedCourse] =
    useState<AvailableCourseInfo | null>(null);
  const [addConfirmOpen, setAddConfirmOpen] = useState(false);
  const [addCourseError, setAddCourseError] = useState<string | null>(null);

  // 两个 Accordion（我的课程 / 精选课程）各自的展开项
  const [expandedMap, setExpandedMap] = useState<
    Record<"full" | "remove", Set<Key>>
  >({
    full: new Set<Key>(),
    remove: new Set<Key>(),
  });

  const loadData = () =>
    courseApi.getMyCategoryContent(1).then((res) => setData(res));

  const loadAvailableCourses = async () => {
    setAvailableCoursesLoading(true);
    setAvailableCoursesError(null);

    try {
      const categories = await courseApi.getCategoryList(1);

      setAvailableCategories(categories);
      setAvailableExpandedKeys(new Set<Key>());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("加载可添加课程失败:", err);
      setAvailableCoursesError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setAvailableCoursesLoading(false);
    }
  };

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

  const openAvailableCourseModal = () => {
    setAvailableCourseModalOpen(true);
    void loadAvailableCourses();
  };

  const openAddCourseConfirm = (course: AvailableCourseInfo) => {
    setSelectedCourse(course);
    setAddCourseError(null);
    setAddConfirmOpen(true);
  };

  const handleAddCourse = async () => {
    if (!selectedCourse) return;

    const course = selectedCourse;

    // 乐观更新：默认添加成功，立即从精选课程列表移除该课程并关闭弹框
    setAvailableCategories((prev) =>
      prev.map((category) => ({
        ...category,
        courseInfos: category.courseInfos.filter(
          (item) => item.courseId !== course.courseId,
        ),
      })),
    );
    setAddConfirmOpen(false);
    setSelectedCourse(null);
    setAddCourseError(null);

    try {
      await courseApi.insertMyCourse(course.courseId);

      // 写入成功后静默刷新列表（不显示加载态）
      const [content, categories] = await Promise.all([
        courseApi.getMyCategoryContent(1),
        courseApi.getCategoryList(1),
      ]);

      setData(content);
      setAvailableCategories(categories);
      setAvailableExpandedKeys(new Set<Key>());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("添加课程失败:", err);
      // 失败回滚：重新加载精选课程列表
      void loadAvailableCourses();
    }
  };

  const collapseCategoryAccordion = (menuMode: "full" | "remove") => {
    setExpandedMap((prev) => ({
      ...prev,
      [menuMode]: new Set<Key>(),
    }));
  };

  const renderCategoryAccordion = (
    categories: CategoryInfo[],
    menuMode: "full" | "remove",
  ) => (
    <Accordion
      allowsMultipleExpanded
      className="w-full overflow-hidden rounded-3xl  word-search-glass !bg-transparent"
      expandedKeys={expandedMap[menuMode]}
      onExpandedChange={(keys) =>
        setExpandedMap((prev) => ({ ...prev, [menuMode]: keys as Set<Key> }))
      }
    >
      <div
        className="flex items-center gap-1.5 px-6 py-3 bg-white/15 dark:bg-black/15"
        onClick={() => collapseCategoryAccordion(menuMode)}
      >
        <button
          className="text-foreground text-base font-semibold"
          type="button"
          onClick={() => collapseCategoryAccordion(menuMode)}
        >
          {menuMode == "full" ? "我的课程" : "精选课程"}
        </button>

        {menuMode === "full" && (
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="新建课程"
                size={isDesktop ? "md" : "sm"}
                variant="primary"
                onClick={(event) => event.stopPropagation()}
                onPress={openAddCourseModal}
              >
                <Plus />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>新建课程</Tooltip.Content>
          </Tooltip>
        )}

        {menuMode === "remove" && (
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="添加精选课程"
                size={isDesktop ? "md" : "sm"}
                variant="primary"
                onClick={(event) => event.stopPropagation()}
                onPress={openAvailableCourseModal}
              >
                <Plus />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>添加精选课程</Tooltip.Content>
          </Tooltip>
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
          <Accordion.Item key={cat.id} id={cat.id}>
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
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 ">
                  {cat.courseInfos.map((course) => (
                    <Card
                      key={course.courseId}
                      className="group relative overflow-hidden transition-transform gap-6 duration-300 "
                    >
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
          <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
            <Card
              className="word-search-glass relative gap-6 overflow-hidden "
              style={
                {
                  "--summary-accent": "oklch(0.63 0.16 215)",
                  "--summary-ink": "oklch(0.49 0.14 220)",
                  "--summary-chart-1": "oklch(0.56 0.18 222)",
                  "--summary-chart-2": "oklch(0.68 0.15 211)",
                  "--summary-chart-3": "oklch(0.78 0.1 200)",
                  backgroundImage:
                    "linear-gradient(145deg, color-mix(in srgb, var(--summary-accent) 24%, transparent) 0%, color-mix(in srgb, var(--summary-accent) 9%, transparent) 52%, transparent 78%), linear-gradient(315deg, color-mix(in srgb, var(--summary-chart-3) 12%, transparent), transparent 46%)",
                } as React.CSSProperties
              }
            >
              <PieChartWithBreakdownDemo
                courseName={data?.newWord.courseName ?? "生词本"}
                doneCount={data?.newWord.doneCount}
                notDoneCount={data?.newWord.notDoneCount}
                notLearned={data?.newWord.notLearned}
                eyebrow="日常积累"
                leadingIcon={<BookOpen className="size-6" />}
                menuMode="none"
                variant="overview"
              />
            </Card>
            <Card
              className="word-search-glass relative gap-6 overflow-hidden "
              style={
                {
                  "--summary-accent": "oklch(0.65 0.19 32)",
                  "--summary-ink": "oklch(0.51 0.19 28)",
                  "--summary-chart-1": "oklch(0.57 0.21 25)",
                  "--summary-chart-2": "oklch(0.69 0.18 42)",
                  "--summary-chart-3": "oklch(0.79 0.13 58)",
                  backgroundImage:
                    "linear-gradient(145deg, color-mix(in srgb, var(--summary-accent) 24%, transparent) 0%, color-mix(in srgb, var(--summary-accent) 9%, transparent) 52%, transparent 78%), linear-gradient(315deg, color-mix(in srgb, var(--summary-chart-3) 12%, transparent), transparent 46%)",
                } as React.CSSProperties
              }
            >
              <PieChartWithBreakdownDemo
                courseName={data?.strengthenWord.courseName ?? "强化区"}
                doneCount={data?.strengthenWord.doneCount}
                notDoneCount={data?.strengthenWord.notDoneCount}
                notLearned={data?.strengthenWord.notLearned}
                eyebrow="重点复习"
                leadingIcon={<Flame className="size-6" />}
                menuMode="none"
                variant="overview"
              />
            </Card>
            <Card
              className="word-search-glass relative gap-6 overflow-hidden "
              style={
                {
                  "--summary-accent": "oklch(0.58 0.2 285)",
                  "--summary-ink": "oklch(0.48 0.19 285)",
                  "--summary-chart-1": "oklch(0.51 0.21 292)",
                  "--summary-chart-2": "oklch(0.64 0.18 283)",
                  "--summary-chart-3": "oklch(0.75 0.13 274)",
                  backgroundImage:
                    "linear-gradient(145deg, color-mix(in srgb, var(--summary-accent) 24%, transparent) 0%, color-mix(in srgb, var(--summary-accent) 9%, transparent) 52%, transparent 78%), linear-gradient(315deg, color-mix(in srgb, var(--summary-chart-3) 12%, transparent), transparent 46%)",
                } as React.CSSProperties
              }
            >
              <PieChartWithBreakdownDemo
                courseName={
                  data?.lastCourse.courseId
                    ? data.lastCourse.courseName
                    : "暂无学习记录"
                }
                doneCount={data?.lastCourse.doneCount}
                notDoneCount={data?.lastCourse.notDoneCount}
                notLearned={data?.lastCourse.notLearned}
                emptyLabel="暂无记录"
                eyebrow="正在学习"
                leadingIcon={<ClockArrowRotateLeft className="size-6" />}
                menuMode="none"
                variant="overview"
              />
            </Card>
          </div>

          <div className="relative isolate">
            {data && data.myCategoryInfos.length > 0
              ? renderCategoryAccordion(data.myCategoryInfos, "full")
              : null}
          </div>
          <div className="relative isolate">
            {data
              ? renderCategoryAccordion(data.categoryInfos, "remove")
              : null}
          </div>
        </>
      )}

      {/* 精选课程选择弹框 */}
      <Modal.Backdrop
        className="!bg-transparent backdrop-blur-xl "
        isOpen={availableCourseModalOpen}
        variant="blur"
        onOpenChange={setAvailableCourseModalOpen}
      >
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className=" backdrop-saturate-150 p-2 bg-white/70 dark:bg-zinc-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_32px_rgb(0_0_0/0.12)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_8px_32px_rgb(0_0_0/0.4)]">
            <Modal.Header className="p-3">
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Books className="size-5" />
              </Modal.Icon>
              <Modal.Heading>添加精选课程</Modal.Heading>
              {/* <p className="mt-1.5 text-sm leading-5 text-muted">
                按分类查看课程，并将需要学习的课程加入列表
              </p> */}
            </Modal.Header>
            <Modal.Body className="p-3">
              {availableCoursesLoading ? (
                <div className="flex min-h-40 items-center justify-center">
                  <Spinner aria-label="课程加载中" />
                </div>
              ) : availableCoursesError ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-danger">{availableCoursesError}</p>
                  <Button variant="secondary" onPress={loadAvailableCourses}>
                    重新加载
                  </Button>
                </div>
              ) : availableCategories.every(
                  (category) => category.courseInfos.length === 0,
                ) ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted">
                  暂无可添加的课程
                </div>
              ) : (
                <Accordion
                  className="w-full overflow-hidden rounded-3xl  !bg-transparent"
                  allowsMultipleExpanded
                  expandedKeys={availableExpandedKeys}
                  onExpandedChange={(keys) =>
                    setAvailableExpandedKeys(keys as Set<Key>)
                  }
                >
                  <ScrollShadow className="max-h-[40vh]  overflow-y-auto pr-1">
                    {availableCategories
                      .filter((category) => category.courseInfos.length > 0)
                      .map((category) => (
                        <Accordion.Item key={category.id} id={category.id}>
                          <Accordion.Heading>
                            <Accordion.Trigger>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="size-4 text-muted" />
                                <span className="font-medium">
                                  {category.name}
                                </span>
                                <Chip color="accent" size="sm" variant="soft">
                                  {category.courseInfos.length}
                                </Chip>
                              </div>
                              <Accordion.Indicator />
                            </Accordion.Trigger>
                          </Accordion.Heading>
                          <Accordion.Panel>
                            <Accordion.Body>
                              <div className="flex flex-col gap-1">
                                {category.courseInfos.map((course) => (
                                  <Card
                                    key={course.courseId}
                                    className="rounded-2xl mt-2 p-1"
                                  >
                                    <ItemCard
                                      variant="transparent"
                                    >
                                      <ItemCard.Icon>
                                        <Book />
                                      </ItemCard.Icon>
                                      <ItemCard.Content>
                                        <ItemCard.Title>
                                          {course.courseName}
                                        </ItemCard.Title>
                                        <ItemCard.Description>
                                          {course.wordsCount} 个单词
                                        </ItemCard.Description>
                                      </ItemCard.Content>
                                      <ItemCard.Action>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="inline-flex items-center gap-0.5 rounded-full wordfy bg-transparent px-3 py-2 text-sm text-default-700 dark:border-default-700 dark:text-default-300"
                                          onPress={() =>
                                            openAddCourseConfirm(course)
                                          }
                                        >
                                          <Plus className="size-4" />
                                          添加
                                        </Button>
                                      </ItemCard.Action>
                                    </ItemCard>
                                  </Card>
                                ))}
                              </div>
                            </Accordion.Body>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                  </ScrollShadow>
                </Accordion>
              )}
            </Modal.Body>
            <Modal.Footer className="p-0 m-2">
              <Button slot="close" variant="secondary">
                关闭
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 加入学习列表确认弹框 */}
      <Modal.Backdrop
        isDismissable={false}
        isOpen={addConfirmOpen}
        variant="blur"
        onOpenChange={(isOpen) => {
          setAddConfirmOpen(isOpen);
          if (!isOpen) {
            setSelectedCourse(null);
            setAddCourseError(null);
          }
        }}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>添加课程</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                是否将课程【{selectedCourse?.courseName}】加入学习列表
              </p>
            </Modal.Header>
            {addCourseError ? (
              <Modal.Body>
                <p className="text-sm text-danger">{addCourseError}</p>
              </Modal.Body>
            ) : null}
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button onPress={handleAddCourse}>确定</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

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

                <InputGroup
                  style={
                    {
                      "--field-border": "var(--border)",
                    } as React.CSSProperties
                  }
                  variant="secondary"
                >
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

                  {courseName.length > 0 && (
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
                  )}
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
