import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import LandingPage from './components/LandingPage';
import { AuthProvider } from './context/AuthContext'; // Import AuthProvider
import LoginPage from './components/LoginPage'; // Import LoginPage
import SignupPage from './components/SignupPage'; // Import SignupPage
import DocUploadPage from './components/DocUploadPage';
import ChatPage from './components/ChatPage';
import ChatWidgetView from './components/ChatWidgetView'; // Import the new ChatWidgetView
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import IntegrationsPage from './components/IntegrationsPage'; // Import IntegrationsPage
// Navbar is imported and used within each page component like LandingPage, AuthPage etc.

function App() {
  return (
    <AuthProvider> { /* Wrap everything with AuthProvider */ }
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} /> { /* Use LoginPage */ }
            <Route path="/signup" element={<SignupPage />} /> { /* Use SignupPage */ }
            
            {/* Chat route is now public */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat-widget" element={<ChatWidgetView />} /> {/* Add route for embeddable chat widget view */}

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/documents" element={<DocUploadPage />} /> 
              <Route path="/integrations" element={<IntegrationsPage />} /> {/* Add IntegrationsPage route */}
            </Route>
            
            {/* Fallback for unmatched routes - redirect to home or a NotFoundPage */}
            <Route path="*" element={<LandingPage />} /> 
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
