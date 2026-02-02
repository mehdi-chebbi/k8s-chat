import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Cpu, MessageSquare, Send, Loader2, Plus, Edit2, Trash2, ChevronLeft, Network, Server, Key, Sparkles, CheckCircle, Clock } from 'lucide-react';
import { apiService } from '../services/apiService';
import ChangePasswordModal from '../components/ChangePasswordModal';

// Import new libraries for markdown rendering and syntax highlighting
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
  const [tempSessionId, setTempSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
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

    loadSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingStatus]);

  const loadSessions = async () => {
    try {
      const response = await apiService.getUserSessions(user.id);
      if (response.success) {
        setSessions(response.sessions);

        if (response.sessions.length === 0) {
          await createNewSession();
        } else {
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
      is_temp: true
    }, ...prev]);
  };

  const switchSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    loadSessionHistory(sessionId);
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();

    const nonTempSessions = sessions.filter(s => !s.is_temp);
    if (nonTempSessions.length <= 1 && !sessions.find(s => s.session_id === sessionId && s.is_temp)) {
      setError('Cannot delete last session');
      return;
    }

    if (sessions.find(s => s.session_id === sessionId && s.is_temp)) {
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));

      if (currentSessionId === sessionId) {
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

  const parseSSEEvent = (line) => {
    if (!line.startsWith('data: ')) {
      return null;
    }
    try {
      const dataStr = line.substring(6).trim();
      return JSON.parse(dataStr);
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
      return null;
    }
  };

const handleSendMessage = async (e) => {
  e.preventDefault();

  if (!message.trim() || isLoading) {
    return;
  }

  let actualSessionId = currentSessionId;
  if (tempSessionId && currentSessionId === tempSessionId) {
    try {
      const response = await apiService.createSession(user.id, 'New Chat');
      if (response.success) {
        actualSessionId = response.data.session_id;
        setCurrentSessionId(actualSessionId);
        setTempSessionId(null);

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
  const messageText = message.trim();
  setMessage('');
  setIsLoading(true);
  setError('');
  setStreamingStatus('connecting');

  const assistantMessageId = Date.now() + 1;
  const assistantMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    isStreaming: true
  };
  setMessages(prev => [...prev, assistantMessage]);

  let executedCommands = [];

  try {
    const response = await fetch(`/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        message: messageText,
        session_id: actualSessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    setStreamingStatus('streaming');

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === '') {
          continue;
        }

        const event = parseSSEEvent(trimmedLine);
        if (!event) {
          continue;
        }

        switch (event.type) {
          case 'metadata':
            if (event.response_type === 'investigation') {
              setStreamingStatus('investigating');
            } else {
              setStreamingStatus('chatting');
            }
            break;

          case 'content':
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + event.content }
                : msg
            ));
            scrollToBottom();
            break;

          case 'command_executing':
            setStreamingStatus({ type: 'command_executing', command: event.command });
            break;

          case 'command_completed':
            executedCommands.push(event.command);
            setStreamingStatus({ type: 'command_completed', command: event.command, success: event.success });
            break;

          case 'command_blocked':
            console.warn('Command blocked:', event.command, event.reason);
            setMessages(prev => {
              const updated = [...prev];
              const msgIndex = updated.findIndex(m => m.id === assistantMessageId);
              if (msgIndex >= 0) {
                updated[msgIndex] = {
                  ...updated[msgIndex],
                  content: updated[msgIndex].content + `\n\n⚠️ **Command blocked:** ${event.command}\n*Reason: ${event.reason}*`
                };
              }
              return updated;
            });
            scrollToBottom();
            break;

          case 'analysis_start':
            setStreamingStatus('analyzing');
            break;

          case 'error':
            console.error('Streaming error:', event.error);
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${event.error}`, isError: true, isStreaming: false }
                : msg
            ));
            scrollToBottom();
            break;

          case 'done':
            setStreamingStatus('done');
            executedCommands = event.commands_executed || [];
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg
            ));
            break;

          default:
            console.log('Unknown event type:', event.type);
        }
      }
    }

    const sessionMessages = messages.filter(m => m.role === 'user');
    if (sessionMessages.length === 0) {
      const newTitle = messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '');
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

  } catch (error) {
    console.error('Streaming error:', error);
    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessageId
        ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isError: true, isStreaming: false }
        : msg
    ));
    setError('Failed to send message');
  } finally {
    setIsLoading(false);
    setStreamingStatus(null);
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
    <div className="k8s-container h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-k8s-dark/50 border-r border-k8s-blue/20 flex flex-col h-full z-10`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-k8s-blue/20">
          <button
            onClick={createNewSession}
            className="w-full k8s-button-primary flex items-center justify-center gap-2 text-sm py-2.5 shadow-lg shadow-k8s-blue/20 hover:shadow-k8s-blue/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              onClick={() => switchSession(session.session_id)}
              className={`group relative p-2.5 rounded-lg cursor-pointer mb-1.5 transition-all duration-200 ${
                currentSessionId === session.session_id
                  ? 'bg-k8s-blue/20 border border-k8s-blue/40 shadow-md'
                  : 'hover:bg-k8s-dark/30 border border-transparent hover:border-k8s-blue/20'
              }`}
            >
              {editingSessionId === session.session_id ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                    className="flex-1 k8s-input text-xs py-1"
                    autoFocus
                  />
                  <button
                    onClick={(e) => saveSessionTitle(session.session_id, e)}
                    className="text-green-400 hover:text-green-300 p-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => cancelEditing(e)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-k8s-cyan flex-shrink-0" />
                        {session.title}
                        {session.is_temp && (
                          <span className="text-xs text-k8s-gray/60 italic">(unsaved)</span>
                        )}
                      </h3>
                      <p className="text-xs text-k8s-gray/70 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.last_activity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditingSession(session.session_id, session.title, e)}
                        className="p-1 text-k8s-gray hover:text-k8s-cyan hover:bg-k8s-blue/10 rounded transition-all"
                        disabled={session.is_temp}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => deleteSession(session.session_id, e)}
                        className="p-1 text-k8s-gray hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
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
      <div className={`flex-1 flex flex-col transition-all duration-300 h-full overflow-hidden`}>
        {/* Header */}
        <div className="k8s-glass border-b border-k8s-blue/20 flex-shrink-0">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="k8s-button-secondary p-2 hover:scale-105 transition-transform"
                >
                  <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? 'rotate-0' : 'rotate-180'}`} />
                </button>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Cpu className="w-7 h-7 text-k8s-cyan" />
                    <Sparkles className="w-3 h-3 text-k8s-blue absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Kubernetes Assistant</h1>
                    <p className="text-k8s-gray text-xs">
                      {greeting}, {user.username}!
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href="/topology"
                  className="k8s-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 hover:scale-105 transition-transform"
                >
                  <Network className="w-3.5 h-3.5" />
                  Topology
                </a>
                <a
                  href="/pods"
                  className="k8s-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 hover:scale-105 transition-transform"
                >
                  <Server className="w-3.5 h-3.5" />
                  Pods
                </a>
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className="k8s-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 hover:scale-105 transition-transform"
                >
                  <Key className="w-3.5 h-3.5" />
                  Password
                </button>
                <button
                  onClick={onLogout}
                  className="k8s-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 hover:scale-105 transition-transform"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container - Fixed height with sticky input */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-12 animate-fadeIn">
                  <div className="inline-flex p-4 bg-k8s-blue/10 rounded-2xl mb-4">
                    <MessageSquare className="w-12 h-12 text-k8s-cyan opacity-50" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Start a Conversation</h3>
                  <p className="text-sm text-k8s-gray mb-4">
                    Ask me anything about your Kubernetes cluster
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-6">
                    <div className="px-3 py-2 bg-k8s-blue/10 rounded-lg border border-k8s-blue/20 text-xs text-k8s-gray">
                      💬 "Show me all pods"
                    </div>
                    <div className="px-3 py-2 bg-k8s-blue/10 rounded-lg border border-k8s-blue/20 text-xs text-k8s-gray">
                      🔍 "Check deployment status"
                    </div>
                    <div className="px-3 py-2 bg-k8s-blue/10 rounded-lg border border-k8s-blue/20 text-xs text-k8s-gray">
                      📊 "List all services"
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}>
                    <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-k8s-blue to-k8s-cyan text-white ml-4 shadow-lg'
                          : msg.isError
                            ? 'bg-red-500/10 text-red-400 mr-4 border border-red-500/30'
                            : 'bg-k8s-dark/50 text-white mr-4 border border-k8s-blue/20 shadow-md'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-k8s-blue/20">
                            <div className="p-1 bg-k8s-cyan/20 rounded">
                              <Cpu className="w-3 h-3 text-k8s-cyan" />
                            </div>
                            <span className="text-xs font-semibold text-k8s-cyan">KubeMate</span>
                            {msg.isStreaming && (
                              <span className="text-xs text-k8s-gray/60 animate-pulse flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                thinking...
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-sm">
                          {msg.role === 'user' ? (
                            msg.content
                          ) : (
                            <ReactMarkdown
                              components={{
                                code({ node, inline, className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return !inline && match ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-lg my-2 text-xs"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code className="bg-k8s-dark/70 px-1.5 py-0.5 rounded text-k8s-cyan text-xs font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-3 mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-bold text-white mt-2 mb-1.5">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 text-white text-sm leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-white text-sm">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-white text-sm">{children}</ol>,
                                li: ({ children }) => <li className="text-white text-sm">{children}</li>,
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-k8s-cyan/50 pl-3 py-1 my-2 italic text-white/80 text-sm">
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
                        <div className="text-xs text-k8s-gray/60 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Streaming Status Indicator */}
              {streamingStatus && typeof streamingStatus === 'object' && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="bg-k8s-dark/50 text-white mr-4 border border-k8s-blue/20 px-4 py-3 rounded-xl max-w-[75%] shadow-md">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-k8s-blue/20">
                      <div className="p-1 bg-k8s-cyan/20 rounded">
                        <Cpu className="w-3 h-3 text-k8s-cyan" />
                      </div>
                      <span className="text-xs font-semibold text-k8s-cyan">KubeMate</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-k8s-cyan" />
                      {streamingStatus.type === 'command_executing' && (
                        <span>Running: <code className="bg-k8s-dark/70 px-2 py-1 rounded text-k8s-cyan text-xs font-mono">{streamingStatus.command}</code></span>
                      )}
                      {streamingStatus.type === 'command_completed' && (
                        <span className={streamingStatus.success ? 'text-green-400' : 'text-red-400'}>
                          {streamingStatus.success ? '✓ Command completed' : '✗ Command failed'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat Input - Sticky at bottom */}
          <div className="flex-shrink-0 border-t border-k8s-blue/20 bg-k8s-dark/80 backdrop-blur-sm">
            <div className="px-6 py-3">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about your Kubernetes cluster..."
                  className="flex-1 k8s-input text-sm py-2.5 transition-all duration-200 focus:scale-[1.01]"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="k8s-button-primary px-5 py-2.5 shadow-lg shadow-k8s-blue/30 hover:shadow-k8s-blue/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={isLoading || !message.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="fixed bottom-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-2xl border border-red-400/50 animate-slideUp z-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={(message) => {
          setShowChangePasswordModal(false);
          if (message) {
            setError('');
            alert(message);
          }
        }}
        onError={(errorMessage) => {
          setError(errorMessage);
        }}
        username={user.username}
      />

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 163, 255, 0.3);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 163, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;