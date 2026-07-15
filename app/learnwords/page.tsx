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
  GraduationCap,
  Plus,
  Gear,
  BookOpen,
  Flame,
  ClockArrowRotateLeft,
} from "@gravity-ui/icons";

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
    <Card className="word-search-glass !bg-transparent rounded-2xl">
      <Card.Header className="gap-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32 rounded-lg" />
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col items-center gap-4">
        <div className="flex flex-1 flex-col gap-3 m-3">
          <Skeleton className="size-[190px] shrink-0 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-3 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-lg" />
              <Skeleton className="h-5 w-8 rounded-lg" />
              <Skeleton className="h-4 w-10 rounded-lg" />
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
  const [addingCourse, setAddingCourse] = useState(false);
  const [addCourseError, setAddCourseError] = useState<string | null>(null);

  // 两个 Accordion（我的课程 / 精选课程）各自的展开项
  const [expandedMap, setExpandedMap] = useState<Record<"full" | "remove", Set<Key>>>({
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
      setAvailableExpandedKeys(
        new Set(categories.filter((item) => item.courseInfos.length > 0).map((item) => item.id)),
      );
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

    setAddingCourse(true);
    setAddCourseError(null);

    try {
      await courseApi.insertMyCourse(selectedCourse.courseId);
      setAddConfirmOpen(false);
      setSelectedCourse(null);
      await Promise.all([loadData(), loadAvailableCourses()]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("添加课程失败:", err);
      setAddCourseError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAddingCourse(false);
    }
  };

  const renderCategoryAccordion = (
    categories: CategoryInfo[],
    menuMode: "full" | "remove",
  ) => (
    <Accordion
      allowsMultipleExpanded
      className="w-full overflow-hidden rounded-[25px]  word-search-glass !bg-transparent"
      expandedKeys={expandedMap[menuMode]}
      onExpandedChange={(keys) =>
        setExpandedMap((prev) => ({ ...prev, [menuMode]: keys as Set<Key> }))
      }
    >
      <div
        className="flex items-center gap-1.5 px-6 py-3 bg-white/15 dark:bg-black/15"
      >
        <button
          className="text-foreground text-base font-semibold"
          type="button"
          onClick={() =>
            setExpandedMap((prev) => ({
              ...prev,
              [menuMode]: new Set<Key>(),
            }))
          }
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
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 pt-[2px]">
                  {cat.courseInfos.map((course) => (
                    <Card
                      key={course.courseId}
                      className="group relative overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-0.5"
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
          <div className="  grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="word-search-glass group relative overflow-hidden !bg-transparent rounded-2xl transition-transform duration-300 hover:-translate-y-0.5">
              {/* 生词本 · 蓝青主题装饰 */}
              <div className="pointer-events-none absolute -top-12 -right-12 z-[-1] size-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.22),rgba(56,189,248,0.08)_45%,transparent_72%)] blur-xl transition-opacity duration-300 group-hover:opacity-90" />
              <div className="pointer-events-none absolute top-4 right-4 z-[-1] flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/15 to-cyan-300/5 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                <BookOpen className="size-8 text-sky-500/70 drop-shadow-sm dark:text-sky-300/70" />
              </div>
              <PieChartWithBreakdownDemo
                courseName={data?.newWord.courseName}
                doneCount={data?.newWord.doneCount}
                notDoneCount={data?.newWord.notDoneCount}
                notLearned={data?.newWord.notLearned}
                menuMode="none"
              />
            </Card>
            <Card className="word-search-glass group relative overflow-hidden !bg-transparent rounded-2xl transition-transform duration-300 hover:-translate-y-0.5">
              {/* 强化区 · 橙红主题装饰 */}
              <div className="pointer-events-none absolute -top-12 -right-12 z-[-1] size-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.22),rgba(244,63,94,0.08)_45%,transparent_72%)] blur-xl transition-opacity duration-300 group-hover:opacity-90" />
              <div className="pointer-events-none absolute top-4 right-4 z-[-1] flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400/15 to-rose-400/5 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                <Flame className="size-8 text-orange-500/75 drop-shadow-sm dark:text-orange-300/70" />
              </div>
              <PieChartWithBreakdownDemo
                courseName={data?.strengthenWord.courseName}
                doneCount={data?.strengthenWord.doneCount}
                notDoneCount={data?.strengthenWord.notDoneCount}
                notLearned={data?.strengthenWord.notLearned}
                menuMode="none"
              />
            </Card>
            <Card className="word-search-glass group relative overflow-hidden !bg-transparent rounded-2xl transition-transform duration-300 hover:-translate-y-0.5">
              {/* 最后学习课程 · 紫靛主题装饰 */}
              <div className="pointer-events-none absolute -top-12 -right-12 z-[-1] size-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.22),rgba(99,102,241,0.08)_45%,transparent_72%)] blur-xl transition-opacity duration-300 group-hover:opacity-90" />
              <div className="pointer-events-none absolute top-4 right-4 z-[-1] flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/15 to-indigo-400/5 shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                <ClockArrowRotateLeft className="size-8 text-violet-500/75 drop-shadow-sm dark:text-violet-300/70" />
              </div>
              {data?.lastCourse.courseId ? (
                <PieChartWithBreakdownDemo
                  courseName={data?.lastCourse.courseName}
                  doneCount={data?.lastCourse.doneCount}
                  notDoneCount={data?.lastCourse.notDoneCount}
                  notLearned={data?.lastCourse.notLearned}
                  menuMode="none"
                />
              ) : (
                <div className="flex  h-full w-full items-center justify-center text-sm text-muted">
                  暂无学习记录
                </div>
              )}
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

      {/* 精选课程选择弹框 */}
      <Modal.Backdrop
        isOpen={availableCourseModalOpen}
        variant="blur"
        onOpenChange={setAvailableCourseModalOpen}
      >
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Books className="size-5" />
              </Modal.Icon>
              <Modal.Heading>添加精选课程</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                按分类查看课程，并将需要学习的课程加入列表
              </p>
            </Modal.Header>
            <Modal.Body>
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
                <ScrollShadow className="max-h-[60vh] overflow-y-auto pr-1">
                  <Accordion
                    allowsMultipleExpanded
                    expandedKeys={availableExpandedKeys}
                    onExpandedChange={(keys) =>
                      setAvailableExpandedKeys(keys as Set<Key>)
                    }
                  >
                    {availableCategories
                      .filter((category) => category.courseInfos.length > 0)
                      .map((category) => (
                        <Accordion.Item key={category.id} id={category.id}>
                          <Accordion.Heading>
                            <Accordion.Trigger>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="size-4 text-muted" />
                                <span className="font-medium">{category.name}</span>
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
                                  <div
                                    key={course.courseId}
                                    className="flex min-h-14 items-center justify-between gap-4 px-1 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-foreground">
                                        {course.courseName}
                                      </p>
                                      <p className="mt-1 text-xs tabular-nums text-muted">
                                        {course.wordsCount} 个单词
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onPress={() => openAddCourseConfirm(course)}
                                    >
                                      <Plus className="size-4" />
                                      添加
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </Accordion.Body>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                  </Accordion>
                </ScrollShadow>
              )}
            </Modal.Body>
            <Modal.Footer>
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
              <Button isDisabled={addingCourse} onPress={handleAddCourse}>
                {addingCourse ? "添加中..." : "确定"}
              </Button>
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
