import { createContext, useContext, useMemo } from "react";
import { useApp } from "./AppContext";

const CourseContext = createContext(null);

export function CourseProvider({ children }) {
  const app = useApp();

  const courseValue = useMemo(
    () => ({
      courses: app.courses,
      courseStatus: app.courseStatus,
      joinCode: app.joinCode,
      setJoinCode: app.setJoinCode,
      fetchCourses: app.fetchCourses,
      joinCourse: app.joinCourse,
      loadCourseProfile: app.loadCourseProfile,
      saveCourseProfile: app.saveCourseProfile,
    }),
    [app]
  );

  return (
    <CourseContext.Provider value={courseValue}>{children}</CourseContext.Provider>
  );
}

export function useCourse() {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error("useCourse must be used within CourseProvider");
  }
  return context;
}
