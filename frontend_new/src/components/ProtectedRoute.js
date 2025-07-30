import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth

const ProtectedRoute = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth(); // Use auth context
  const location = useLocation(); // Get current location

  if (isLoadingAuth) {
    // Optional: Show a loading spinner or some placeholder while auth state is being determined
    return <div>Loading authentication status...</div>; 
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />; // Pass location state
  }

  return <Outlet />; // Render the child route component
};

export default ProtectedRoute;
