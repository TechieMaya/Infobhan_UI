import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ADK_API_BASE_URL } from '../config'; // Assuming your API base URL is here

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start as true
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));

  // Function to verify token with backend and set user
  const verifyTokenAndSetUser = useCallback(async (token) => {
    if (!token) {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      return;
    }

    setIsLoadingAuth(true);
    try {
      const response = await fetch(`${ADK_API_BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('authToken', token); // Re-affirm token
        localStorage.setItem('username', userData.username); // Store/update username
      } else {
        // Token is invalid or expired
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        if (response.status === 401) {
          console.warn("Auth: Token validation failed (401).");
        } else {
          console.warn(`Auth: Token validation error, status: ${response.status}`);
        }
      }
    } catch (error) {
      console.error("Auth: Error verifying token:", error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  // Effect to run on initial app load to check existing token
  useEffect(() => {
    const tokenFromStorage = localStorage.getItem('authToken');
    if (tokenFromStorage) {
      setAuthToken(tokenFromStorage);
      verifyTokenAndSetUser(tokenFromStorage);
    } else {
      setIsLoadingAuth(false); // No token, so not loading
    }
  }, [verifyTokenAndSetUser]);

  const login = async (username, password) => {
    setIsLoadingAuth(true);
    try {
      const response = await fetch(`${ADK_API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setAuthToken(data.access_token);
        await verifyTokenAndSetUser(data.access_token); // Verify and set user
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({ detail: "Login failed." }));
        setIsLoadingAuth(false);
        return { success: false, error: errorData.detail || "Login failed" };
      }
    } catch (error) {
      console.error("Auth: Login error:", error);
      setIsLoadingAuth(false);
      return { success: false, error: "Login request failed" };
    }
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    // Optionally, could also call a backend /logout endpoint if you implement one
    // to invalidate the token server-side (if your JWTs are stateful, e.g., in a denylist)
    console.log("Auth: User logged out.");
  }, []);

  const value = {
    currentUser,
    isAuthenticated,
    isLoadingAuth,
    authToken,
    login,
    logout,
    verifyTokenAndSetUser // Expose if needed for manual re-verification elsewhere
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
