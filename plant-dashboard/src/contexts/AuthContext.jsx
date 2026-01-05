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
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {

      if (user) {

        try {
          const snapshot = await get(child(ref(database), `users/${user.uid}`));
          if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.isDisabled) {
              await signOut(auth);
              setUserRole(null);
              setCurrentUser(null);

            } else {
              setUserRole(userData.role || "user");
              setCurrentUser(user);
            }
          } else {
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

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    

    try {
      const snapshot = await get(child(ref(database), `users/${user.uid}`));
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.isDisabled) {
          await signOut(auth);
          throw new Error("ACCOUNT_LOCKED");
        }
      }
    } catch (error) {
       if (error.message === "ACCOUNT_LOCKED") {
         throw error;
       }
       console.error("Check user status failed:", error);
    }
    
    return result;
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
