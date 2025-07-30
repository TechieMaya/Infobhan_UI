import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import './AuthPage.css';
import { useNavigate } from 'react-router-dom';
import { ADK_API_BASE_URL, DEFAULT_ACCESS_CODE } from '../config';

const AuthPage = ({ initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  const handleAuthSuccess = (token, user) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('username', user); // Store username for ADK calls
    setMessage(isLogin ? 'Login successful! Redirecting...' : 'Signup successful! Please login.');
    // Dispatch a custom event to notify Navbar and other components about auth change
    window.dispatchEvent(new Event('authChange'));
    if (isLogin) {
      navigate('/documents'); // Navigate to Doc Upload page on successful login
    } else {
      setIsLogin(true); // Switch to login form after signup
      setUsername(''); // Clear username for login form
      setPassword(''); // Clear password for login form
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages

    const payload = {
      username,
      password,
    };

    let url = '';
    let fetchOptions = {};

    if (isLogin) {
      url = `${ADK_API_BASE_URL}/login`;
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload), // payload already contains username and password
      };
    } else {
      url = `${ADK_API_BASE_URL}/signup`;
      payload.access_code = accessCode || DEFAULT_ACCESS_CODE; // Use state or default
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      };
    }

    try {
      const response = await fetch(url, fetchOptions);

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          if (data.access_token) {
            handleAuthSuccess(data.access_token, username);
          } else {
            setMessage('Login failed: No token received.');
          }
        } else { // Signup
          setMessage(data.message || 'User created successfully. Please login.');
          setIsLogin(true); // Switch to login form
          setUsername(''); // Clear username for login form
          setPassword(''); // Clear password for login form
          setAccessCode(''); // Clear access code
        }
      } else {
        // Handle 422 Unprocessable Entity specifically for more detailed errors
        if (response.status === 422 && data.detail) {
          if (Array.isArray(data.detail)) {
            // Pydantic errors often come as an array of error objects
            const errorMessages = data.detail.map(err => `${err.loc && err.loc.join(' -> ')}: ${err.msg}`).join('; ');
            setMessage(`Signup failed: ${errorMessages}`);
          } else if (typeof data.detail === 'string') {
            setMessage(`Signup failed: ${data.detail}`);
          } else {
            setMessage(`Signup failed: Invalid input. Please check your details.`);
          }
        } else {
          setMessage(data.detail || `An error occurred: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setMessage(`Network error or server is unreachable: ${error.message}`);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setMessage(''); // Clear messages when toggling mode
    setUsername('');
    setPassword('');
    setAccessCode('');
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
          {message && <p className={`message ${message.includes('successful') ? 'message-success' : 'message-error'}`}>{message}</p>}
          
          <div className="form-group">
            <label htmlFor="username">{isLogin ? 'Username' : 'Choose a Username'}</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          {/* Email field - only for signup, and marked as optional for auth (REMOVED as per backend docs not requiring email) */}
          {/* {!isLogin && (
            <div className="form-group">
              <label htmlFor="email-signup">Email (Optional)</label>
              <input type="email" id="email-signup" name="email" />
            </div>
          )} */}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          {!isLogin && (
             <div className="form-group">
              <label htmlFor="access_code">Access Code</label>
              <input 
                type="text" 
                id="access_code" 
                name="access_code" 
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder={`Default: ${DEFAULT_ACCESS_CODE}`}
                required 
              />
            </div>
          )}
          <button type="submit" className="auth-button">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="toggle-auth">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button onClick={toggleAuthMode} className="toggle-button">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
