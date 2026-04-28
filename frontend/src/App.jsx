import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { CourseProvider } from "./context/CourseContext";
import { useAuth } from "./context/AuthContext";
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
import CoursesPage from "./pages/CoursesPage";
import RegisterSuccessPage from "./pages/RegisterSuccessPage";
import CourseFeedPage from "./pages/CourseFeedPage";
import UserProfilePage from "./pages/UserProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import CourseMessagesPage from "./pages/CourseMessagesPage";
import PostDetailPage from "./pages/PostDetailPage";
import PostAnalyticsPage from "./pages/PostAnalyticsPage";
import DashboardPage from "./pages/admin/DashboardPage";
import EngagementDistributionDetailPage from "./pages/admin/EngagementDistributionDetailPage";
import SentimentAnalysisDetailPage from "./pages/admin/SentimentAnalysisDetailPage";
import CreateCoursePage from "./pages/admin/CreateCoursePage";
import CourseManagePage from "./pages/admin/CourseManagePage";
import CourseDashboardPage from "./pages/admin/CourseDashboardPage";
import CourseHashtagDashboardPage from "./pages/admin/CourseHashtagDashboardPage";
import CourseStudentDashboardPage from "./pages/admin/CourseStudentDashboardPage";
import CourseAIUsersPage from "./pages/admin/CourseAIUsersPage";
import PeopleFollowsPage from "./pages/PeopleFollowsPage";
import OnboardingProfilePage from "./pages/OnboardingProfilePage";
import StudentAnalysisPage from "./pages/StudentAnalysisPage";
import CourseStudentsPage from "./pages/admin/CourseStudentsPage.jsx";
import SearchPage from "./pages/SearchPage";
import CourseMaterialsPage from "./pages/CourseMaterialsPage";
import CourseOverviewPage from "./pages/CourseOverviewPage";
import CourseMembersPage from "./pages/CourseMembersPage";
import CourseSettingsPage from "./pages/CourseSettingsPage";
import { isTeacher } from "./lib/access";
import AIUserCenterPage from "./pages/admin/AIUserCenterPage";

export default function App() {
  function RequireTeacher({ children }) {
    const { authUser, authCheckComplete } = useAuth();
    if (!authCheckComplete) return null;
    if (!authUser) return <Navigate to="/login" replace />;
    if (!isTeacher(authUser)) return <Navigate to="/courses" replace />;
    return children;
  }

  function MyProfileRedirect() {
    const { authUser } = useAuth();
    if (!authUser) {
      return <Navigate to="/login" replace />;
    }
    const userId = authUser.id;
    return <Navigate to={`/people/${userId}`} replace />;
  }
  return (
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <CourseProvider>
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
          <Route path="/studenthome" element={<Navigate to="/courses" replace />} />
          <Route path="/student/analysis" element={<Navigate to="/courses" replace />} />
          <Route path="/profile" element={<MyProfileRedirect />} />
          <Route path="/profile/edit" element={<ProfilePage />} />
          <Route
            path="/dashboard/courses/:courseId/students"
            element={
              <RequireTeacher>
                <CourseStudentsPage />
              </RequireTeacher>
            }
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
          <Route path="/search" element={<SearchPage />} />
          <Route path="/courses/:courseId" element={<CourseOverviewPage />} />
          <Route path="/courses/:courseId/community" element={<CourseFeedPage />} />
          <Route
            path="/courses/:courseId/messages"
            element={<CourseMessagesPage />}
          />
          <Route
            path="/courses/:courseId/materials"
            element={<CourseMaterialsPage />}
          />
          <Route path="/courses/:courseId/members" element={<CourseMembersPage />} />
          <Route path="/courses/:courseId/settings" element={<CourseSettingsPage />} />
          <Route
            path="/courses/:courseId/ai-users"
            element={
              <RequireTeacher>
                <CourseAIUsersPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/courses/:courseId/hashtags/:hashtag"
            element={<CourseFeedPage />}
          />
          <Route
            path="/courses/manage"
            element={
              <RequireTeacher>
                <CourseManagePage />
              </RequireTeacher>
            }
          />
          <Route
            path="/courses/create"
            element={
              <RequireTeacher>
                <CreateCoursePage />
              </RequireTeacher>
            }
          />
          <Route
            path="/ai-users"
            element={
              <RequireTeacher>
                <AIUserCenterPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/courses/:courseId/posts/:postId"
            element={<PostDetailPage />}
          />
          <Route
            path="/courses/:courseId/posts/:postId/analytics"
            element={<PostAnalyticsPage />}
          />
          <Route
            path="/dashboard"
            element={
              <RequireTeacher>
                <DashboardPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/dashboard/engagement-distribution"
            element={
              <RequireTeacher>
                <EngagementDistributionDetailPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/dashboard/sentiment-analysis"
            element={
              <RequireTeacher>
                <SentimentAnalysisDetailPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/dashboard/courses/:courseId"
            element={
              <RequireTeacher>
                <CourseDashboardPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/dashboard/courses/:courseId/hashtags/:hashtag"
            element={
              <RequireTeacher>
                <CourseHashtagDashboardPage />
              </RequireTeacher>
            }
          />
          <Route
            path="/dashboard/courses/:courseId/students/:studentId"
            element={
              <RequireTeacher>
                <CourseStudentDashboardPage />
              </RequireTeacher>
            }
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
          </CourseProvider>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
