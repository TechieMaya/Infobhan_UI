import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Changed import
import { ADK_API_BASE_URL } from '../config';
import Navbar from './Navbar';
import './AuthPage.css'; // Ensure this CSS file contains the old styles

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth(); // Changed to use useAuth()
  const navigate = useNavigate();
  const location = useLocation(); // Get location object

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Directly use the login function from AuthContext
      const result = await login(username, password); 

      if (result.success) {
        const from = location.state?.from?.pathname || '/chat'; // Get redirect path or default to /chat
        navigate(from); 
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      // This catch block might be redundant if AuthContext's login handles its own errors
      // and returns a structured error. However, keeping it for network or unexpected issues.
      console.error("Login Page Error:", err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-page-container"> {/* Main container for centering */}
        <div className="auth-form-card"> {/* The central card */}
          <div className="auth-blobs"> {/* Container for blobs */}
            <div className="blob blob-blue"></div>
            <div className="blob blob-green"></div>
          </div>
          <h2>Login</h2>
          {error && <p className="auth-message auth-error-message">{error}</p>}
          <form onSubmit={handleSubmit} className="auth-form-fields">
            <div className="auth-input-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
              />
            </div>
            <div className="auth-input-field">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" className="auth-action-button" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="auth-switch-prompt">
            Don\'t have an account? <Link to="/signup" className="auth-switch-link">Sign Up</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
