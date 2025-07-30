import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './Navbar';
import './ChatPage.css';
import { ADK_API_BASE_URL, AGENT_MODULE_NAME } from '../config';
import { useAuth } from '../context/AuthContext';
import { FaChevronDown, FaChevronUp, FaSpinner } from 'react-icons/fa';
import { Link } from 'react-router-dom'; // Import Link
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const [currentAdkSessionId, setCurrentAdkSessionId] = useState('');
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  // REMOVE original agent instruction states
  // const [agentInstructions, setAgentInstructions] = useState('');
  // const [instructionsInput, setInstructionsInput] = useState('');
  // const [instructionsMessage, setInstructionsMessage] = useState({ text: '', type: '' });
  // const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  // const [showCustomInstructions, setShowCustomInstructions] = useState(false);

  // ADD state for the new integration details section
  const [showIntegrationDetails, setShowIntegrationDetails] = useState(false);

  const isMountedRef = useRef(true);
  const messagesRef = useRef(messages);
  const initInProgressRef = useRef(false);

  const { currentUser, isAuthenticated, isLoadingAuth, authToken } = useAuth();
  const currentUserId = currentUser?.username || 'default-user';
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

  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId) {
      console.log(`User context changed from ${prevUserIdRef.current} to ${currentUserId}. Resetting session state.`);
      setIsSessionInitialized(false);
      setCurrentAdkSessionId('');
      setMessages(prev => prev.filter(m => m.id !== 'default-rag-warning' && m.id !== 'session-invalidated-warning'));
      initInProgressRef.current = false;
    }
    prevUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    // Scroll main chat messages
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]); // Only scroll when messages array changes
  
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
        console.error("Failed to parse SSE data JSON:", data, e);
        return { error_message: "Malformed SSE data received" };
      }
    }
    return null;
  };

  const processAndSetMessages = (adkEvent, placeholderIdToReplace) => {
    if (!adkEvent || !isMountedRef.current) {
      console.warn("processAndSetMessages: ADK event is null or component unmounted.");
      return;
    }

    const newMessagesFromThisAdkEvent = [];
    const baseTimestamp = new Date().toLocaleTimeString();

    // 1. Process content parts
    if (adkEvent.content?.parts) {
      adkEvent.content.parts.forEach((part, partIndex) => {
        const messageId = `${adkEvent.author || 'unknown_author'}-${adkEvent.id || Date.now()}-${partIndex}-${Math.random().toString(36).substring(2, 7)}`;
        
        if (part.text) {
          newMessagesFromThisAdkEvent.push({
            id: messageId, // This ID is for the chunk itself, used if it starts a new message
            author: adkEvent.author || AGENT_MODULE_NAME,
            type: 'text',
            content: part.text, // This is the CHUNK or CUMULATIVE TEXT from ADK
            timestamp: baseTimestamp,
            isPartial: adkEvent.partial || false, // isPartial from ADK event for THIS CHUNK
            invocationId: adkEvent.invocationId
          });
        } else if (part.functionCall) {
          newMessagesFromThisAdkEvent.push({
            id: messageId,
            author: adkEvent.author,
            type: 'tool_call',
            content: {
              name: part.functionCall.name,
              args: part.functionCall.args,
            },
            timestamp: baseTimestamp,
            isPartial: false, 
            invocationId: adkEvent.invocationId
          });
        } else if (part.functionResponse) {
          newMessagesFromThisAdkEvent.push({
            id: messageId,
            author: adkEvent.author,
            type: 'tool_response',
            content: {
              name: part.functionResponse.name,
              response: part.functionResponse.response,
            },
            timestamp: baseTimestamp,
            isPartial: false,
            invocationId: adkEvent.invocationId
          });
        }
      });
    }

    // 2. Process agent transfers
    if (adkEvent.actions?.transferToAgent) {
      const transferMessageId = `${adkEvent.author || 'unknown_author'}-${adkEvent.id || Date.now()}-transfer-${Math.random().toString(36).substring(2, 7)}`;
      newMessagesFromThisAdkEvent.push({
        id: transferMessageId,
        author: adkEvent.author,
        type: 'agent_transfer',
        content: `Transferring to agent: ${adkEvent.actions.transferToAgent}`,
        timestamp: baseTimestamp,
        isPartial: false,
        invocationId: adkEvent.invocationId
      });
    }
    
    // 3. Process top-level error message
    if (adkEvent.error_message && newMessagesFromThisAdkEvent.length === 0) {
      const errorMessageId = `error-${adkEvent.id || Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      newMessagesFromThisAdkEvent.push({
        id: errorMessageId,
        author: adkEvent.author || 'System',
        type: 'error',
        content: adkEvent.error_message,
        timestamp: baseTimestamp,
        isPartial: false,
        invocationId: adkEvent.invocationId
      });
    }

    if (newMessagesFromThisAdkEvent.length > 0) {
      setMessages(prevMessages => {
        let updatedMessages = [...prevMessages];
        let localPlaceholderIdToReplace = placeholderIdToReplace;

        newMessagesFromThisAdkEvent.forEach((newEventMessage, newMsgIndex) => {
          // newEventMessage contains a chunk (if text) or a full tool/action message.
          // newEventMessage.isPartial is from adkEvent.partial for this specific chunk/event.

          let messageReplacedPlaceholder = false;
          if (newMsgIndex === 0 && localPlaceholderIdToReplace) {
            const idxToReplace = updatedMessages.findIndex(m => m.id === localPlaceholderIdToReplace);
            if (idxToReplace !== -1) {
              // The placeholder is replaced by this new message (chunk or full).
              // If it's a text chunk, its content is just that chunk.
              // Its isPartial status is from the ADK event.
              updatedMessages[idxToReplace] = { 
                                ...newEventMessage, 
                                id: updatedMessages[idxToReplace].id // Preserve placeholder's original ID if needed, or use newEventMessage.id
                             }; 
              // Let's use newEventMessage.id for simplicity, meaning the message block ID changes from placeholder to first chunk.
              updatedMessages[idxToReplace] = newEventMessage;


              messageReplacedPlaceholder = true;
            }
            localPlaceholderIdToReplace = null; 
          }

          if (messageReplacedPlaceholder) {
            return; 
          }

          const lastMessageIndex = updatedMessages.length - 1;
          const lastMessage = lastMessageIndex >= 0 ? updatedMessages[lastMessageIndex] : null;

          if (
            newEventMessage.type === 'text' &&
            lastMessage &&
            lastMessage.type === 'text' &&
            lastMessage.author === newEventMessage.author &&
            lastMessage.invocationId === newEventMessage.invocationId &&
            lastMessage.isPartial // The existing last message block was expecting continuation
          ) {
            // This newEventMessage is a text event continuing the last message block.
            // Assume ADK sends cumulative text for partials, so directly assign.
            updatedMessages[lastMessageIndex] = {
              ...lastMessage,
              content: newEventMessage.content, // Use content from the current ADK event
              timestamp: newEventMessage.timestamp,
              isPartial: newEventMessage.isPartial, // Update partial status from the current event
            };
          } else {
            // This newEventMessage starts a new message block (it's not a text continuation of the last one).
            // Before adding it, check if the *actual* last message block needs to be finalized.
            if (
              lastMessage &&
              lastMessage.type === 'text' &&
              lastMessage.author === newEventMessage.author && 
              lastMessage.invocationId === newEventMessage.invocationId &&
              lastMessage.isPartial 
            ) {
              // The previous text message block (from same author/invocation) is now considered complete 
              // because this newEventMessage is not its direct text continuation.
              updatedMessages[lastMessageIndex] = { ...lastMessage, isPartial: false };
            }
            // Now, add the new message.
            // If it's a text chunk, its content is just itself. Its isPartial is from ADK.
            updatedMessages.push(newEventMessage); 
          }
        });
        return updatedMessages;
      });
    } else if (placeholderIdToReplace && adkEvent.partial === false && !adkEvent.content && !adkEvent.actions && !adkEvent.error_message) {
        // This case handles when an empty, non-partial event arrives after a placeholder was set,
        // meaning the agent finished thinking but produced no immediate visible output.
        // We should remove the "thinking..." placeholder.
        setMessages(prevMessages => prevMessages.filter(m => m.id !== placeholderIdToReplace));
    }
  };
  
  const handleSseStream = async (response, placeholderIdToReplace) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''
    let firstEventProcessed = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done || !isMountedRef.current) {
        console.log(`[${new Date().toISOString()}] SSE Stream finished or component unmounted. Done: ${done}`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let eventEndIndex;
      while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
        const eventString = buffer.substring(0, eventEndIndex);
        buffer = buffer.substring(eventEndIndex + 2);
        const adkEvent = parseSSEEvent(eventString);

        if (adkEvent && isMountedRef.current) {
          // Diagnostic log
          console.log(
            `[${new Date().toISOString()}] Processing ADK Event in JS: `,
            {
              id: adkEvent.id,
              author: adkEvent.author,
              type: adkEvent.content?.parts?.[0]?.text ? 'text' : (adkEvent.content?.parts?.[0]?.functionCall ? 'functionCall' : (adkEvent.content?.parts?.[0]?.functionResponse ? 'functionResponse' : (adkEvent.actions?.transferToAgent ? 'transfer' : 'other'))),
              contentPreview: adkEvent.content?.parts?.[0]?.text?.substring(0, 30) || adkEvent.content?.parts?.[0]?.functionCall?.name || adkEvent.content?.parts?.[0]?.functionResponse?.name || adkEvent.actions?.transferToAgent,
              isPartial: adkEvent.partial
            }
          );
          processAndSetMessages(adkEvent, placeholderIdToReplace);
          firstEventProcessed = true;
        }
      }
    }
    if (!firstEventProcessed && placeholderIdToReplace === PLACEHOLDER_ID_GREETING && isMountedRef.current) {
        setMessages(prev => prev.filter(m => m.id !== PLACEHOLDER_ID_GREETING));
    }
  };

  const sendSseRequestAndProcess = async (
    textPayload, 
    isSilentGreeting = false, 
    userMessageIdForThinking = null,
    directUserId = null, 
    directSessionId = null 
  ) => {
    if (!isMountedRef.current) return;

    const userIdToUse = directUserId || currentUserId;
    const sessionIdToUse = directSessionId || currentAdkSessionId;

    if (!userIdToUse || !sessionIdToUse) {
      console.warn("sendSseRequestAndProcess: session details missing.", { userIdToUse, sessionIdToUse, appName: AGENT_MODULE_NAME });
      if (!isSilentGreeting) setError("Chat session not ready. User or Session ID is missing.");
      return;
    }

    setIsSending(true);
    if (!isSilentGreeting) setError('');

    let placeholderId;
    if (isSilentGreeting) {
      placeholderId = PLACEHOLDER_ID_GREETING;
    } else {
      placeholderId = `${PLACEHOLDER_ID_THINKING_PREFIX}${userMessageIdForThinking}`;
      setMessages(prev => [...prev, { 
        id: placeholderId, author: AGENT_MODULE_NAME, type: 'thought', 
        content: "Thinking...", timestamp: new Date().toLocaleTimeString(), isPlaceholder: true 
      }]);
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (isAuthenticated && authToken) headers['Authorization'] = `Bearer ${authToken}`;
      
      const body = {
        appName: AGENT_MODULE_NAME,
        userId: userIdToUse,      
        sessionId: sessionIdToUse, 
        newMessage: { role: "user", parts: [{ "text": textPayload }] },
        streaming: true
      };
      console.log("Sending /run_sse request with body:", body);

      const response = await fetch(`${ADK_API_BASE_URL}/run_sse`, {
        method: 'POST', headers,
        body: JSON.stringify(body)
      });

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
      if (!isMountedRef.current || isLoadingAuth) {
        console.log("initializeAndGreet: Aborting due to mount status or auth loading.", {
          isMounted: isMountedRef.current,
          isLoadingAuth
        });
        return;
      }

      if (isSessionInitialized && !initInProgressRef.current) {
        console.log("initializeAndGreet: Session already initialized for current user. Skipping full re-initialization.");
        return;
      }
      
      if (initInProgressRef.current && !isSessionInitialized) {
          console.log("initializeAndGreet: Initialization already in progress. Waiting.");
          return;
      }

      initInProgressRef.current = true;
      console.log("initializeAndGreet: Starting initialization. Auth loaded, isAuthenticated:", isAuthenticated, "User:", currentUser, "SessionInitialized:", isSessionInitialized);

      try {
        if (isMountedRef.current) setError('');

        if (!isAuthenticated && isMountedRef.current) {
          setMessages(prev => {
            const hasWarning = prev.some(m => m.id === 'default-rag-warning' || m.id === 'session-invalidated-warning');
            const hasLoading = prev.some(m => m.id === PLACEHOLDER_ID_GREETING);
            if (!hasWarning && !hasLoading) {
              return [{ 
                id: 'default-rag-warning', author: 'System', type: 'warning', 
                content: "Chatting as guest. Messages are not saved. Login to personalize.", 
                timestamp: new Date().toLocaleTimeString() 
              }, ...prev];
            }
            return prev;
          });
        } else if (isAuthenticated && isMountedRef.current) {
            setMessages(prev => prev.filter(m => m.id !== 'default-rag-warning' && m.id !== 'session-invalidated-warning'));
        }
        
        let sessionInfo;
        try {
          const sessionInfoHeaders = { 'Content-Type': 'application/json' };
          if (isAuthenticated && authToken) {
            sessionInfoHeaders['Authorization'] = `Bearer ${authToken}`;
          }

          const sessionInfoResponse = await fetch(`${ADK_API_BASE_URL}/users/me/personal_storage/next_session_info`, {
            method: 'GET',
            headers: sessionInfoHeaders,
          });

          if (!isMountedRef.current) return; 

          if (!sessionInfoResponse.ok) {
            const errorData = await sessionInfoResponse.json().catch(() => ({ detail: "Failed to get session info from server."}));
            throw new Error(errorData.detail || `Server error ${sessionInfoResponse.status} fetching session info.`);
          }
          sessionInfo = await sessionInfoResponse.json();
          
          if (!sessionInfo.session_id || !sessionInfo.user_id) {
              throw new Error("Backend did not return valid session_id or user_id.");
          }

          const backendSessionUserId = sessionInfo.user_id;
          
          if (isMountedRef.current) {
            if (isAuthenticated && currentUser && backendSessionUserId !== currentUser.username) {
                console.warn(`Session User ID (${backendSessionUserId}) mismatch with AuthContext User (${currentUser.username}). This might indicate an issue.`);
            }
            setCurrentAdkSessionId(sessionInfo.session_id);
          }

        } catch (err) {
          if(isMountedRef.current) {
              setError(`Failed to initialize session: ${err.message}. Please refresh.`);
          }
          setIsSessionInitialized(false); 
          initInProgressRef.current = false;
          return; 
        }

        try {
          const adkSessionInitHeaders = { 'Content-Type': 'application/json' };
          if (isAuthenticated && authToken) {
             adkSessionInitHeaders['Authorization'] = `Bearer ${authToken}`;
          }
          
          const userIdForAdkSession = currentUserId;
          const sessionIdForAdkSession = sessionInfo?.session_id || currentAdkSessionId;

          if (!userIdForAdkSession || !sessionIdForAdkSession) {
            console.error("initializeAndGreet: Cannot initialize ADK session, user or session ID missing before ADK POST.", { userIdForAdkSession, sessionIdForAdkSession });
            setError("Failed to prepare ADK session details. Please refresh.");
            initInProgressRef.current = false;
            return;
          }

          const adkSessionUrl = `${ADK_API_BASE_URL}/apps/${AGENT_MODULE_NAME}/users/${userIdForAdkSession}/sessions/${sessionIdForAdkSession}`;
          console.log("Attempting ADK session POST to:", adkSessionUrl, "with isAuthenticated:", isAuthenticated);

          const response = await fetch(adkSessionUrl, {
            method: 'POST', headers: adkSessionInitHeaders, body: JSON.stringify({}) 
          });

          if (!isMountedRef.current) return;

          if (response.ok || response.status === 204 || response.status === 409) { 
            if(isMountedRef.current) {
              setIsSessionInitialized(true); 
              setError(''); 
            }
            const currentMsgs = messagesRef.current;
            const shouldSendSilentGreeting = currentMsgs.length === 0 || 
                                             (currentMsgs.length === 1 && currentMsgs[0].id === 'default-rag-warning');
            
            if (shouldSendSilentGreeting) {
              setMessages(prev => {
                  const alreadyLoading = prev.some(m => m.id === PLACEHOLDER_ID_GREETING);
                  if (alreadyLoading) return prev;
                  const newLoadingMessage = { 
                      id: PLACEHOLDER_ID_GREETING, author: AGENT_MODULE_NAME, type: 'thought', 
                      content: "Connecting to Maya...", timestamp: new Date().toLocaleTimeString(), isPlaceholder: true 
                  };
                  const guestWarningIndex = prev.findIndex(m => m.id === 'default-rag-warning');
                  if (guestWarningIndex !== -1) {
                      const newArr = [...prev];
                      newArr.splice(guestWarningIndex + 1, 0, newLoadingMessage);
                      return newArr;
                  } else {
                      return [newLoadingMessage, ...prev];
                  }
              });
              await sendSseRequestAndProcess(
                SILENT_GREETING_TRIGGER, 
                true,
                null,
                userIdForAdkSession, 
                sessionIdForAdkSession 
              );
            }
          } else {
            const errorText = await response.text();
            let errorDetail = errorText;
            try { const eJson = JSON.parse(errorText); if (eJson.detail) errorDetail = eJson.detail; } catch (e) {}
            if(isMountedRef.current) {
              if (response.status === 409 && errorDetail.toLowerCase().includes("session already exists")) {
                setIsSessionInitialized(true);
                setError(''); 
                const currentMsgs = messagesRef.current;
                const shouldSendSilentGreeting = currentMsgs.length === 0 || 
                                                 (currentMsgs.length === 1 && currentMsgs[0].id === 'default-rag-warning');
                if (shouldSendSilentGreeting) {
                  setMessages(prev => { 
                      const alreadyLoading = prev.some(m => m.id === PLACEHOLDER_ID_GREETING);
                      if (alreadyLoading) return prev;
                      const newLoadingMessage = { 
                          id: PLACEHOLDER_ID_GREETING, author: AGENT_MODULE_NAME, type: 'thought', 
                          content: "Connecting to Maya...", timestamp: new Date().toLocaleTimeString(), isPlaceholder: true 
                      };
                      const guestWarningIndex = prev.findIndex(m => m.id === 'default-rag-warning');
                      if (guestWarningIndex !== -1) {
                          const newArr = [...prev];
                          newArr.splice(guestWarningIndex + 1, 0, newLoadingMessage);
                          return newArr;
                      } else {
                          return [newLoadingMessage, ...prev];
                      }
                  });
                  if (userIdForAdkSession && sessionIdForAdkSession) {
                      await sendSseRequestAndProcess(
                          SILENT_GREETING_TRIGGER, true, null,
                          userIdForAdkSession, sessionIdForAdkSession
                      );
                  } else {
                      console.warn("Attempting silent greeting on 409, but sessionInfo not available, falling back to state for IDs.");
                      await sendSseRequestAndProcess(SILENT_GREETING_TRIGGER, true, null, currentUserId, currentAdkSessionId);
                  }
                }
              } else {
                setError(`ADK Session init failed: ${errorDetail} (${response.status}). Please refresh.`); 
                setIsSessionInitialized(false);
              }
            }
          }
        } catch (err) {
          if(isMountedRef.current) { 
              setError(`ADK Session init error: ${err.message}. Please refresh.`); 
              setIsSessionInitialized(false);
          }
        }
      } catch (e) {
          if (isMountedRef.current) {
            setError(`Critical initialization error: ${e.message}. Please refresh.`);
            setIsSessionInitialized(false); 
          }
          console.error("Critical error in initializeAndGreet:", e);
      } finally {
        if (isMountedRef.current) {
            console.log("initializeAndGreet: Finishing. Setting initInProgressRef to false.");
            initInProgressRef.current = false;
        }
      }
    };

    if (!isLoadingAuth) {
        initializeAndGreet();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAuth, isAuthenticated, currentUser, authToken, isSessionInitialized]);

  const handleUserSendMessage = () => {
    if (inputValue.trim() === '') return;
    const userMessage = {
      id: `user-${Date.now()}`,
      author: isAuthenticated ? currentUserId : 'User',
      type: 'text',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    sendSseRequestAndProcess(inputValue, false, userMessage.id, currentUserId, currentAdkSessionId); 
    setInputValue(''); 
  };

  const renderMessageContent = (message) => {
    switch (message.type) {
      case 'text':
        // Use ReactMarkdown to render text content
        // Wrap ReactMarkdown output in a div with a specific class for styling
        return <div className="markdown-content"><ReactMarkdown>{message.content}</ReactMarkdown></div>;
      case 'tool_call':
        return (
          <div className="tool-call-message">
            <p>Calling tool: <strong>{message.content.name}</strong></p>
          </div>
        );
      case 'tool_response':
        return (
          <div className="tool-response-message">
            <p>Received response from: <strong>{message.content.name}</strong></p>
          </div>
        );
      case 'agent_transfer':
        // Content is already a string like "Transferring to agent: ..."
        return <p className="agent-transfer-message">{message.content}</p>;
      case 'error':
        return <p className="error-message">Error: {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
      case 'warning':
        return <p className="warning-message">Warning: {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
      default:
        if (typeof message.content === 'string') {
          return <p>{message.content}</p>;
        } else if (message.content && typeof message.content.text === 'string') {
          // Fallback for older or differently structured text messages
          return <p>{message.content.text}</p>; 
        }
        return <p>Unsupported message: {JSON.stringify(message.content)}</p>;
    }
  };

  const getMessageClass = (type) => {
    if (type === 'error') return 'message-error';
    if (type === 'success') return 'message-success';
    if (type === 'warning') return 'message-warning';
    if (type === 'info') return 'message-info';
    return '';
  };

  // REMOVE original agent instruction fetch and save functions
  // const fetchAgentInstructions = useCallback(async () => { ... });
  // const handleSaveInstructions = async () => { ... };

  // REMOVE useEffect that called fetchAgentInstructions
  // useEffect(() => { ... fetchAgentInstructions ... }, [...]);

  if (isLoadingAuth && !isSessionInitialized) {
    return (
        <div className="chat-page-loading">
            <Navbar />
            <div className="chat-container">
                <h2>Chat with <span className="name-highlight">Maya</span></h2>
                <p>Loading authentication and session...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="chat-page">
      <Navbar />
      <div className="chat-page-content-wrapper"> 
        <div className="chat-container"> {/* This is the original, UNMODIFIED chat div structure */}
          <h2>Chat with <span className="name-highlight">Maya</span></h2>
          {error && <p className="chat-error-global">{error}</p>}
          {/* messagesEndRef should be on the scrollable part of chat-container */}
          <div className="chat-messages" ref={messagesEndRef}> 
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.author === 'User' || (msg.author === currentUserId && isAuthenticated) ? 'user-message' : 'maya-message'} message-type-${msg.type}`}>
                <span className="message-sender">{ (msg.author === 'User' || (msg.author === currentUserId && isAuthenticated)) ? 'You' : msg.author}</span>
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

        {/* NEW Integration Details Section */}
        <div className="integration-details-section">
          {/* Blobs are pseudo-elements of this container via CSS */}
          <button
            onClick={() => setShowIntegrationDetails(!showIntegrationDetails)}
            className={`integration-toggle-button ${showIntegrationDetails ? 'expanded' : ''}`}
          >
            Integrate Personalized Maya to Your Website
            <span className="toggle-arrow">
              {showIntegrationDetails ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </button>
          {showIntegrationDetails && (
            <div className="integration-content-visible">
              <h3>Quick Integration Steps:</h3>
              <ol>
                <li>Ensure your website has a section where you want to embed Maya.</li>
                <li>Copy the provided script tag from the <Link to="/integrations" className="integration-inline-link">Integrations Page</Link>.</li>
                <li>Paste the script tag into your website's HTML where you want Maya to appear.</li>
                <li>Customize Maya's appearance and behavior through the configuration options (details on the Integrations Page).</li>
              </ol>
              <Link to="/integrations" className="integration-learn-more-link">
                Go to Full Integration Guide
              </Link>
            </div>
          )}
        </div>
        {/* END NEW Integration Details Section */}

      </div> {/* End of chat-page-content-wrapper */}
      {error && <p className="chat-error-display" style={{ textAlign: 'center', color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
};

export default ChatPage;
