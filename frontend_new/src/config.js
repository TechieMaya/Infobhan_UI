// src/config.js

// Base URL for the backend API.
// All non-ADK and ADK endpoints are relative to this.
// Example: http://localhost:8000
export const ADK_API_BASE_URL = process.env.REACT_APP_ADK_API_BASE_URL || 'http://127.0.0.1:8000';

// Name of the root ADK agent module.
// Used for ADK session initialization and message sending.
export const AGENT_MODULE_NAME = process.env.REACT_APP_AGENT_MODULE_NAME || 'maya_agent';

// Default access code for signup, if required by backend and not user-input
export const DEFAULT_ACCESS_CODE = process.env.REACT_APP_DEFAULT_ACCESS_CODE || 'TEST_ACCESS_CODE'; // Replace with actual or remove if user inputs
