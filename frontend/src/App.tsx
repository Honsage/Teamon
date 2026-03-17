import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AuthLayout from "./auth/AuthLayout";
import MessengerLayout from "./messenger/MessengerLayout";

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children
}) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }
  return children;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth/*" element={<AuthLayout />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <MessengerLayout />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

