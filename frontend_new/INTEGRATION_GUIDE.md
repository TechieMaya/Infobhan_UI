# Frontend Integration Guide for TechieMaya UI

**Version:** 1.0.0
**Date:** May 27, 2025

## 1. Overview

This document provides guidance for integrating the new React-based frontend (located in `client_upload/frontend_new/`) with the existing backend API for the TechieMaya project. The frontend was bootstrapped using `create-react-app`.

The primary focus of this guide is on the frontend components and where backend API calls need to be implemented. Please refer to the "Maya ADK Project - Backend API Documentation" (provided separately) for detailed backend endpoint specifications.

**Key Frontend Technologies:**
*   React
*   React Router DOM for navigation
*   Standard CSS for styling (no UI library like Material UI or Bootstrap is currently used)

## 2. Project Structure

The main frontend code is located within `client_upload/frontend_new/src/`.
*   `App.js`: Main application component, sets up routing.
*   `App.css`: Global styles and CSS animations for decorative blobs.
*   `components/`: Contains React components for different pages and shared elements.
    *   `Navbar.js/.css`: Navigation bar.
    *   `LandingPage.js/.css`: The home page.
    *   `AuthPage.js/.css`: Handles both Login and Sign Up forms.
    *   `DocUploadPage.js/.css`: For document uploads, RAG DB building, and custom agent instructions.
    *   `ChatPage.js/.css`: The main chat interface with Maya.
*   `public/index.html`: Main HTML file where fonts (Montserrat, Open Sans from Google Fonts) are imported.

## 3. Running the Frontend

To start the frontend development server:
```bash
cd client_upload/frontend_new
npm install # If not already done
npm start
```
This will typically open the application at `http://localhost:3000`.

## 4. API Integration Points

The following sections detail where backend API calls are anticipated in the frontend components. Placeholder comments (`// TODO:`) are present in the code at these locations.

### 4.1. Authentication (`AuthPage.js`)

The `AuthPage.js` component handles both user login and signup. It uses an internal state `isLogin` to toggle between the two forms.

*   **Signup:**
    *   **Endpoint:** `POST /signup` (from backend docs)
    *   **Frontend Action:** When the "Sign Up" form is submitted.
    *   **Data to Send:** `{ "username": "string", "password": "string", "access_code": "string" }`
    *   **Expected Response:** Success message or error details.
    *   **Location in Code:** Inside the form submission handler within `AuthPage.js` when `!isLogin`.

*   **Login:**
    *   **Endpoint:** `POST /login` (from backend docs)
    *   **Frontend Action:** When the "Login" form is submitted.
    *   **Data to Send:** `{ "username": "string", "password": "string" }`
    *   **Expected Response:** `{ "access_token": "string", "token_type": "bearer" }` or error.
    *   **Location in Code:** Inside the form submission handler within `AuthPage.js` when `isLogin`.
    *   **Note:** The received `access_token` needs to be stored securely (e.g., `localStorage`, `sessionStorage`, or state management solution) and used in subsequent authenticated API calls.

*   **Verify Token / Get User Details (Optional but Recommended):**
    *   **Endpoint:** `GET /users/me`
    *   **Frontend Action:** Could be called after login or when the app loads to verify an existing token.
    *   **Headers:** `Authorization: Bearer <token>`
    *   **Expected Response:** `{ "username": "string" }`
    *   **Note:** This helps confirm token validity and can be used to manage application state (e.g., logged-in user).

### 4.2. Document Management (`DocUploadPage.js`)

This page allows users to upload documents and build their personal RAG database. All actions here require authentication.

*   **Upload Document(s):**
    *   **Endpoint:** `POST /upload_doc` (from backend docs)
    *   **Frontend Action:** In `handleFileUpload` function. The current implementation simulates sequential uploads for multiple files. Each file selected should be sent in a separate request.
    *   **Data to Send:** `multipart/form-data` containing a `file` part for each document.
    *   **Headers:** `Authorization: Bearer <token>`
    *   **Expected Response:** `{ "filename": "string", "saved_to_staging_path": "string", "message": "string" }` per file.
    *   **Location in Code:** Inside `handleFileUpload` within `DocUploadPage.js`. Loop through `selectedFiles` array.

