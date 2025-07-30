import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ADK_API_BASE_URL } from '../config';
import Navbar from './Navbar';
import './AuthPage.css'; // Ensure this CSS file contains the old styles

const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${ADK_API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
          access_code: accessCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'Signup successful! Please login.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.detail || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during signup. Please check your connection.');
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
          <h2>Sign Up</h2>
          {error && <p className="auth-message auth-error-message">{error}</p>}
          {successMessage && <p className="auth-message auth-success-message">{successMessage}</p>}
          <form onSubmit={handleSubmit} className="auth-form-fields">
            <div className="auth-input-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Choose a username"
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
                placeholder="Create a password"
              />
            </div>
            <div className="auth-input-field">
              <label htmlFor="accessCode">Access Code</label>
              <input
                type="text" 
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                placeholder="Enter your access code"
              />
            </div>
            <button type="submit" className="auth-action-button" disabled={isLoading}>
              {isLoading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          <p className="auth-switch-prompt">
            Already have an account? <Link to="/login" className="auth-switch-link">Login</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
