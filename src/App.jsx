import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import './App.css';

// Import components
import Navbar from './components/Navbar';
import { ToastProvider } from './components/ui/Toast';

// Import auth
import { AuthProvider } from './auth/AuthContext';
import Login from './auth/Login';
import Register from './auth/Register';
import ForgotPassword from './auth/ForgotPassword';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';
import TeacherRoute from './auth/TeacherRoute';

// Import tutorial
import { TutorialProvider, useTutorial } from './tutorial/TutorialContext';
import TutorialOverlay from './tutorial/TutorialOverlay';

// Import pages
import Home from './pages/Home';
import LessonAlphabet from './pages/LessonAlphabet';
import LessonGreetings from './pages/LessonGreetings';
import LessonDailyConversation from './pages/LessonDailyConversation';
import LessonNumbers from './pages/LessonNumbers';
import Quizzes from './pages/Quizzes';
import Quiz from './pages/Quiz';
import ProficiencyExams from './pages/ProficiencyExams';
import Exam from './pages/Exam';
import Dictionary from './pages/Dictionary';
// // import PracticeGestures from './pages/PracticeGestures'; // Temporarily removed
import MiniQuizAlphabet from './pages/MiniQuizAlphabet';
import MiniQuizGreetings from './pages/MiniQuizGreetings'; // Temporarily removed
import LiveTranslate from './pages/LiveTranslate';
import Profile from './pages/Profile';

// Import admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import LessonManagement from './pages/admin/LessonManagement';
import QuizManagement from './pages/admin/QuizManagement';
import ExamManagement from './pages/admin/ExamManagement';
import DictionaryManagement from './pages/admin/DictionaryManagement';
import ActivityLog from './pages/admin/ActivityLog';

// Import teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';

function TutorialBootstrapper() {
  const location = useLocation();
  const { isLoading, isActive, startMainTourIfFirstTime } = useTutorial();
  const didAttemptRef = useRef(false);

  useEffect(() => {
    // Only auto-start on the Home page after auth is ready.
    if (didAttemptRef.current) return;
    if (isLoading) return;
    if (isActive) return;
    if (location.pathname !== '/') return;

    didAttemptRef.current = true;
    startMainTourIfFirstTime();
  }, [isLoading, isActive, location.pathname, startMainTourIfFirstTime]);

  return null;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
        <TutorialProvider>
          <TutorialBootstrapper />
          <div className="app">
            <Navbar />
            <TutorialOverlay />
            <main className="main-content">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                
                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } />
                <Route path="/lessons/alphabet" element={
                  <ProtectedRoute>
                    <LessonAlphabet />
                  </ProtectedRoute>
                } />
                <Route path="/lessons/greetings" element={
                  <ProtectedRoute>
                    <LessonGreetings />
                  </ProtectedRoute>
                } />
                <Route path="/lessons/daily-conversation" element={
                  <ProtectedRoute>
                    <LessonDailyConversation />
                  </ProtectedRoute>
                } />
                <Route path="/lessons/numbers" element={
                  <ProtectedRoute>
                    <LessonNumbers />
                  </ProtectedRoute>
                } />
                <Route path="/quizzes" element={
                  <ProtectedRoute>
                    <Quizzes />
                  </ProtectedRoute>
                } />
                <Route path="/quiz/:quizId" element={
                  <ProtectedRoute>
                    <Quiz />
                  </ProtectedRoute>
                } />
                <Route path="/mini-quiz/alphabet" element={
                  <ProtectedRoute>
                    <MiniQuizAlphabet />
                  </ProtectedRoute>
                } />
                <Route path="/mini-quiz/greetings" element={
                  <ProtectedRoute>
                    <MiniQuizGreetings />
                  </ProtectedRoute>
                } />
                <Route path="/proficiency-exams" element={
                  <ProtectedRoute>
                    <ProficiencyExams />
                  </ProtectedRoute>
                } />
                <Route path="/exam/:examId" element={
                  <ProtectedRoute>
                    <Exam />
                  </ProtectedRoute>
                } />
                <Route path="/dictionary" element={
                  <ProtectedRoute>
                    <Dictionary />
                  </ProtectedRoute>
                } />
                {/* Temporarily removed Practice Gestures route */}
                {/* <Route path="/practice" element={
                  <ProtectedRoute>
                    <PracticeGestures />
                  </ProtectedRoute>
                } /> */}
                <Route path="/live-translate" element={
                  <ProtectedRoute>
                    <LiveTranslate />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                
                {/* Teacher routes (admins are allowed through TeacherRoute too) */}
                <Route path="/teacher" element={
                  <TeacherRoute>
                    <TeacherDashboard />
                  </TeacherRoute>
                } />

                {/* Admin routes */}
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } />
                <Route path="/admin/users" element={
                  <AdminRoute>
                    <UserManagement />
                  </AdminRoute>
                } />
                {/* Content-management routes: teachers + admins */}
                <Route path="/admin/lessons" element={
                  <TeacherRoute>
                    <LessonManagement />
                  </TeacherRoute>
                } />
                <Route path="/admin/quizzes" element={
                  <TeacherRoute>
                    <QuizManagement />
                  </TeacherRoute>
                } />
                <Route path="/admin/exams" element={
                  <TeacherRoute>
                    <ExamManagement />
                  </TeacherRoute>
                } />
                <Route path="/admin/dictionary" element={
                  <TeacherRoute>
                    <DictionaryManagement />
                  </TeacherRoute>
                } />
                <Route path="/admin/activity-log" element={
                  <AdminRoute>
                    <ActivityLog />
                  </AdminRoute>
                } />
              </Routes>
            </main>
          </div>
        </TutorialProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
