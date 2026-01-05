import React from "react";
import "./App.css";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function MainContent() {
  const { currentUser, logout, userRole } = useAuth();

  if (!currentUser) {
    return <Login />;
  }

  return <Dashboard onLogout={logout} userRole={userRole} />;
}

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;