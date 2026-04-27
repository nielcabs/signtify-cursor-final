import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { initializeUserProfile } from './firestoreUtils';
import { deriveUserRole, USER_ROLES } from './adminUtils';

const AuthContext = createContext({});

class ArchivedAccountError extends Error {
  constructor(message = 'This account has been archived. Please contact an administrator.') {
    super(message);
    this.code = 'auth/archived-account';
    this.name = 'ArchivedAccountError';
  }
}

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState(USER_ROLES.STUDENT);
  const [loading, setLoading] = useState(true);

  // Temporary admin bypass controls.
  // Admin can be bypass-only while teacher/student accounts remain Firebase-backed.
  const ENABLE_ADMIN_BYPASS = (import.meta.env.VITE_ENABLE_ADMIN_BYPASS ?? 'true') === 'true';
  const ADMIN_BYPASS_ONLY = (import.meta.env.VITE_ADMIN_BYPASS_ONLY ?? 'true') === 'true';

  // Development admin bypass credentials
  const DEV_ADMIN_EMAIL = 'signtifydev@dev.com';
  const DEV_ADMIN_PASSWORD = 'signtifydev';
  const DEV_SESSION_KEY = 'signtify_dev_admin_session';

  const getDevSessionUser = () => {
    const stored = localStorage.getItem(DEV_SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const startDevSession = (email) => {
    const mockUser = {
      uid: 'dev-admin-uid',
      email,
      displayName: 'Signtify Dev Admin',
      providerId: 'dev-bypass',
    };
    localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(mockUser));
    setCurrentUser(mockUser);
    setIsAdmin(true);
    setRole(USER_ROLES.ADMIN);
  };

  // Register new user
  const signup = async (email, password, displayName) => {
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name in Firebase Auth
      if (displayName) {
        await updateProfile(user, {
          displayName: displayName
        });
      }
      
      // Initialize comprehensive user profile in Firestore
      await initializeUserProfile(user.uid, email, displayName);
      
      return userCredential;
    } catch (error) {
      console.error('Error during signup:', error);
      throw error;
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      // Temporary admin bypass credentials
      if (ENABLE_ADMIN_BYPASS && email === DEV_ADMIN_EMAIL && password === DEV_ADMIN_PASSWORD) {
        startDevSession(email);
        return { user: getDevSessionUser() };
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.isArchived === true) {
          await signOut(auth).catch(() => {});
          throw new ArchivedAccountError();
        }
        await setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      } else {
        // If user document doesn't exist (legacy users), initialize full profile
        await initializeUserProfile(user.uid, user.email, user.displayName || '');
      }

      return userCredential;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  // Google Sign-In
  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameters for better compatibility
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await initializeUserProfile(user.uid, user.email, user.displayName || '');
      } else {
        const data = userDoc.data();
        if (data.isArchived === true) {
          await signOut(auth).catch(() => {});
          throw new ArchivedAccountError();
        }
        await setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }

      return userCredential;
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      // Re-throw with more context
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up blocked. Please enable pop-ups for this site');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with this email. Please use email/password login.');
      }
      throw error;
    }
  };

  // Reset Password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  };

  // Logout user
  const logout = () => {
    // Clear dev session if present
    localStorage.removeItem(DEV_SESSION_KEY);
    setIsAdmin(false);
    setRole(USER_ROLES.STUDENT);
    setCurrentUser(null);
    return signOut(auth).catch(() => Promise.resolve());
  };

  useEffect(() => {
    // If bypass session exists, prefer it and skip Firebase listener
    const devUser = ENABLE_ADMIN_BYPASS ? getDevSessionUser() : null;
    if (devUser) {
      setCurrentUser(devUser);
      setIsAdmin(true);
      setRole(USER_ROLES.ADMIN);
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.isArchived === true) {
              // Immediately sign archived users back out
              await signOut(auth).catch(() => {});
              setCurrentUser(null);
              setIsAdmin(false);
              setRole(USER_ROLES.STUDENT);
              setLoading(false);
              return;
            }
            const derivedRole = deriveUserRole(data);
            setRole(derivedRole);
            // Temporary mode: only bypass credentials can act as admin.
            setIsAdmin(ADMIN_BYPASS_ONLY ? false : (derivedRole === USER_ROLES.ADMIN));
          } else {
            setRole(USER_ROLES.STUDENT);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('Error loading user profile in AuthContext:', error);
          setRole(USER_ROLES.STUDENT);
          setIsAdmin(false);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setRole(USER_ROLES.STUDENT);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    role,
    isTeacher: role === USER_ROLES.TEACHER,
    isStudent: role === USER_ROLES.STUDENT,
    loading,
    signup,
    login,
    logout,
    googleSignIn,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
