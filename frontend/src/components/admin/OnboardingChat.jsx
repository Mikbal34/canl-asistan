import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Loader2,
  CheckCircle,
  User,
  Bot,
  Building2,
  Scissors,
  Car,
  Clock,
  AlertCircle,
  RotateCcw,
  Package,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { onboardingAgentAPI } from '../../services/api';

// Step definitions with icons
const STEPS = {
  industry: { label: 'Sektör', icon: Building2 },
  company_info: { label: 'Firma Bilgileri', icon: Building2 },
  template: { label: 'Şablon', icon: Package },
  services: { label: 'Hizmetler', icon: Scissors },
  working_hours: { label: 'Çalışma Saatleri', icon: Clock },
  staff: { label: 'Personel', icon: User },
  password: { label: 'Şifre', icon: CheckCircle },
  summary: { label: 'Özet', icon: CheckCircle },
};

// Quick action buttons for each step
const QUICK_ACTIONS = {
  industry: [
    { label: 'Otomotiv / Galeri', value: 'otomotiv' },
    { label: 'Güzellik Salonu', value: 'güzellik salonu' },
    { label: 'Kuaför', value: 'kuaför' },
  ],
  template: [
    { label: '⭐ Önerilen Paket', value: 'Önerilen paketi seç' },
    { label: 'Temel Paket', value: 'Temel paketi istiyorum' },
    { label: 'Premium Paket', value: 'Premium paketi seç' },
  ],
  services: [
    { label: 'Hizmetleri geç', value: 'Hizmet eklemek istemiyorum, geç' },
    { label: 'Varsayılanları kullan', value: 'Varsayılan hizmetleri kullan' },
  ],
  working_hours: [
    { label: 'Pzt-Cuma 09:00-18:00', value: 'Hafta içi 09:00-18:00, hafta sonu kapalı' },
    { label: 'Her gün 10:00-20:00', value: 'Her gün 10:00-20:00' },
    { label: 'Pzt-Cmt 09:00-19:00', value: 'Pazartesi-Cumartesi 09:00-19:00, Pazar kapalı' },
  ],
  staff: [
    { label: 'Personel eklemeden geç', value: 'Personel eklemek istemiyorum, devam et' },
  ],
  summary: [
    { label: 'Evet, onayla', value: 'Evet, onayla' },
    { label: 'Düzelt', value: 'Hayır, düzeltmek istiyorum' },
  ],
};

/**
 * Chat message component
 */
const ChatMessage = ({ message, isUser }) => {
  // Parse markdown-like formatting (bold, emoji)
  const formatMessage = (text) => {
    if (!text) return '';
    // Convert **text** to bold
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-indigo-100' : 'bg-emerald-100'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-indigo-600" />
        ) : (
          <Bot className="w-4 h-4 text-emerald-600" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
      }`}>
        <div className="text-sm whitespace-pre-wrap">
          {formatMessage(message.content)}
        </div>
        <div className={`text-xs mt-1 ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

/**
 * Progress indicator component
 */
const ProgressIndicator = ({ currentStep }) => {
  const steps = Object.keys(STEPS);
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 rounded-lg">
      {steps.map((step, index) => {
        const StepIcon = STEPS[step].icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            key={step}
            className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
              title={STEPS[step].label}
            >
              {isCompleted ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <StepIcon className="w-3.5 h-3.5" />
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Quick action buttons component
 */
const QuickActions = ({ step, onSelect }) => {
  const actions = QUICK_ACTIONS[step];
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => onSelect(action.value)}
          className="px-3 py-1.5 text-sm rounded-full border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Onboarding Chat Modal Component
 */
export const OnboardingChat = ({ isOpen, onClose, onSuccess }) => {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [createdTenant, setCreatedTenant] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize session when modal opens
  useEffect(() => {
    if (isOpen && !session) {
      initSession();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (!loading && !initializing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, initializing]);

  const initSession = async () => {
    setInitializing(true);
    setError(null);
    try {
      const response = await onboardingAgentAPI.start();
      const data = response.data;
      setSession(data.session);
      setMessages(data.session.messages || []);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Oturum başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setInitializing(false);
    }
  };

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || loading || !session) return;

    const userMessage = messageText.trim();
    setInput('');
    setLoading(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await onboardingAgentAPI.chat(session.id, userMessage);
      const data = response.data;

      // Update session and messages
      setSession(data.session);
      setMessages(data.session.messages || []);

      // Check if tenant was created
      if (data.tenantCreated) {
        setCreatedTenant(data.tenantCreated);
        setCompleted(true);
      }
    } catch (err) {
      console.error('Failed to send message:', err);

      if (err.response?.status === 410) {
        setError('Oturum süresi doldu. Lütfen yeni bir oturum başlatın.');
      } else if (err.response?.status === 404) {
        setError('Oturum bulunamadı. Lütfen yeni bir oturum başlatın.');
      } else {
        setError('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      }

      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m !== tempUserMessage));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (value) => {
    handleSend(value);
  };

  const handleRestart = () => {
    setSession(null);
    setMessages([]);
    setCompleted(false);
    setCreatedTenant(null);
    setError(null);
    initSession();
  };

  const handleClose = () => {
    if (completed && createdTenant) {
      onSuccess?.(createdTenant);
    }
    // Reset state
    setSession(null);
    setMessages([]);
    setCompleted(false);
    setCreatedTenant(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span>AI ile Müşteri Kurulumu</span>
        </div>
      }
      size="lg"
    >
      <div className="flex flex-col h-[65vh]">
        {/* Progress indicator */}
        {session && !completed && (
          <div className="flex-shrink-0 mb-4">
            <ProgressIndicator currentStep={session.current_step} />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {initializing ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-slate-500">Asistan başlatılıyor...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="primary" onClick={handleRestart}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Tekrar Dene
                </Button>
              </div>
            </div>
          ) : completed ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Müşteri Oluşturuldu!
                </h3>
                <p className="text-slate-500 mb-6">
                  {createdTenant?.name} başarıyla oluşturuldu.
                </p>

                <div className="p-4 rounded-lg bg-slate-50 text-left space-y-2 mb-6 max-w-sm mx-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Firma:</span>
                    <span className="text-slate-900 font-medium">{createdTenant?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-900">{createdTenant?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Slug:</span>
                    <span className="text-slate-900 font-mono text-sm">{createdTenant?.slug}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <Button variant="ghost" onClick={handleRestart}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Yeni Müşteri
                  </Button>
                  <Button variant="primary" onClick={handleClose}>
                    Tamam
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  message={message}
                  isUser={message.role === 'user'}
                />
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-sm text-slate-500">Yazıyor...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick actions */}
        {session && !completed && !loading && !error && (
          <QuickActions step={session.current_step} onSelect={handleQuickAction} />
        )}

        {/* Input area */}
        {!completed && !error && (
          <div className="flex-shrink-0 pt-4 border-t border-slate-200 mt-4">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mesajınızı yazın..."
                disabled={loading || initializing}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || initializing || !input.trim()}
                className="px-5 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OnboardingChat;
