import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Cpu, MessageSquare, Send, Loader2, Plus, Edit2, Trash2, ChevronLeft, Network } from 'lucide-react';
import { apiService } from '../services/apiService';

// Import the new libraries for markdown rendering and syntax highlighting
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const UserDashboard = ({ user, onLogout }) => {
  const [greeting, setGreeting] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [tempSessionId, setTempSessionId] = useState(null); // For new unsaved sessions
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
    
    // Load user sessions
    loadSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await apiService.getUserSessions(user.id);
      if (response.success) {
        setSessions(response.sessions);
        
        // If no sessions, create one
        if (response.sessions.length === 0) {
          await createNewSession();
        } else {
          // Load the most recent session
          const mostRecent = response.sessions[0];
          setCurrentSessionId(mostRecent.session_id);
          loadSessionHistory(mostRecent.session_id);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSessionHistory = async (sessionId) => {
    try {
      const response = await apiService.getUserHistory(user.id, sessionId);
      if (response.success) {
        const formattedMessages = response.history.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.message,
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
      setMessages([]);
    }
  };

  const createNewSession = () => {
    // Create a temporary session ID (only save to database when user sends first message)
    const tempId = `temp_${Date.now()}`;
    setTempSessionId(tempId);
    setCurrentSessionId(tempId);
    setMessages([]);
    setSessions(prev => [{
      session_id: tempId,
      title: 'New Chat',
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      message_count: 0,
      is_temp: true // Mark as temporary
    }, ...prev]);
  };

  const switchSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    loadSessionHistory(sessionId);
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    
    // Don't allow deleting if it would leave no sessions
    const nonTempSessions = sessions.filter(s => !s.is_temp);
    if (nonTempSessions.length <= 1 && !sessions.find(s => s.session_id === sessionId && s.is_temp)) {
      setError('Cannot delete the last session');
      return;
    }

    // If it's a temporary session, just remove it from state
    if (sessions.find(s => s.session_id === sessionId && s.is_temp)) {
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      
      if (currentSessionId === sessionId) {
        // Switch to the most recent non-temp session
        const remaining = sessions.filter(s => s.session_id !== sessionId && !s.is_temp);
        if (remaining.length > 0) {
          switchSession(remaining[0].session_id);
        } else {
          createNewSession();
        }
      }
      return;
    }

    try {
      const response = await apiService.deleteSession(user.id, sessionId);
      if (response.success) {
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        
        if (currentSessionId === sessionId) {
          // Switch to the most recent session
          const remaining = sessions.filter(s => s.session_id !== sessionId);
          if (remaining.length > 0) {
            switchSession(remaining[0].session_id);
          } else {
            createNewSession();
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete chat');
    }
  };

  const startEditingSession = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const saveSessionTitle = async (sessionId, e) => {
    e.stopPropagation();
    
    if (editingTitle.trim()) {
      // Don't allow editing temporary sessions (they should be saved first)
      const session = sessions.find(s => s.session_id === sessionId);
      if (session && session.is_temp) {
        setError('Send a message first to save this chat');
        setEditingSessionId(null);
        setEditingTitle('');
        return;
      }
      
      try {
        const response = await apiService.updateSession(user.id, sessionId, editingTitle.trim());
        if (response.success) {
          setSessions(prev => prev.map(s => 
            s.session_id === sessionId 
              ? { ...s, title: editingTitle.trim() }
              : s
          ));
        }
      } catch (error) {
        console.error('Failed to update session title:', error);
      }
    }
    
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) {
      return;
    }

    // If this is a temporary session, save it first
    let actualSessionId = currentSessionId;
    if (tempSessionId && currentSessionId === tempSessionId) {
      try {
        const response = await apiService.createSession(user.id, 'New Chat');
        if (response.success) {
          actualSessionId = response.data.session_id;
          setCurrentSessionId(actualSessionId);
          setTempSessionId(null);
          
          // Replace temporary session with real session in sessions list
          setSessions(prev => prev.map(s => 
            s.session_id === tempSessionId 
              ? {
                  session_id: actualSessionId,
                  title: response.data.title,
                  created_at: new Date().toISOString(),
                  last_activity: new Date().toISOString(),
                  message_count: 0
                }
              : s
          ));
        }
      } catch (error) {
        console.error('Failed to create session:', error);
        setError('Failed to create new chat');
        return;
      }
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    setError('');

    try {
      const response = await apiService.chat(message.trim(), user.id, actualSessionId);
      
      if (response.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update session title if this is the first message
        const sessionMessages = messages.filter(m => m.role === 'user');
        if (sessionMessages.length === 0) {
          const newTitle = message.trim().substring(0, 30) + (message.trim().length > 30 ? '...' : '');
          try {
            await apiService.updateSession(user.id, actualSessionId, newTitle);
            setSessions(prev => prev.map(s => 
              s.session_id === actualSessionId 
                ? { ...s, title: newTitle, message_count: s.message_count + 2 }
                : s
            ));
          } catch (error) {
            console.error('Failed to update session title:', error);
          }
        } else {
          setSessions(prev => prev.map(s => 
            s.session_id === actualSessionId 
              ? { ...s, message_count: s.message_count + 2 }
              : s
          ));
        }
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Error: ${response.error}`,
          timestamp: new Date().toISOString(),
          isError: true
        };
        
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="k8s-container min-h-screen flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-k8s-dark/50 border-r border-k8s-blue/20 flex flex-col fixed h-full z-10`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-k8s-blue/20">
          <button
            onClick={createNewSession}
            className="w-full k8s-button-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              onClick={() => switchSession(session.session_id)}
              className={`group relative p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                currentSessionId === session.session_id
                  ? 'bg-k8s-blue/20 border border-k8s-blue/40'
                  : 'hover:bg-k8s-dark/30 border border-transparent'
              }`}
            >
              {editingSessionId === session.session_id ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveSessionTitle(session.session_id, e);
                      } else if (e.key === 'Escape') {
                        cancelEditing(e);
                      }
                    }}
                    className="flex-1 k8s-input text-sm"
                    autoFocus
                  />
                  <button
                    onClick={(e) => saveSessionTitle(session.session_id, e)}
                    className="text-green-400 hover:text-green-300"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => cancelEditing(e)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {session.title}
                        {session.is_temp && (
                          <span className="ml-2 text-xs text-k8s-gray italic">(unsaved)</span>
                        )}
                      </h3>
                      <p className="text-xs text-k8s-gray mt-1">
                        {session.message_count || 0} messages • {formatDate(session.last_activity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditingSession(session.session_id, session.title, e)}
                        className="p-1 text-k8s-gray hover:text-white transition-colors"
                        disabled={session.is_temp}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => deleteSession(session.session_id, e)}
                        className="p-1 text-k8s-gray hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <div className="k8s-glass border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="k8s-button-secondary p-2"
                >
                  <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                </button>
                <Cpu className="w-8 h-8 text-k8s-blue" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Kubernetes Assistant</h1>
                  <p className="text-k8s-gray text-sm">
                    {greeting}, {user.username}!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/topology"
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  <Network className="w-4 h-4" />
                  Topology
                </a>
                <button
                  onClick={onLogout}
                  className="k8s-button-secondary flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
          {/* Chat Interface */}
          <div className="k8s-card h-full flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 k8s-chat-scroll">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-k8s-blue mx-auto mb-4 opacity-50" />
                  <p className="text-k8s-gray">
                    Start a conversation by asking about your Kubernetes cluster.
                  </p>
                  <p className="text-k8s-gray text-sm mt-2">
                    Try: "Show me all pods" or "What's the status of my deployments?"
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`px-4 py-3 rounded-lg ${
                        msg.role === 'user' 
                          ? 'bg-k8s-blue text-white ml-4' 
                          : msg.isError 
                            ? 'bg-red-500/20 text-red-400 mr-4 border border-red-500/30'
                            : 'bg-k8s-dark/50 text-white mr-4 border border-k8s-blue/20' // Changed text to white
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Cpu className="w-4 h-4 text-k8s-blue" />
                            <span className="text-xs font-medium text-k8s-blue">K8s Assistant</span>
                          </div>
                        )}
                        <div className="text-sm">
                          {msg.role === 'user' ? (
                            // User messages are plain text
                            msg.content
                          ) : (
                            // Assistant messages are rendered as Markdown
                            <ReactMarkdown
                              components={{
                                code({ node, inline, className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return !inline && match ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-md my-2 text-sm"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code className="bg-k8s-dark/70 px-1 py-0.5 rounded text-k8s-blue text-sm" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-3 mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-md font-bold text-white mt-2 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 text-white">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-white">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-white">{children}</ol>,
                                li: ({ children }) => <li className="text-white">{children}</li>,
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-k8s-blue/50 pl-4 py-1 my-2 italic text-white/80">
                                    {children}
                                  </blockquote>
                                ),
                                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="text-white italic">{children}</em>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                        <div className="text-xs text-k8s-gray/60 mt-2">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-k8s-dark/50 text-white mr-4 border border-k8s-blue/20 px-4 py-3 rounded-lg max-w-[80%]"> {/* Changed text to white */}
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-k8s-blue" />
                      <span className="text-xs font-medium text-k8s-blue">K8s Assistant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-k8s-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          
            {/* Chat Input */}
            <div className="border-t border-k8s-blue/20 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about your Kubernetes cluster..."
                  className="flex-1 k8s-input"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="k8s-button-primary px-6 py-3"
                  disabled={isLoading || !message.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-k8s-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;