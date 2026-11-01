"use client";

import type { ListeningCourse } from "@/types/listening";
import type { Key } from "@heroui/react";

import {
  ArrowRotateLeft,
  BookmarkFill,
  BookOpen,
  ChevronRight,
  CircleExclamation,
  ClockArrowRotateLeft,
  Headphones,
  ListUl,
  MusicNote,
} from "@gravity-ui/icons";
import {
  Accordion,
  Button,
  Card,
  Chip,
  Skeleton,
  Spinner,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import GlassCard from "@/components/common/glass-card";
import {
  saveRecentListening,
  useRecentListening,
} from "@/components/listening/use-recent-listening";
import { listeningApi } from "@/lib/api";

function CoursesSkeleton() {
  return (
    <div aria-label="课程加载中" className="flex w-full flex-col gap-4">
      <GlassCard className="overflow-hidden">
        <div className="relative z-[1] flex items-center gap-4 p-6">
          <Skeleton className="size-14 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-36 rounded-lg" />
            <Skeleton className="h-4 w-64 max-w-full rounded-lg" />
          </div>
        </div>
      </GlassCard>
      <GlassCard className="overflow-hidden">
        <div className="relative z-[1] flex items-center justify-between p-5">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Spinner size="sm" />
        </div>
        <div className="relative z-[1] grid gap-3 border-t border-black/5 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function formatRecentTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function ListeningPage() {
  const router = useRouter();
  const { recentLesson, hydrated: recentHydrated } = useRecentListening();
  const [courses, setCourses] = useState<ListeningCourse[]>([]);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [favoriteCountLoading, setFavoriteCountLoading] = useState(true);
  const [favoriteCountError, setFavoriteCountError] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set<Key>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError(null);
    listeningApi
      .getCourses()
      .then((data) => {
        if (ignore) return;
        setCourses(data);
        setExpandedKeys(new Set<Key>(data.map((course) => course.id)));
      })
      .catch((reason: unknown) => {
        if (ignore) return;
        setCourses([]);
        setExpandedKeys(new Set<Key>());
        setError(reason instanceof Error ? reason.message : "课程加载失败");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadVersion]);

  useEffect(() => {
    let ignore = false;

    setFavoriteCountLoading(true);
    setFavoriteCountError(false);
    listeningApi
      .getFavoriteCount()
      .then((data) => {
        if (!ignore) setFavoriteCount(data.count);
      })
      .catch(() => {
        if (!ignore) {
          setFavoriteCount(null);
          setFavoriteCountError(true);
        }
      })
      .finally(() => {
        if (!ignore) setFavoriteCountLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const openSubCourse = (
    subCourseId: number,
    name: string,
    courseId: number,
    courseName: string,
  ) => {
    const params = new URLSearchParams({
      subCourseId: String(subCourseId),
      name,
      courseId: String(courseId),
      courseName,
    });

    router.push(`/listening/learn?${params.toString()}`);
  };

  const openRecentLesson = () => {
    if (!recentLesson) return;

    saveRecentListening({
      courseId: recentLesson.courseId,
      courseName: recentLesson.courseName,
      subCourseId: recentLesson.subCourseId,
      subCourseName: recentLesson.subCourseName,
      lessonId: recentLesson.lessonId,
      lessonTitle: recentLesson.lessonTitle,
    });
    const params = new URLSearchParams({
      subCourseId: String(recentLesson.subCourseId),
      name: recentLesson.subCourseName,
      courseId: String(recentLesson.courseId),
      courseName: recentLesson.courseName,
      lessonId: String(recentLesson.lessonId),
    });

    router.push(`/listening/learn?${params.toString()}`);
  };

  const subCourseCount = courses.reduce(
    (total, course) => total + course.subCourses.length,
    0,
  );

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-4"
      data-glass-continuous-scroll=""
    >
     

      <section
        aria-label="收藏与最近学习"
        className="grid w-full gap-4 md:grid-cols-2"
      >
        <GlassCard className="overflow-hidden" data-glass-no-promotion="">
          <button
            className="group relative z-[1] flex min-h-36 w-full items-center gap-4 rounded-3xl p-5 text-left outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/5 sm:p-6"
            type="button"
            onClick={() =>
              router.push("/listening/learn?scope=favorites&name=我的收藏")
            }
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <BookmarkFill className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">
                  我的收藏
                </span>
                {favoriteCountLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <Chip color="accent" variant="soft">
                    {favoriteCountError ? "—" : (favoriteCount ?? 0)} 个章节
                  </Chip>
                )}
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                {favoriteCountError
                  ? "收藏数量暂时无法获取，点击进入可重试"
                  : "集中复习已收藏的课程章节"}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
          </button>
        </GlassCard>

        <GlassCard className="overflow-hidden" data-glass-no-promotion="">
          <button
            className="group relative z-[1] flex min-h-36 w-full items-center gap-4 rounded-3xl p-5 text-left outline-none transition-colors enabled:hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default dark:enabled:hover:bg-white/5 sm:p-6"
            disabled={!recentLesson}
            type="button"
            onClick={openRecentLesson}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
              <ClockArrowRotateLeft className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-lg font-semibold text-foreground">
                最近学习
              </span>
              {!recentHydrated ? (
                <span className="mt-3 block space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </span>
              ) : recentLesson ? (
                <>
                  <span className="mt-1 block truncate text-sm font-medium text-foreground">
                    {recentLesson.lessonTitle}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {recentLesson.courseName} · {recentLesson.subCourseName}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    最后学习：{formatRecentTime(recentLesson.lastLearnedAt)}
                  </span>
                </>
              ) : (
                <span className="mt-2 block text-sm leading-6 text-muted">
                  点击任意章节后，会在这里显示学习记录
                </span>
              )}
            </span>
            {recentLesson && (
              <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </GlassCard>
      </section>

      {loading ? (
        <CoursesSkeleton />
      ) : error ? (
        <GlassCard data-glass-navigation-content="">
          <div
            className="relative z-[1] flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center"
            role="alert"
          >
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <h2 className="font-semibold text-foreground">
                暂时无法加载课程
              </h2>
              <p className="mt-1 text-sm text-muted">{error}</p>
            </div>
            <Button
              variant="secondary"
              onPress={() => setReloadVersion((version) => version + 1)}
            >
              <ArrowRotateLeft className="size-4" />
              重新加载
            </Button>
          </div>
        </GlassCard>
      ) : courses.length === 0 ? (
        <GlassCard data-glass-navigation-content="">
          <div className="relative z-[1] flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
            <MusicNote className="size-9 text-muted" />
            <div>
              <h2 className="font-semibold text-foreground">暂无听力课程</h2>
              <p className="mt-1 text-sm text-muted">课程添加后会显示在这里</p>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard
          className="w-full overflow-hidden"
          data-glass-incremental-resize=""
          data-glass-no-promotion=""
        >
          <Accordion
            allowsMultipleExpanded
            className="w-full overflow-hidden rounded-3xl"
            expandedKeys={expandedKeys}
            onExpandedChange={(keys) => setExpandedKeys(new Set<Key>(keys))}
          >
            <div className="relative z-[1] flex items-center gap-2 bg-white/15 px-5 py-4 dark:bg-white/5">
              <ListUl className="size-4 text-muted" />
              <span className="text-sm font-semibold text-foreground">
                课程目录
              </span>
              <span className="text-xs text-muted">可同时展开多个课程</span>
            </div>
            {courses.map((course) => (
              <div key={course.id}>
                <hr className="border-t border-black/5 dark:border-white/5" />
                <Accordion.Item id={course.id}>
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <div className="flex min-w-0 items-center gap-3 py-1">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                          <BookOpen className="size-4" />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-foreground">
                              {course.name}
                            </span>
                            <Chip color="accent" size="sm" variant="soft">
                              {course.subCourses.length}
                            </Chip>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-normal text-muted">
                            {course.folderPrefix || "听力课程"}
                          </p>
                        </div>
                      </div>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      {course.subCourses.length === 0 ? (
                        <div className="rounded-2xl bg-white/20 px-4 py-8 text-center text-sm text-muted dark:bg-black/10">
                          该课程下暂无册次
                        </div>
                      ) : (
                        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {[...course.subCourses]
                            .sort(
                              (first, second) =>
                                first.sortOrder - second.sortOrder ||
                                first.id - second.id,
                            )
                            .map((subCourse) => (
                              <Card
                                key={subCourse.id}
                                className="group gap-3 overflow-hidden rounded-2xl bg-white/35 shadow-none transition-colors hover:bg-white/50 dark:bg-black/15 dark:hover:bg-black/25"
                                variant="transparent"
                              >
                                <Card.Header className="flex-row items-start gap-3 p-4 pb-0">
                                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                    <Headphones className="size-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <Card.Title className="truncate text-base">
                                      {subCourse.name}
                                    </Card.Title>
                                    <Card.Description className="mt-1 truncate">
                                      {subCourse.folderName || course.name}
                                    </Card.Description>
                                  </div>
                                </Card.Header>
                                <Card.Footer className="p-4 pt-1">
                                  <Button
                                    className="w-full justify-between"
                                    variant="secondary"
                                    onPress={() =>
                                      openSubCourse(
                                        subCourse.id,
                                        subCourse.name,
                                        course.id,
                                        course.name,
                                      )
                                    }
                                  >
                                    查看详情 · {subCourse.lessonCount} 个章节
                                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                                  </Button>
                                </Card.Footer>
                              </Card>
                            ))}
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </div>
            ))}
          </Accordion>
        </GlassCard>
      )}
    </div>
  );
}
