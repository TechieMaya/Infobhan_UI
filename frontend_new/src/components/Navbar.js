import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, logout } = useAuth(); // Use context

  const handleLogout = async () => {
    await logout(); // Call logout from context
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Techie<span className="navbar-brand-maya">Maya</span></Link>
      </div>
      <ul className="navbar-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/documents">Doc Upload</Link></li>
        <li><Link to="/chat">Chat</Link></li>
        {isAuthenticated ? (
          <>
            <li className="logout-menu-item">
              <button onClick={handleLogout} className="logout-button">Logout</button>
              {currentUser && currentUser.username && <span className="logout-username">({currentUser.username})</span>}
            </li>
          </>
        ) : (
          <>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup">Sign Up</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
