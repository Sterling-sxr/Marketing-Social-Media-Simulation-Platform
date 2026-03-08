import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import ToastHost from "./components/ToastHost";
import HomePage from "./pages/HomePage";
import RegisterEmailPage from "./pages/RegisterEmailPage";
import RegisterVerifyPage from "./pages/RegisterVerifyPage";
import RegisterPasswordPage from "./pages/RegisterPasswordPage";
import LoginPage from "./pages/LoginPage";
import ResetEmailPage from "./pages/ResetEmailPage";
import ResetVerifyPage from "./pages/ResetVerifyPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ResetSuccessPage from "./pages/ResetSuccessPage";
import ProfilePage from "./pages/ProfilePage";
import { useApp } from "./context/AppContext";
import CoursesPage from "./pages/CoursesPage";
import RegisterSuccessPage from "./pages/RegisterSuccessPage";
import CourseFeedPage from "./pages/CourseFeedPage";
import UserProfilePage from "./pages/UserProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import PostDetailPage from "./pages/PostDetailPage";
import PostAnalyticsPage from "./pages/PostAnalyticsPage";
import DashboardPage from "./pages/admin/DashboardPage";
import CreateCoursePage from "./pages/admin/CreateCoursePage";
import CourseManagePage from "./pages/admin/CourseManagePage";
import CourseDashboardPage from "./pages/admin/CourseDashboardPage";
import CourseHashtagDashboardPage from "./pages/admin/CourseHashtagDashboardPage";
import CourseStudentDashboardPage from "./pages/admin/CourseStudentDashboardPage";
import CourseAIUsersPage from "./pages/admin/CourseAIUsersPage";
import PeopleFollowsPage from "./pages/PeopleFollowsPage";
import OnboardingProfilePage from "./pages/OnboardingProfilePage";
import StudentHomePage from "./pages/StudentHomePage";
import StudentAnalysisPage from "./pages/StudentAnalysisPage";
import CourseStudentsPage from "./pages/admin/CourseStudentsPage.jsx";

export default function App() {
  function MyProfileRedirect() {
    const { authUser } = useApp();
    if (!authUser) {
      return <Navigate to="/login" replace />;
    }
    const userId = authUser.id;
    return <Navigate to={`/people/${userId}`} replace />;
  }
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register/email" element={<RegisterEmailPage />} />
          <Route path="/register/verify" element={<RegisterVerifyPage />} />
          <Route path="/register/password" element={<RegisterPasswordPage />} />
          <Route path="/register/success" element={<RegisterSuccessPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset/email" element={<ResetEmailPage />} />
          <Route path="/reset/verify" element={<ResetVerifyPage />} />
          <Route path="/reset/password" element={<ResetPasswordPage />} />
          <Route path="/reset/success" element={<ResetSuccessPage />} />
          <Route path="/studenthome" element={<StudentHomePage />} />
          <Route path="/student/analysis" element={<StudentAnalysisPage />} />
          <Route path="/profile" element={<MyProfileRedirect />} />
          <Route path="/profile/edit" element={<ProfilePage />} />
          <Route
            path="/dashboard/courses/:courseId/students"
            element={<CourseStudentsPage />}
          />
          <Route
            path="/onboarding/profile"
            element={<OnboardingProfilePage />}
          />
          <Route
            path="/courses/:courseId/profile"
            element={<OnboardingProfilePage />}
          />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<CourseFeedPage />} />
          <Route
            path="/courses/:courseId/ai-users"
            element={<CourseAIUsersPage />}
          />
          <Route
            path="/courses/:courseId/hashtags/:hashtag"
            element={<CourseFeedPage />}
          />
          <Route path="/courses/manage" element={<CourseManagePage />} />
          <Route path="/courses/create" element={<CreateCoursePage />} />
          <Route
            path="/courses/:courseId/posts/:postId"
            element={<PostDetailPage />}
          />
          <Route
            path="/courses/:courseId/posts/:postId/analytics"
            element={<PostAnalyticsPage />}
          />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/dashboard/courses/:courseId"
            element={<CourseDashboardPage />}
          />
          <Route
            path="/dashboard/courses/:courseId/hashtags/:hashtag"
            element={<CourseHashtagDashboardPage />}
          />
          <Route
            path="/dashboard/courses/:courseId/students/:studentId"
            element={<CourseStudentDashboardPage />}
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/people/:userId" element={<UserProfilePage />} />
          <Route
            path="/people/:userId/follows"
            element={<PeopleFollowsPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </AppProvider>
    </BrowserRouter>
  );
}
