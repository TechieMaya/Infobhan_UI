import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './Navbar';
import './DocUploadPage.css';
import { ADK_API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { FaUpload, FaTrashAlt, FaSpinner, FaChevronDown, FaChevronUp } from 'react-icons/fa'; // Added FaSpinner back
import { useNavigate } from 'react-router-dom';

const DocUploadPage = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [overallUploadMessage, setOverallUploadMessage] = useState({ text: '', type: '' });
  const [isUploading, setIsUploading] = useState(false);
  
  const [isProcessingDb, setIsProcessingDb] = useState(false);
  const [dbBuildMessage, setDbBuildMessage] = useState({ text: '', type: '' });
  
  const [agentInstructions, setAgentInstructions] = useState('');
  const [instructionsInput, setInstructionsInput] = useState('');
  const [instructionsMessage, setInstructionsMessage] = useState({ text: '', type: '' });
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  
  const [dbExists, setDbExists] = useState(null);
  const [initialDbStatusMessage, setInitialDbStatusMessage] = useState({text: '', type: ''});
  const [filesStaged, setFilesStaged] = useState(false); 

  const { currentUser, authToken, isLoadingAuth } = useAuth();
  const username = currentUser?.username;
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const getMessageClass = (type) => {
    if (type === 'error') return 'message-error';
    if (type === 'success') return 'message-success';
    if (type === 'warning') return 'message-warning';
    if (type === 'info') return 'message-info';
    return '';
  };

  const fetchInitialData = useCallback(async () => {
    if (!authToken || !username) {
      if (!isLoadingAuth) {
        setDbExists(false);
        setInitialDbStatusMessage({ text: 'Please login to manage documents.', type: 'error' });
      }
      return;
    }

    // Fetch RAG DB status
    try {
      const dbStatusResponse = await fetch(`${ADK_API_BASE_URL}/users/me/rag_db_status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (dbStatusResponse.ok) {
        const statusData = await dbStatusResponse.json();
        setDbExists(statusData.db_exists);
        if (statusData.db_exists) {
          setInitialDbStatusMessage({ text: `Note: A personal RAG database for user '${username}' exists. Uploading new documents and then building will modify this database.`, type: 'warning' });
        } else {
          // No message needed here if no DB, button will say "Build"
           setInitialDbStatusMessage({ text: '', type: '' });
        }
      } else {
        setDbExists(false);
        setInitialDbStatusMessage({ text: 'Could not retrieve DB status.', type: 'error' });
        console.error("Failed to fetch RAG DB status:", dbStatusResponse.statusText);
      }
    } catch (error) {
      setDbExists(false);
      setInitialDbStatusMessage({ text: 'Error fetching DB status.', type: 'error' });
      console.error("Error fetching RAG DB status:", error);
    }

    // Fetch agent instructions
    try {
      const instrResponse = await fetch(`${ADK_API_BASE_URL}/users/me/instructions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (instrResponse.ok) {
        const instrData = await instrResponse.json();
        setAgentInstructions(instrData.instructions || '');
        setInstructionsInput(instrData.instructions || '');
      } else {
        console.warn(`Could not load instructions: ${await instrResponse.text()}`);
        setInstructionsMessage({text: 'Could not load existing instructions.', type: 'warning'});
      }
    } catch (error) {
      console.error("Error fetching instructions:", error);
      setInstructionsMessage({text: 'Error fetching instructions.', type: 'error'});
    }
  }, [authToken, username, isLoadingAuth]);

  useEffect(() => {
    if (!isLoadingAuth) {
      fetchInitialData();
    }
  }, [isLoadingAuth, fetchInitialData]);

  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    setSelectedFiles(prevFiles => {
      const existingFileNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFiles.filter(nf => !existingFileNames.has(nf.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
    setOverallUploadMessage({ text: '', type: '' });
    setFilesStaged(false);
    setDbBuildMessage({ text: '', type: '' }); 
    if (event.target) event.target.value = null;
  };
  
  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const newFiles = Array.from(event.dataTransfer.files);
    setSelectedFiles(prevFiles => {
      const existingFileNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFiles.filter(nf => !existingFileNames.has(nf.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
    setOverallUploadMessage({ text: '', type: '' });
    setFilesStaged(false); 
    setDbBuildMessage({ text: '', type: '' }); 
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (fileName) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    if (selectedFiles.length === 1) {
        setFilesStaged(false);
        setOverallUploadMessage({ text: '', type: '' });
        setDbBuildMessage({ text: '', type: '' });
    }
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setOverallUploadMessage({ text: 'Please select files to upload.', type: 'warning' });
      return;
    }
    if (!authToken) {
      setOverallUploadMessage({ text: "Authentication token not found. Please login.", type: 'error' });
      return;
    }

    setIsUploading(true);
    setOverallUploadMessage({ text: 'Uploading files...', type: 'info' });
    setDbBuildMessage({ text: '', type: '' }); 
    // Hide file list during upload
    // setSelectedFiles([]); // This would clear them from state, maybe not desired if upload fails and want to retry

    let allSuccessful = true;
    for (const file of selectedFiles) {
      const singleFileFormData = new FormData();
      singleFileFormData.append('file', file);
      try {
        const response = await fetch(`${ADK_API_BASE_URL}/upload_doc`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: singleFileFormData,
        });
        if (!response.ok) {
          allSuccessful = false;
          const errorData = await response.json().catch(() => ({ detail: `Upload failed for ${file.name}.` }));
          setOverallUploadMessage({ text: errorData.detail || `Upload failed for ${file.name}.`, type: 'error' });
          // Re-show selected files if upload fails to allow user to see which ones and retry/remove
          // This logic might need adjustment based on how retries are handled
          break; 
        }
      } catch (error) {
        allSuccessful = false;
        setOverallUploadMessage({ text: `Error during upload: ${error.message}`, type: 'error' });
        break;
      }
    }

    setIsUploading(false);
    if (allSuccessful) {
      setOverallUploadMessage({ text: `${selectedFiles.length} file(s) uploaded successfully to staging. Ready to build DB.`, type: 'success' });
      setFilesStaged(true); 
      // setSelectedFiles([]); // Clear files from display list after successful staging
    } else {
      // Error message already set, keep selectedFiles to allow user to see them
      setFilesStaged(false);
    }
  };

  const handleBuildRagDb = async () => {
    if (!authToken) {
      setDbBuildMessage({ text: "Authentication token not found. Please login.", type: 'error' });
      return;
    }
    setIsProcessingDb(true);
    // Clear selected files from display when build starts
    setSelectedFiles([]);
    setFilesStaged(false);
    setOverallUploadMessage({ text: '', type: '' }); 
    setDbBuildMessage({ text: 'Building RAG database... This may take a few moments.', type: 'info' });


    try {
      const response = await fetch(`${ADK_API_BASE_URL}/build_rag_db`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        setDbBuildMessage({ text: data.message || `Personal RAG DB for user '${username}' (DB name: '${username}') built successfully.`, type: 'success' });
        setDbExists(true);
        setInitialDbStatusMessage({ text: `Note: A personal RAG database for user '${username}' exists. Uploading new documents and then building will modify this database.`, type: 'warning' });
      } else {
        setDbBuildMessage({ text: `Error: ${data.detail || response.statusText}`, type: 'error' });
      }
    } catch (error) {
      setDbBuildMessage({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsProcessingDb(false);
    }
  };

  const handleSaveInstructions = async () => {
    if (!authToken) {
      setInstructionsMessage({ text: "Authentication token not found. Please login.", type: 'error' });
      return;
    }
    setIsSavingInstructions(true);
    setInstructionsMessage({ text: 'Saving instructions...', type: 'info' });
    try {
      const response = await fetch(`${ADK_API_BASE_URL}/users/me/instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ instructions: instructionsInput }),
      });
      const data = await response.json();
      if (response.ok) {
        setInstructionsMessage({ text: data.message || 'Instructions saved successfully!', type: 'success' });
        setAgentInstructions(instructionsInput);
      } else {
        setInstructionsMessage({ text: `Error: ${data.detail || response.statusText}`, type: 'error' });
      }
    } catch (error) {
      setInstructionsMessage({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsSavingInstructions(false);
    }
  };
  
  const navigateToChat = () => {
    navigate('/chat');
  };

  if (isLoadingAuth) {
    return (
      <>
        <Navbar />
        <div className="doc-upload-page-container">
          <div className="loading-container main-loader">
            <div className="spinner main-page-spinner"></div>
            <p>Loading user information...</p>
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Navbar />
        <div className="doc-upload-page-container">
          <div className="card-main">
            <div className="blob blob-top-left"></div>
            <div className="blob blob-bottom-right"></div>
            <h2>Document Upload & Processing</h2>
            <div className="accent-bar"></div>
            <p className={`message-overall ${getMessageClass('error')}`}>Please log in to manage your documents and agent settings.</p>
          </div>
        </div>
      </>
    );
  }

  const showUploadButton = !filesStaged && !isUploading && !isProcessingDb;
  const showBuildButton = filesStaged && !isUploading && !isProcessingDb && !dbBuildMessage.text;
  const showChatButton = dbExists && dbBuildMessage.type === 'success' && !isProcessingDb;
  const showInitialDbMessage = !isUploading && !isProcessingDb && !overallUploadMessage.text && !dbBuildMessage.text && initialDbStatusMessage.text;

  return (
    <>
      <Navbar />
      <div className="doc-upload-page-container">
        {/* Document Upload Section */}
        <div className="card-main document-upload-card">
          <div className="blob blob-doc-top-left"></div>
          <div className="blob blob-doc-bottom-right"></div>
          <h2>Document Upload & Processing</h2>
          <div className="accent-bar"></div>
          <p className="section-description">
            Upload your documents (.pdf, .txt, .docx) to build your personal knowledge base for Maya.
          </p>

          {/* Show file input unless uploading or processing */}
          {!isUploading && !isProcessingDb && (
            <div 
              className={`drag-drop-area ${selectedFiles.length > 0 ? 'files-selected' : ''}`}
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                multiple 
                onChange={handleFileChange} 
                accept=".pdf,.txt,.docx" 
                ref={fileInputRef}
                style={{ display: 'none' }} 
              />
              {selectedFiles.length === 0 ? (
                <>
                  <FaUpload className="upload-icon" />
                  <p>Choose file(s) or drag them here</p>
                </>
              ) : (
                <p>{selectedFiles.length} file(s) selected</p>
              )}
            </div>
          )}

          {/* Show selected files list only before upload starts and if not processing */}
          {selectedFiles.length > 0 && !isUploading && !isProcessingDb && !filesStaged && (
            <div className="selected-files-display">
              <h4>{selectedFiles.length} file(s) selected:</h4>
              <ul>
                {selectedFiles.map(file => (
                  <li key={file.name}>
                    <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                    <button onClick={() => removeFile(file.name)} className="remove-file-btn" title="Remove file">
                      <FaTrashAlt />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Initial DB Status or Upload/Build Messages */}
          { showInitialDbMessage && (
            <p className={`message-overall ${getMessageClass(initialDbStatusMessage.type)}`}>{initialDbStatusMessage.text}</p>
          )}

          {overallUploadMessage.text && !isProcessingDb && (
            <p className={`message-overall ${getMessageClass(overallUploadMessage.type)}`}>{overallUploadMessage.text}</p>
          )}
          
          {isUploading && (
            <div className="loading-container process-message">
              <div className="spinner"></div>
              <p>Uploading files...</p>
            </div>
          )}

          {/* Upload Button */}
          {showUploadButton && (
            <button 
              onClick={handleUploadFiles} 
              disabled={selectedFiles.length === 0} 
              className="btn btn-green btn-upload-files"
            >
              {`Upload ${selectedFiles.length} File(s)`}
            </button>
          )}
          
          {isProcessingDb && (
            <div className="loading-container process-message">
              <div className="spinner"></div> {/* Replaced FaSpinner with a div for CSS spinner */}
              <p className="processing-main-text">Building RAG database... This may take a few moments.</p>
              <p className="processing-sub-text">This might take a while.</p>
            </div>
          )}

          {dbBuildMessage.text && !isProcessingDb && (
            <p className={`message-db-build ${getMessageClass(dbBuildMessage.type)}`}>
              {dbBuildMessage.text}
            </p>
          )}
          
          {showBuildButton && (
             <button 
                onClick={handleBuildRagDb} 
                className="btn btn-green btn-process"
            >
                {'Start Processing'}
            </button>
          )}
          
          {showChatButton && (
             <button onClick={navigateToChat} className="btn btn-green btn-chat-maya">
                Chat with Maya
            </button>
          )}
        </div>

        <div className="divider-line"></div>

        {/* Custom Agent Instructions Section */}
        <div className="card-main instructions-card">
          <div className="blob blob-instr-top-right"></div>
          <div className="blob blob-instr-bottom-left"></div>
          <div align="left" className={`instructions-toggle-header ${showCustomInstructions ? 'expanded' : ''}`} onClick={() => setShowCustomInstructions(!showCustomInstructions)} role="button" tabIndex="0" onKeyDown={(e) => e.key === 'Enter' && setShowCustomInstructions(!showCustomInstructions)}>
            <input 
              type="checkbox" 
              checked={showCustomInstructions} 
              onChange={() => {}} 
              readOnly
              id="toggle-instructions"
              aria-labelledby="toggle-instructions-label"
            />
            <label id="toggle-instructions-label" htmlFor="toggle-instructions">Add or Edit Custom Agent Instructions?</label>
            <span className="toggle-icon">
                {showCustomInstructions ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </div>

          {showCustomInstructions && (
            <div className="instructions-editor-content">
              <h2>Custom Agent Instructions</h2>
              <div className="accent-bar"></div>
              <p className="section-description">
                Provide custom instructions for Maya to tailor its responses and behavior.
              </p>
              <textarea
                value={instructionsInput}
                onChange={(e) => setInstructionsInput(e.target.value)}
                placeholder="You should always first use rag to try to answer the user question, in the end you must tell the steps you took and what search you performed and what results you got back, if the rag results are not sufficient you can also perform web search"
                rows={7}
                disabled={isSavingInstructions}
              />
              {instructionsMessage.text && (
                <p className={`message-instructions ${getMessageClass(instructionsMessage.type)}`}>{instructionsMessage.text}</p>
              )}
              <button 
                onClick={handleSaveInstructions} 
                disabled={isSavingInstructions || instructionsInput === agentInstructions} 
                className="btn btn-blue btn-save-instructions"
              >
                {isSavingInstructions ? <><FaSpinner className="spinner-btn" /> Saving...</> : 'Save Instructions'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DocUploadPage;
