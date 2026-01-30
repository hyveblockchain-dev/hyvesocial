// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import Layout from './components/Layout/Layout';
import Feed from './components/Feed/Feed';
import Profile from './components/Profile/Profile';
import './styles/App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout><Feed /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/profile/:address" element={
            <ProtectedRoute>
              <Layout><Profile /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/videos" element={
            <ProtectedRoute>
              <Layout><div>Videos - Coming Soon</div></Layout>
            </ProtectedRoute>
          } />

          <Route path="/friends" element={
            <ProtectedRoute>
              <Layout><div>Friends - Coming Soon</div></Layout>
            </ProtectedRoute>
          } />

          <Route path="/discover" element={
            <ProtectedRoute>
              <Layout><div>Discover - Coming Soon</div></Layout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;