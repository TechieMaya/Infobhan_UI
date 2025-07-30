import React from 'react';
import Navbar from './Navbar';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <Navbar />
      <header className="hero-section">
        <div className="hero-content-wrapper">
          <h1>Welcome to <span className="brand-highlight">TechieMaya</span></h1>
          <p>Your intelligent assistant, Maya, is here to help.</p>
          {/* Add more content or call to action buttons here */}
        </div>
      </header>
      {/* You can add more sections to the landing page below */}
    </div>
  );
};

export default LandingPage;