*   **Build RAG Database:**
    *   **Endpoint:** `POST /build_rag_db` (from backend docs)
    *   **Frontend Action:** In `handleBuildRagDb` function.
    *   **Data to Send:** Empty JSON object `{}` (or no body if server configured).
    *   **Headers:** `Authorization: Bearer <token>`
    *   **Expected Response:** `{ "message": "string" }`.
    *   **Location in Code:** Inside `handleBuildRagDb` within `DocUploadPage.js`.
    *   **Note:** The backend API docs state this is an asynchronous process. The UI currently simulates this with `setIsProcessing` and messages. Consider how to handle true async status updates if the backend provides them (e.g., polling, WebSockets).

### 4.3. Agent Instructions Management (`DocUploadPage.js`)

This section within `DocUploadPage.js` allows users to manage custom instructions for the Maya agent. Requires authentication.

*   **Fetch Current Instructions (on page load/component mount):**
    *   **Endpoint:** `GET /users/me/instructions` (from backend docs)
    *   **Frontend Action:** Ideally in a `useEffect` hook when `DocUploadPage.js` mounts.
    *   **Headers:** `Authorization: Bearer <token>`
    *   **Expected Response:** `{ "instructions": "string" }`
    *   **Location in Code:** Placeholder `useEffect` is commented out in `DocUploadPage.js`. This needs to be implemented to populate the `agentInstructions` state.

*   **Save/Update Instructions:**
    *   **Endpoint:** `POST /users/me/instructions` (from backend docs)
    *   **Frontend Action:** In `handleSaveInstructions` function.
    *   **Data to Send:** `{ "instructions": "string" }` (from the `agentInstructions` state).
    *   **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
    *   **Expected Response:** `{ "message": "string" }`.
    *   **Location in Code:** Inside `handleSaveInstructions` within `DocUploadPage.js`.

### 4.4. ADK Agent Interaction (`ChatPage.js`)

This page handles the chat interface with the Maya agent. It involves ADK-specific session management and message exchange.

*   **A. Initialize/Create ADK Session:**
    *   **Endpoint:** `POST /apps/{app_name}/users/{user_id}/sessions/{session_id}`
    *   **Frontend Action:** Should occur when the `ChatPage.js` loads or a new chat is initiated.
    *   **Path Parameters:**
        *   `app_name`: Needs to be configured (e.g., "maya_agent").
        *   `user_id`: The logged-in username.
        *   `session_id`: Client-generated unique ID for the chat session.
    *   **Request Body (Optional):** As per backend docs, e.g., `{ "state": { ... } }`.
    *   **Location in Code:** Needs to be implemented, likely in a `useEffect` hook in `ChatPage.js` or when a "new chat" action occurs.

*   **B. Send Message to Agent (Streaming SSE for Live Steps):**
    *   **Endpoint:** `POST /run_sse` (global ADK endpoint)
    *   **Frontend Action:** In `handleSendMessage` function.
    *   **Request Body:**
        ```json
        {
            "appName": "maya_agent", // Configured agent module name
            "userId": "string",      // Logged-in username
            "sessionId": "string",   // Active ADK session ID
            "newMessage": { "role": "user", "parts": [{ "text": "The user's typed message" }] },
            "streaming": true
        }
        ```
    *   **Response:** Server-Sent Events (SSE) stream (`text/event-stream`). Each event's `data` field contains a JSON string of an ADK `Event` object.
    *   **Location in Code:** Inside `handleSendMessage` in `ChatPage.js`. The current implementation simulates responses. This needs to be replaced with actual `fetch` call for SSE and event parsing.
    *   **Frontend Handling:**
        *   Parse incoming SSE events.
        *   Update the `messages` state progressively based on event content (`text`, `thought`, `function_call`, `function_response`). The `renderMessageContent` function provides a basic structure for displaying these different event types.

## 5. State Management Considerations

*   **Authentication Token:** The JWT access token received upon login must be stored (e.g., `localStorage`, context API, Redux) and included in the `Authorization: Bearer <token>` header for all protected backend routes.
*   **User Information:** Storing the logged-in user's username (`user_id`) is necessary for ADK API calls.
*   **ADK Session ID:** The frontend needs to generate and manage the `session_id` for chat sessions.
*   **Global Configuration:** Values like `ADK_API_BASE_URL` and `AGENT_MODULE_NAME` should be configurable, perhaps in a `src/config.js` file or environment variables.

## 6. Styling and UI

*   The UI uses custom CSS located alongside each component.
*   Fonts (Montserrat, Open Sans) are imported via Google Fonts in `public/index.html`.
*   Global styles and CSS animations are in `src/App.css`.
*   The design aims for a modern, elegant, and lively feel with subtle background decorative elements (animated blobs).

This guide should provide a starting point for the backend integration. Further collaboration will likely be needed to refine error handling, loading states, and the specifics of SSE stream processing.
