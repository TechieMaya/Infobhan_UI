import React from 'react';
import Navbar from './Navbar';
import './IntegrationsPage.css';
import { useAuth } from '../context/AuthContext';

const IntegrationsPage = () => {
  const { authToken: currentUserAuthToken, isAuthenticated } = useAuth();
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000';

  const actualScriptToCopy = `
<script>
(function(d, s, id) {
    const WIDGET_ID = id || 'maya-chat-widget-container';
    let chatPageUrl = "${appOrigin}/chat-widget"; // Points to the minimal chat interface
    const authToken = "${isAuthenticated && currentUserAuthToken ? currentUserAuthToken : ''}";

    if (authToken) {
        chatPageUrl += "?authToken=" + encodeURIComponent(authToken);
    }

    const CHAT_PAGE_URL = chatPageUrl; 

    if (d.getElementById(WIDGET_ID)) return;

    const style = d.createElement('style');
    style.textContent = \`
        #\${WIDGET_ID} {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }
        #\${WIDGET_ID}-bubble {
            background-color: #3498db; /* Maya blue */
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 28px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: transform 0.2s ease-out, background-color 0.2s ease;
        }
        #\${WIDGET_ID}-bubble:hover {
            background-color: #2980b9;
            transform: scale(1.1);
        }
        #\${WIDGET_ID}-iframe-container {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 370px;
            height: 70vh;
            max-height: 550px;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 10000;
        }
        #\${WIDGET_ID}-iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        #\${WIDGET_ID}-bubble svg {
            width: 30px;
            height: 30px;
            fill: white;
        }
    \`;
    d.head.appendChild(style);

    const widgetContainer = d.createElement('div');
    widgetContainer.id = WIDGET_ID;
    d.body.appendChild(widgetContainer);

    const chatBubble = d.createElement('div');
    chatBubble.id = \`\${WIDGET_ID}-bubble\`;
    chatBubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    widgetContainer.appendChild(chatBubble);

    const iframeContainer = d.createElement('div');
    iframeContainer.id = \`\${WIDGET_ID}-iframe-container\`;
    widgetContainer.appendChild(iframeContainer);

    let iframe = null;
    let isOpen = false;

    chatBubble.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            if (!iframe) {
                iframe = d.createElement('iframe');
                iframe.id = \`\${WIDGET_ID}-iframe\`;
                iframe.src = CHAT_PAGE_URL;
                iframeContainer.appendChild(iframe);
            }
            iframeContainer.style.display = 'flex';
            chatBubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
        } else {
            iframeContainer.style.display = 'none';
            chatBubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
        }
    });

}(document, 'script', 'maya-chat-widget-script'));
</script>
`.trim();

  const placeholderScriptForDisplay = `
// The full embed script can be copied using the button below.
// It will use CHAT_PAGE_URL = "${appOrigin}/chat-widget";
// If you are logged in, your authentication token may be included.
// Please refer to notes below for cross-domain embedding and authentication.
`.trim();

  const importantNotesHTML = `
<h4>Important Notes for Embedding:</h4>
<p>The script (copied via the button) creates a chat widget. Key points:</p>
<ul>
  <li><strong>Chat Interface URL:</strong> The script sets a <code>CHAT_PAGE_URL</code> to <code>${appOrigin}/chat-widget</code>. This URL loads a minimal chat interface. If you are logged into this application, your authentication token is appended to this URL (e.g., <code>?authToken=YOUR_TOKEN</code>) to attempt to authenticate the chat widget as you.</li>
  <li><strong>Security (Auth Tokens):</strong> Be cautious when pasting scripts containing authentication tokens onto untrusted third-party websites.</li>
  <li><strong>Cross-Domain Embedding:</strong>
    <ul>
      <li>If embedding on a different domain than where this Maya application is hosted, you MUST manually edit the <code>CHAT_PAGE_URL</code> in your copied script to the absolute URL of your deployed Maya application's <code>/chat-widget</code> endpoint (e.g., <code>"https://your-maya-app.com/chat-widget"</code>).</li>
      <li>The Maya application server administrator MUST configure the server (via the <code>APP_ALLOWED_FRAME_ORIGINS</code> environment variable) to permit embedding from your website's domain.</li>
    </ul>
  </li>
  <li><strong>Local Testing:</strong> Ensure your backend (FastAPI) server is restarted after any configuration changes and that your frontend build (served by FastAPI) is up-to-date. The backend's default development configuration for <code>APP_ALLOWED_FRAME_ORIGINS</code> should permit testing from common local servers (like VS Code Live Server).</li>
</ul>
`;

  const apiExampleJson = `{
  "appName": "maya_app",
  "userId": "your_user_id",
  "sessionId": "your_session_id",
  "newMessage": { 
    "role": "user", 
    "parts": [{ "text": "Hello Maya!" }] 
  },
  "streaming": true
}`;

  return (
    <>
      <Navbar />
      <div className="integrations-page-container">
        <div className="integrations-card">
          <header className="integrations-header">
            <h1>Integrate Maya into Your Ecosystem</h1>
            <p className="integrations-subtitle">
              Bring personalized AI assistance directly to your users, wherever they are.
            </p>
            <div style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', padding: '15px', borderRadius: '4px', marginTop: '15px', textAlign: 'center' }}>
              <strong>Warning:</strong> This integration feature is currently in development and may not work as intended. Please use with caution.
            </div>
          </header>

          <div className="blob-tertiary"></div>
          <div className="blob-quaternary"></div>

          <section className="integration-method">
            <h2>Embeddable Web Widget</h2>
            <p>
              To add Maya to your website, use our embeddable widget script.
              Copy the script using the button below and paste it into your website's HTML, preferably before the closing <code>{`</body>`}</code> tag.
            </p>
            
            <div className="important-notice-integrations" dangerouslySetInnerHTML={{ __html: importantNotesHTML }} />

            <div className="code-block-container">
              <pre>
                <code>
                  {placeholderScriptForDisplay}
                </code>
              </pre>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(actualScriptToCopy);
                  alert("Actual embed script copied to clipboard!");
                }}
                className="copy-code-button"
              >
                Copy Actual Script
              </button>
            </div>
            <p>
              You can customize the widget's appearance and behavior through data attributes or a configuration object passed during initialization. 
              Refer to the (forthcoming) widget documentation for more details.
            </p>
          </section>

          <section className="integration-method">
            <h2>API Integration</h2>
            <p>
              For deeper integrations, refer to the <code>API_DOCS.md</code> file and the example API calls shown in the application's frontend components (like <code>ChatPage.js</code>).
            </p>
            <p>Key endpoints involve ADK interactions, typically including:</p>
            <ul>
              <li>Obtaining session info (e.g., via <code>/users/me/personal_storage/next_session_info</code>).</li>
              <li>Initializing ADK session context (e.g., <code>/apps/&#123;appName&#125;/users/&#123;userId&#125;/sessions/&#123;sessionId&#125;</code>).</li>
              <li>Sending messages (e.g., via <code>/run_sse</code>).</li>
            </ul>
            <p>The API request body example for sending a message is:</p>
            <pre><code>{apiExampleJson}</code></pre>
            <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="cta-button" style={{marginTop: '15px'}}> 
              View Full API Documentation (API_DOCS.md)
            </a>
          </section>

          <section className="integration-method">
            <h2>Need Help?</h2>
            <p>
              If you have specific integration requirements or need assistance, please don't hesitate to reach out to our support team or check our community forums.
            </p>
            <button onClick={() => alert("Support contact form/page coming soon!")} className="cta-button">
              Contact Support
            </button>
          </section>
        </div>
      </div>
    </>
  );
};

export default IntegrationsPage;
