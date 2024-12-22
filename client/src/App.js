import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import TextEditor from "./components/TextEditor";
import Login from "./pages/Login";
import HomePage from "./pages/HomePage";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate 
      to={`/login?redirect=${encodeURIComponent(location.pathname)}`} 
      state={{ from: location }} 
      replace 
    />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <RequireAuth>
                <TextEditor />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;