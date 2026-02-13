// src/App.jsx
import { Suspense, lazy, useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { useAuth } from './hooks/useAuth';

const Layout = lazy(() => import('./components/Layout/Layout'));
const Login = lazy(() => import('./components/Auth/Login'));
const Feed = lazy(() => import('./components/Feed/Feed'));
const PublicFeed = lazy(() => import('./components/Feed/PublicFeed'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const Friends = lazy(() => import('./components/Friends/Friends'));
const Notifications = lazy(() => import('./components/Notifications/Notifications'));
const Discover = lazy(() => import('./components/Discover/Discover'));
const Groups = lazy(() => import('./components/Groups/Groups'));
const GroupDetail = lazy(() => import('./components/Groups/GroupDetail'));
const Moderation = lazy(() => import('./components/Moderation/Moderation'));

// Email components
const EmailSignup = lazy(() => import('./components/Email/EmailSignup'));
const EmailLogin = lazy(() => import('./components/Email/EmailLogin'));
const Webmail = lazy(() => import('./components/Email/Webmail'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? children : <Navigate to="/login" />;
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

function App() {
  useEffect(() => {
    const preloads = [
      import('./components/Layout/Layout'),
      import('./components/Feed/Feed'),
      import('./components/Profile/Profile'),
      import('./components/Friends/Friends'),
      import('./components/Notifications/Notifications'),
      import('./components/Discover/Discover'),
      import('./components/Groups/Groups'),
      import('./components/Auth/Login'),
      import('./components/Email/EmailSignup'),
      import('./components/Email/Webmail')
    ];
    preloads.forEach((promise) => promise.catch(() => {}));
  }, []);

  return (
    <AuthProvider>
      <MemoryRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/email/signup" element={<EmailSignup />} />
            <Route path="/email/login" element={<EmailLogin />} />
            <Route path="/email" element={<Webmail />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Feed />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/:handle"
              element={
                <PrivateRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <PrivateRoute>
                  <Layout>
                    <Friends />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/videos"
              element={
                <PrivateRoute>
                  <Layout>
                    <div className="coming-soon">🎥 Videos coming soon</div>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/discover"
              element={
                <PrivateRoute>
                  <Layout>
                    <Discover />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <PrivateRoute>
                  <Layout>
                    <Groups />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/:groupId"
              element={
                <PrivateRoute>
                  <GroupDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/moderation"
              element={
                <PrivateRoute>
                  <Layout>
                    <Moderation />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/public"
              element={
                <PrivateRoute>
                  <Layout>
                    <PublicFeed />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </AuthProvider>
  );
}

export default App;