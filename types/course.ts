/**
 * 课程模块相关类型
 * 对应后端 /api/Course 路由
 */

export interface CourseInfo {
  courseId: number;
  courseName: string;
  isMyCourse: boolean;
  wordsCount: number;
  notDoneCount: number;
  doneCount: number;
  notLearned: number;
  percentage: string;
}

export interface CategoryInfo {
  id: number;
  name: string;
  isMy: boolean;
  isLearn: boolean;
  courseInfos: CourseInfo[];
}

export interface MyCategoryContent {
  categoryInfos: CategoryInfo[];
  myCategoryInfos: CategoryInfo[];
  newWord: CourseInfo;
  strengthenWord: CourseInfo;
}
