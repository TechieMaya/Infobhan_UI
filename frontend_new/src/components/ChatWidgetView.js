import React, { useState, useEffect, useRef } from 'react';
// No Navbar import needed for the widget view
import './ChatPage.css'; // Reuse ChatPage CSS for the core chat UI
import { ADK_API_BASE_URL, AGENT_MODULE_NAME } from '../config';
import { useAuth } from '../context/AuthContext';
import { FaSpinner } from 'react-icons/fa'; // Only FaSpinner might be needed from react-icons
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// This component is a stripped-down version of ChatPage, intended for embedding.
// It only renders the core chat interface.
const ChatWidgetView = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const [currentAdkSessionId, setCurrentAdkSessionId] = useState('');
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  const isMountedRef = useRef(true);
  const messagesRef = useRef(messages); // To access current messages in callbacks
  const initInProgressRef = useRef(false);

  // Auth state managed locally for the widget, potentially initialized from URL token
  const [widgetAuthToken, setWidgetAuthToken] = useState(null);
  const [widgetIsAuthenticated, setWidgetIsAuthenticated] = useState(false);
  const [widgetCurrentUserId, setWidgetCurrentUserId] = useState('default-user'); // Start as default
  const [widgetAuthLoading, setWidgetAuthLoading] = useState(true); // To track if we're trying to auth from URL

  // Original AuthContext - primarily for isLoadingAuth from main app context if needed,
  // but widget will manage its own auth state if token is passed.
  const { isLoadingAuth: mainAppIsLoadingAuth } = useAuth(); 
  // We'll use widgetAuthLoading to gate initial calls.
  
  const prevUserIdRef = useRef();


  const SILENT_GREETING_TRIGGER = "Hi_Internal_Greeting_Trigger_Silent_Maya";
  const PLACEHOLDER_ID_GREETING = "placeholder-greeting-loading";
  const PLACEHOLDER_ID_THINKING_PREFIX = "placeholder-thinking-";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Effect to parse authToken from URL and attempt to set user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('authToken');

    if (tokenFromUrl) {
      console.log("ChatWidgetView: authToken found in URL:", tokenFromUrl);
      setWidgetAuthToken(tokenFromUrl);
      setWidgetIsAuthenticated(true); // Assume authenticated if token is present

      // Attempt to fetch user details with this token
      fetch(`${ADK_API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${tokenFromUrl}` }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch user details with token');
        }
        return response.json();
      })
      .then(userData => {
        if (userData && userData.username) {
          console.log("ChatWidgetView: User details fetched with token:", userData.username);
          setWidgetCurrentUserId(userData.username);
        } else {
          console.warn("ChatWidgetView: Token valid but no username in /users/me response. Using 'authenticated_user'.");
          setWidgetCurrentUserId('authenticated_user_via_token'); // Fallback if username not in response
        }
      })
      .catch(err => {
        console.error("ChatWidgetView: Error validating token or fetching user:", err);
        // Token might be invalid or expired, revert to guest
        setWidgetAuthToken(null);
        setWidgetIsAuthenticated(false);
        setWidgetCurrentUserId('default-user');
        setError("Invalid authentication token provided in URL.");
      })
      .finally(() => {
        setWidgetAuthLoading(false); // Finished attempting auth from URL
      });
    } else {
      console.log("ChatWidgetView: No authToken in URL, proceeding as guest or using main app context if available (though iframe is isolated).");
      // If no token in URL, rely on default 'default-user' or whatever useAuth() from parent might provide (unlikely in iframe)
      // For a truly isolated widget, if no token, it's 'default-user'.
      setWidgetCurrentUserId('default-user');
      setWidgetIsAuthenticated(false);
      setWidgetAuthLoading(false); // No URL token to process
    }
  }, []); // Runs once on mount

  useEffect(() => {
    // This effect now depends on widgetCurrentUserId
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== widgetCurrentUserId) {
      console.log(`ChatWidgetView: User context changed from ${prevUserIdRef.current} to ${widgetCurrentUserId}. Resetting session state.`);
      setIsSessionInitialized(false);
      setCurrentAdkSessionId('');
      setMessages(prev => prev.filter(m => m.id !== 'default-rag-warning' && m.id !== 'session-invalidated-warning'));
      initInProgressRef.current = false;
    }
    prevUserIdRef.current = widgetCurrentUserId;
  }, [widgetCurrentUserId]);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  const parseSSEEvent = (eventString) => {
    const lines = eventString.split('\n');
    let data = '';
    for (const line of lines) {
      if (line.startsWith('data:')) {
        data = line.substring('data:'.length).trim();
      }
    }
    if (data) {
      try { return JSON.parse(data); } 
      catch (e) { 
        console.error("ChatWidgetView: Failed to parse SSE data JSON:", data, e);
        return { error_message: "Malformed SSE data received" };
      }
    }
    return null;
  };

  const processAndSetMessages = (adkEvent, placeholderIdToReplace) => {
    if (!adkEvent || !isMountedRef.current) {
      console.warn("ChatWidgetView: processAndSetMessages: ADK event is null or component unmounted.");
      return;
    }

    const newMessagesFromThisAdkEvent = [];
    const baseTimestamp = new Date().toLocaleTimeString();

    if (adkEvent.content?.parts) {
      adkEvent.content.parts.forEach((part, partIndex) => {
        const messageId = `${adkEvent.author || 'unknown_author'}-${adkEvent.id || Date.now()}-${partIndex}-${Math.random().toString(36).substring(2, 7)}`;
        if (part.text) {
          newMessagesFromThisAdkEvent.push({
            id: messageId, author: adkEvent.author || AGENT_MODULE_NAME, type: 'text',
            content: part.text, timestamp: baseTimestamp, isPartial: adkEvent.partial || false,
            invocationId: adkEvent.invocationId
          });
        } else if (part.functionCall) {
          newMessagesFromThisAdkEvent.push({
            id: messageId, author: adkEvent.author, type: 'tool_call',
            content: { name: part.functionCall.name, args: part.functionCall.args },
            timestamp: baseTimestamp, isPartial: false, invocationId: adkEvent.invocationId
          });
        } else if (part.functionResponse) {
          newMessagesFromThisAdkEvent.push({
            id: messageId, author: adkEvent.author, type: 'tool_response',
            content: { name: part.functionResponse.name, response: part.functionResponse.response },
            timestamp: baseTimestamp, isPartial: false, invocationId: adkEvent.invocationId
          });
        }
      });
    }
    if (adkEvent.actions?.transferToAgent) {
      const transferMessageId = `${adkEvent.author || 'unknown_author'}-${adkEvent.id || Date.now()}-transfer-${Math.random().toString(36).substring(2, 7)}`;
      newMessagesFromThisAdkEvent.push({
        id: transferMessageId, author: adkEvent.author, type: 'agent_transfer',
        content: `Transferring to agent: ${adkEvent.actions.transferToAgent}`,
        timestamp: baseTimestamp, isPartial: false, invocationId: adkEvent.invocationId
      });
    }
    if (adkEvent.error_message && newMessagesFromThisAdkEvent.length === 0) {
      const errorMessageId = `error-${adkEvent.id || Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      newMessagesFromThisAdkEvent.push({
        id: errorMessageId, author: adkEvent.author || 'System', type: 'error',
        content: adkEvent.error_message, timestamp: baseTimestamp, isPartial: false,
        invocationId: adkEvent.invocationId
      });
    }

    if (newMessagesFromThisAdkEvent.length > 0) {
      setMessages(prevMessages => {
        let updatedMessages = [...prevMessages];
        let localPlaceholderIdToReplace = placeholderIdToReplace;
        newMessagesFromThisAdkEvent.forEach((newEventMessage, newMsgIndex) => {
          let messageReplacedPlaceholder = false;
          if (newMsgIndex === 0 && localPlaceholderIdToReplace) {
            const idxToReplace = updatedMessages.findIndex(m => m.id === localPlaceholderIdToReplace);
            if (idxToReplace !== -1) {
              updatedMessages[idxToReplace] = newEventMessage;
              messageReplacedPlaceholder = true;
            }
            localPlaceholderIdToReplace = null;
          }
          if (messageReplacedPlaceholder) return;

          const lastMessageIndex = updatedMessages.length - 1;
          const lastMessage = lastMessageIndex >= 0 ? updatedMessages[lastMessageIndex] : null;
          if (newEventMessage.type === 'text' && lastMessage?.type === 'text' &&
              lastMessage.author === newEventMessage.author &&
              lastMessage.invocationId === newEventMessage.invocationId && lastMessage.isPartial) {
            updatedMessages[lastMessageIndex] = { ...lastMessage, content: newEventMessage.content, timestamp: newEventMessage.timestamp, isPartial: newEventMessage.isPartial };
          } else {
            if (lastMessage?.type === 'text' && lastMessage.author === newEventMessage.author && 
                lastMessage.invocationId === newEventMessage.invocationId && lastMessage.isPartial) {
              updatedMessages[lastMessageIndex] = { ...lastMessage, isPartial: false };
            }
            updatedMessages.push(newEventMessage);
          }
        });
        return updatedMessages;
      });
    } else if (placeholderIdToReplace && adkEvent.partial === false && !adkEvent.content && !adkEvent.actions && !adkEvent.error_message) {
        setMessages(prevMessages => prevMessages.filter(m => m.id !== placeholderIdToReplace));
    }
  };

  const handleSseStream = async (response, placeholderIdToReplace) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstEventProcessed = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done || !isMountedRef.current) break;
      buffer += decoder.decode(value, { stream: true });
      let eventEndIndex;
      while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
        const eventString = buffer.substring(0, eventEndIndex);
        buffer = buffer.substring(eventEndIndex + 2);
        const adkEvent = parseSSEEvent(eventString);
        if (adkEvent && isMountedRef.current) {
          processAndSetMessages(adkEvent, placeholderIdToReplace);
          firstEventProcessed = true;
        }
      }
    }
    if (!firstEventProcessed && placeholderIdToReplace === PLACEHOLDER_ID_GREETING && isMountedRef.current) {
        setMessages(prev => prev.filter(m => m.id !== PLACEHOLDER_ID_GREETING));
    }
  };

  const sendSseRequestAndProcess = async (textPayload, isSilentGreeting = false, userMessageIdForThinking = null, directUserId = null, directSessionId = null) => {
    if (!isMountedRef.current) return;
    const userIdToUse = directUserId || widgetCurrentUserId; // MODIFIED
    const sessionIdToUse = directSessionId || currentAdkSessionId;

    if (!userIdToUse || !sessionIdToUse) {
      console.warn("ChatWidgetView: sendSseRequestAndProcess: session details missing.", { userIdToUse, sessionIdToUse, appName: AGENT_MODULE_NAME }); // MODIFIED console.warn
      if (!isSilentGreeting) setError("Chat session not ready. User or Session ID is missing.");
      return;
    }
    setIsSending(true);
    if (!isSilentGreeting) setError('');

    let placeholderId = isSilentGreeting ? PLACEHOLDER_ID_GREETING : `${PLACEHOLDER_ID_THINKING_PREFIX}${userMessageIdForThinking}`;
    if (!isSilentGreeting || (isSilentGreeting && messagesRef.current.length === 0)) { // Add thinking/connecting message
        const thinkingContent = isSilentGreeting ? "Connecting to Maya..." : "Thinking...";
        setMessages(prev => [...prev, { 
            id: placeholderId, author: AGENT_MODULE_NAME, type: 'thought', 
            content: thinkingContent, timestamp: new Date().toLocaleTimeString(), isPlaceholder: true 
        }]);
    }
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (widgetIsAuthenticated && widgetAuthToken) headers['Authorization'] = `Bearer ${widgetAuthToken}`; // MODIFIED
      const body = { appName: AGENT_MODULE_NAME, userId: userIdToUse, sessionId: sessionIdToUse, newMessage: { role: "user", parts: [{ "text": textPayload }] }, streaming: true };
      const response = await fetch(`${ADK_API_BASE_URL}/run_sse`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!isMountedRef.current) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Server error." }));
        throw new Error(errData.detail || `Error: ${response.status}`);
      }
      await handleSseStream(response, placeholderId);
    } catch (err) {
      if (isMountedRef.current) {
        setError(`Request failed: ${err.message}`);
        setMessages(prev => [...prev.filter(m => m.id !== placeholderId), { 
          id: `error-${Date.now()}`, author: 'System', type: 'error', 
          content: `Request failed: ${err.message}`, timestamp: new Date().toLocaleTimeString() 
        }]);
      }
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  };
  
  useEffect(() => {
    const initializeAndGreet = async () => {
      // Wait for widgetAuthLoading to be false before initializing
      if (!isMountedRef.current || mainAppIsLoadingAuth || widgetAuthLoading || (isSessionInitialized && !initInProgressRef.current) || (initInProgressRef.current && !isSessionInitialized) ) { // MODIFIED loading check
        return;
      }
      initInProgressRef.current = true;
      try {
        if (isMountedRef.current) setError('');
        // Use widget's authentication state
        if (!widgetIsAuthenticated && isMountedRef.current) { // MODIFIED
          setMessages(prev => prev.some(m => m.id === 'default-rag-warning') ? prev : [{ id: 'default-rag-warning', author: 'System', type: 'warning', content: "Chatting as guest. Messages are not saved.", timestamp: new Date().toLocaleTimeString() }, ...prev]);
        } else if (widgetIsAuthenticated && isMountedRef.current) { // MODIFIED
          setMessages(prev => prev.filter(m => m.id !== 'default-rag-warning'));
        }
        
        const sessionInfoHeaders = { 'Content-Type': 'application/json' };
        // Use widget's auth token for this call as well, if available
        if (widgetIsAuthenticated && widgetAuthToken) sessionInfoHeaders['Authorization'] = `Bearer ${widgetAuthToken}`; // MODIFIED
        
        // The next_session_info endpoint needs to be aware of the user if authenticated
        // It might internally use the token from header, or we might need to pass widgetCurrentUserId if the endpoint supports it.
        // For now, assume it uses the token from header if present.
        const sessionInfoResponse = await fetch(`${ADK_API_BASE_URL}/users/me/personal_storage/next_session_info`, { method: 'GET', headers: sessionInfoHeaders });
        if (!isMountedRef.current) return;
        if (!sessionInfoResponse.ok) throw new Error((await sessionInfoResponse.json().catch(() => ({}))).detail || "Failed to get session info.");
        const sessionInfo = await sessionInfoResponse.json();

        // Important: The user_id returned by next_session_info should align with widgetCurrentUserId if authenticated.
        // If widgetIsAuthenticated, sessionInfo.user_id should ideally match widgetCurrentUserId.
        // If not, it means the backend assigned a session to a different user than the token implies, which is an issue.
        if (widgetIsAuthenticated && sessionInfo.user_id !== widgetCurrentUserId) {
            console.warn(`ChatWidgetView: Mismatch between token user (${widgetCurrentUserId}) and session user (${sessionInfo.user_id}). Using session user.`);
            // This could happen if /users/me/personal_storage/next_session_info doesn't fully respect the passed token's user
            // and instead generates one based on other factors or defaults to the token's user implicitly.
            // For ADK session init, we MUST use the user_id associated with the session_id by the backend.
        }
        // Use the user_id from sessionInfo for ADK session initialization
        const userIdForAdkSession = sessionInfo.user_id; 
        const sessionIdForAdkSession = sessionInfo.session_id;


        if (!sessionInfo.session_id || !userIdForAdkSession) throw new Error("Invalid session_id or user_id from backend for ADK init."); // MODIFIED check
        if (isMountedRef.current) setCurrentAdkSessionId(sessionIdForAdkSession);


        const adkSessionInitHeaders = { 'Content-Type': 'application/json' };
        if (widgetIsAuthenticated && widgetAuthToken) adkSessionInitHeaders['Authorization'] = `Bearer ${widgetAuthToken}`; // MODIFIED
        
        if (!userIdForAdkSession || !sessionIdForAdkSession) { // Redundant check, but safe
            setError("Failed to prepare ADK session details."); initInProgressRef.current = false; return;
        }
        const adkSessionUrl = `${ADK_API_BASE_URL}/apps/${AGENT_MODULE_NAME}/users/${userIdForAdkSession}/sessions/${sessionIdForAdkSession}`;
        const response = await fetch(adkSessionUrl, { method: 'POST', headers: adkSessionInitHeaders, body: JSON.stringify({}) });
        if (!isMountedRef.current) return;

        if (response.ok || response.status === 204 || response.status === 409) {
          if(isMountedRef.current) { setIsSessionInitialized(true); setError(''); }
          const currentMsgs = messagesRef.current; // Use ref for current messages
          const shouldSendSilentGreeting = currentMsgs.length === 0 || (currentMsgs.length === 1 && currentMsgs[0].id === 'default-rag-warning');
          if (shouldSendSilentGreeting) {
            await sendSseRequestAndProcess(SILENT_GREETING_TRIGGER, true, null, userIdForAdkSession, sessionIdForAdkSession);
          }
        } else {
          const errorText = await response.text();
          let errorDetail = errorText;
          try { const eJson = JSON.parse(errorText); if (eJson.detail) errorDetail = eJson.detail; } catch (e) {}
          if(isMountedRef.current) { setError(`ADK Session init failed: ${errorDetail} (${response.status}).`); setIsSessionInitialized(false); }
        }
      } catch (e) {
        if (isMountedRef.current) { setError(`Critical initialization error: ${e.message}.`); setIsSessionInitialized(false); }
      } finally {
        if (isMountedRef.current) initInProgressRef.current = false;
      }
    };
    // Ensure this runs after widgetAuthLoading is false and other dependencies change.
    if (!mainAppIsLoadingAuth && !widgetAuthLoading) initializeAndGreet();
  }, [mainAppIsLoadingAuth, widgetAuthLoading, widgetIsAuthenticated, widgetCurrentUserId, widgetAuthToken, isSessionInitialized]); // MODIFIED dependencies

  const handleUserSendMessage = () => {
    if (inputValue.trim() === '') return;
    const userMessage = { id: `user-${Date.now()}`, author: widgetIsAuthenticated ? widgetCurrentUserId : 'User', type: 'text', content: inputValue, timestamp: new Date().toLocaleTimeString() }; // MODIFIED
    setMessages(prevMessages => [...prevMessages, userMessage]);
    sendSseRequestAndProcess(inputValue, false, userMessage.id, widgetCurrentUserId, currentAdkSessionId); // MODIFIED
    setInputValue('');
  };

  const renderMessageContent = (message) => {
    switch (message.type) {
      case 'text': return <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>;
      case 'tool_call': return <div className="tool-call-message"><p>Calling tool: <strong>{message.content.name}</strong></p></div>;
      case 'tool_response': return <div className="tool-response-message"><p>Received response from: <strong>{message.content.name}</strong></p></div>;
      case 'agent_transfer': return <p className="agent-transfer-message">{message.content}</p>;
      case 'error': return <p className="error-message">Error: {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
      case 'warning': return <p className="warning-message">Warning: {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
      default:
        if (typeof message.content === 'string') return <p>{message.content}</p>;
        if (message.content && typeof message.content.text === 'string') return <p>{message.content.text}</p>;
        return <p>Unsupported message: {JSON.stringify(message.content)}</p>;
    }
  };

  // Use mainAppIsLoadingAuth and widgetAuthLoading for the loading screen
  if ((mainAppIsLoadingAuth || widgetAuthLoading) && !isSessionInitialized) { // MODIFIED
    return (
        // Simplified loading state for widget view
        <div className="chat-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
            <p>Loading Maya Chat...</p>
            <FaSpinner className="spinner-btn" />
        </div>
    );
  }

  // Render only the core chat UI
  return (
    <div className="chat-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}> {/* Ensure full height for iframe */}
      <h2>Chat with <span className="name-highlight">Maya</span></h2>
      {error && <p className="chat-error-global" style={{padding: '10px', textAlign: 'center'}}>{error}</p>}
      <div className="chat-messages" ref={messagesEndRef} style={{ flexGrow: 1, overflowY: 'auto' }}> 
        {messages.map((msg) => (
          // MODIFIED author check for user messages
          <div key={msg.id} className={`message ${msg.author === 'User' || (msg.author === widgetCurrentUserId && widgetIsAuthenticated) ? 'user-message' : 'maya-message'} message-type-${msg.type}`}>
            <span className="message-sender">{ (msg.author === 'User' || (msg.author === widgetCurrentUserId && widgetIsAuthenticated)) ? 'You' : msg.author}</span>
            <div className="message-content-wrapper">{renderMessageContent(msg)}</div>
            <span className="message-timestamp">{msg.timestamp}</span>
          </div>
        ))}
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(event) => event.key === 'Enter' && handleUserSendMessage()}
          placeholder="Type your message to Maya..."
          disabled={isSending || !isSessionInitialized}
        />
        <button onClick={handleUserSendMessage} disabled={isSending || inputValue.trim() === '' || !isSessionInitialized}>
          {isSending ? <FaSpinner className="spinner-btn" /> : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatWidgetView;
