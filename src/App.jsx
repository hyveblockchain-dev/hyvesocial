// src/App.jsx
import { Suspense, lazy, useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { useAuth } from './hooks/useAuth';

const Layout = lazy(() => import('./components/Layout/Layout'));
const Login = lazy(() => import('./components/Auth/Login'));
const Feed = lazy(() => import('./components/Feed/Feed'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const Friends = lazy(() => import('./components/Friends/Friends'));
const Notifications = lazy(() => import('./components/Notifications/Notifications'));
const Discover = lazy(() => import('./components/Discover/Discover'));
const Groups = lazy(() => import('./components/Groups/Groups'));
const GroupDetail = lazy(() => import('./components/Groups/GroupDetail'));
const Moderation = lazy(() => import('./components/Moderation/Moderation'));

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
      import('./components/Auth/Login')
    ];
    preloads.forEach((promise) => promise.catch(() => {}));
  }, []);

  return (
    <AuthProvider>
      <MemoryRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
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
                  <Layout>
                    <GroupDetail />
                  </Layout>
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
          </Routes>
        </Suspense>
      </MemoryRouter>
    </AuthProvider>
  );
}

export default App;