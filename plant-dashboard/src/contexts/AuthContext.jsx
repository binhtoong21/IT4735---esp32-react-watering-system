/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, database } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { ref, get, child } from "firebase/database";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' | 'user'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // Fetch User Role from Database
        try {
          const snapshot = await get(child(ref(database), `users/${user.uid}`));
          if (snapshot.exists()) {
            const userData = snapshot.val();
            // Check if user is disabled
            if (userData.isDisabled) {
              await signOut(auth);
              setUserRole(null);
              setCurrentUser(null);
              alert("Tài khoản của bạn đã bị vô hiệu hóa.");
            } else {
              setUserRole(userData.role || "user");
              setCurrentUser(user);
            }
          } else {
            // New user or no record -> Default to 'user' or handle accordingly
            // For now, let's treat them as a regular user with no special role info
            setUserRole("user");
            setCurrentUser(user);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole("user");
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  const value = {
    currentUser,
    userRole,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
