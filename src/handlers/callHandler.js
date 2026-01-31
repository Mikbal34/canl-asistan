const { ConversationManager } = require('../services/openai');
const deepgramService = require('../services/deepgram');
// ElevenLabs yerine Deepgram TTS kullanıyoruz (daha hızlı)
const supabaseService = require('../services/supabase');
const { detectLanguage } = require('../prompts/systemPrompt');
const {
  extractAudioFromTwilioMessage,
  createTwilioMediaMessage,
  createTwilioMarkMessage,
  createTwilioClearMessage,
} = require('../utils/audioUtils');

/**
 * Aktif çağrıları yönetir
 */
class CallSession {
  constructor(callSid, streamSid, ws, callerNumber) {
    this.callSid = callSid;
    this.streamSid = streamSid;
    this.ws = ws;
    this.callerNumber = callerNumber;

    // Konuşma yöneticisi
    this.conversation = new ConversationManager('tr');

    // Deepgram bağlantısı
    this.deepgramConnection = null;

    // Durum yönetimi
    this.isProcessing = false;
    this.isSpeaking = false; // TTS çalıyor mu?
    this.transcriptBuffer = '';
    this.lastTranscriptTime = Date.now();
    this.silenceTimeout = null;

    // Müşteri bilgisi
    this.customer = null;
    this.callLogId = null;

    // Hoş geldin mesajı gönderildi mi?
    this.welcomeSent = false;

    // TTS queue (cümle cümle)
    this.ttsQueue = [];
    this.isPlayingTTS = false;

    console.log(`[CallSession] Yeni oturum: ${callSid}, Arayan: ${callerNumber}`);
  }

  /**
   * Oturumu başlatır
   */
  async start() {
    // Müşteriyi kaydet/getir
    try {
      this.customer = await supabaseService.getOrCreateCustomer(this.callerNumber);
      const callLog = await supabaseService.createCallLog(this.customer.id, {
        callSid: this.callSid,
        from: this.callerNumber,
        to: 'assistant',
        direction: 'inbound',
      });
      this.callLogId = callLog.id;
    } catch (error) {
      console.error('[CallSession] Müşteri kayıt hatası:', error);
    }

    // Deepgram bağlantısını başlat
    this.deepgramConnection = deepgramService.createLiveTranscription(
      (transcript) => this.onTranscript(transcript),
      (error) => this.onDeepgramError(error)
    );

    // Hoş geldin mesajı gönder (kısa bir gecikme ile)
    setTimeout(() => {
      if (!this.welcomeSent) {
        this.sendWelcomeMessage();
        this.welcomeSent = true;
      }
    }, 1000);
  }

  /**
   * Hoş geldin mesajı gönderir
   */
  async sendWelcomeMessage() {
    const welcomeText = 'Merhaba, ben Ayşe, otomotiv asistanınız. Size nasıl yardımcı olabilirim? Test sürüşü randevusu veya servis randevusu için buradayım.';
    await this.speakText(welcomeText);
  }

  /**
   * Twilio'dan gelen mesajları işler
   * @param {string} message - WebSocket mesajı
   */
  async handleMessage(message) {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'connected':
          console.log('[CallSession] Media stream bağlandı');
          break;

        case 'start':
          console.log('[CallSession] Media stream başladı:', data.start);
          this.streamSid = data.start.streamSid;
          break;

        case 'media':
          // Ses verisini Deepgram'a gönder
          if (this.deepgramConnection && data.media?.payload) {
            deepgramService.sendAudio(this.deepgramConnection, data.media.payload);
          }
          break;

        case 'mark':
          console.log('[CallSession] Mark alındı:', data.mark?.name);
          break;

        case 'stop':
          console.log('[CallSession] Media stream durdu');
          this.cleanup();
          break;

        default:
          // console.log('[CallSession] Bilinmeyen event:', data.event);
          break;
      }
    } catch (error) {
      console.error('[CallSession] Mesaj işleme hatası:', error);
    }
  }

  /**
   * Deepgram'dan gelen transcript'i işler
   * @param {Object} transcript - Transcript verisi
   */
  async onTranscript(transcript) {
    // Kullanıcı konuşmaya başladı - BARGE-IN!
    // Sadece asistan cevap verirken (processing) ve konuşurken barge-in yap
    // "alo" gibi kısa kelimeleri ignore et
    const text = transcript.text?.trim() || '';
    if (text && text.length > 3 && this.isSpeaking && this.isProcessing) {
      console.log('[CallSession] BARGE-IN algılandı - konuşma durduruluyor');
      this.interruptSpeaking();
      return; // Barge-in sonrası bu transcript'i işleme
    }

    // Utterance end sinyali
    if (transcript.isUtteranceEnd) {
      if (this.transcriptBuffer.trim() && !this.isProcessing) {
        await this.processUserInput(this.transcriptBuffer.trim());
        this.transcriptBuffer = '';
      }
      return;
    }

    // Final transcript - sadece işlem yapılmıyorsa biriktir
    if (transcript.isFinal && transcript.text && !this.isProcessing) {
      this.transcriptBuffer += ' ' + transcript.text;
      this.lastTranscriptTime = Date.now();

      // Sessizlik timeout'unu sıfırla
      this.resetSilenceTimeout();
    }
  }

  /**
   * Konuşmayı kesintiye uğratır (barge-in)
   */
  interruptSpeaking() {
    // OpenAI stream'i iptal et
    this.conversation.abort();

    // TTS queue'yu temizle
    this.ttsQueue = [];
    this.isPlayingTTS = false;
    this.isSpeaking = false;
    this.isProcessing = false;

    // Twilio'ya ses temizleme komutu gönder
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(createTwilioClearMessage(this.streamSid));
    }
  }

  /**
   * Sessizlik timeout'unu ayarlar
   */
  resetSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      if (this.transcriptBuffer.trim() && !this.isProcessing) {
        this.processUserInput(this.transcriptBuffer.trim());
        this.transcriptBuffer = '';
      }
    }, 1500); // 1.5 saniye sessizlik sonrası işle
  }

  /**
   * Kullanıcı girdisini işler ve yanıt üretir (STREAMING)
   * @param {string} userInput - Kullanıcının söylediği metin
   */
  async processUserInput(userInput) {
    if (this.isProcessing || !userInput) return;

    this.isProcessing = true;
    this.isSpeaking = true;
    console.log(`[CallSession] Kullanıcı: "${userInput}"`);

    try {
      // Dil algılama (ilk birkaç mesajda)
      if (this.conversation.messages.length < 4) {
        const detectedLang = detectLanguage(userInput);
        if (detectedLang !== this.conversation.language) {
          this.conversation.setLanguage(detectedLang);
          console.log(`[CallSession] Dil değiştirildi: ${detectedLang}`);
        }
      }

      // Kullanıcı telefon numarasını conversation'a ekle
      if (this.callerNumber) {
        this.conversation.callerPhone = this.callerNumber;
      }

      // AI'dan yanıt al - her cümleyi hemen TTS'e gönder
      const response = await this.conversation.chat(userInput, async (sentence) => {
        console.log(`[CallSession] Asistan (cümle): "${sentence}"`);
        await this.speakSentence(sentence);
      });

      // Function çağrıldıysa logla
      if (response.functionCalled) {
        console.log(`[CallSession] Function çağrıldı: ${response.functionCalled}`);
      }
    } catch (error) {
      // Abort hatası normal - barge-in oldu
      if (error.message?.includes('aborted')) {
        console.log('[CallSession] İşlem iptal edildi (barge-in)');
        return;
      }
      console.error('[CallSession] İşleme hatası:', error);
      await this.speakSentence('Bir hata oluştu, lütfen tekrar deneyin.');
    } finally {
      this.isProcessing = false;
      this.isSpeaking = false;
    }
  }

  /**
   * Tek bir cümleyi sese dönüştürüp Twilio'ya gönderir (hızlı)
   * @param {string} sentence - Söylenecek cümle
   */
  async speakSentence(sentence) {
    if (!sentence || !this.ws || this.ws.readyState !== 1) {
      console.log('[CallSession] speakSentence atlandı - ws durumu:', this.ws?.readyState);
      return;
    }

    try {
      let chunkCount = 0;
      // Deepgram TTS'den ses al ve stream et
      await deepgramService.textToSpeechStream(sentence, (audioChunk) => {
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(createTwilioMediaMessage(this.streamSid, audioChunk));
          chunkCount++;
        }
      });
      console.log(`[CallSession] TTS gönderildi: "${sentence.substring(0, 30)}..." (${chunkCount} chunk)`);
    } catch (error) {
      console.error('[CallSession] TTS hatası:', error);
    }
  }

  /**
   * Metni sese dönüştürüp Twilio'ya gönderir (hoş geldin mesajı için)
   * @param {string} text - Söylenecek metin
   */
  async speakText(text) {
    if (!text || !this.ws || this.ws.readyState !== 1) return;

    this.isSpeaking = true;
    try {
      // Deepgram TTS'den ses al ve stream et
      await deepgramService.textToSpeechStream(text, (audioChunk) => {
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(createTwilioMediaMessage(this.streamSid, audioChunk));
        }
      });

      // Ses bittiğinde mark gönder
      this.ws.send(createTwilioMarkMessage(this.streamSid, `speech_${Date.now()}`));
    } catch (error) {
      console.error('[CallSession] TTS hatası:', error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * Deepgram hata callback'i
   * @param {Error} error - Hata
   */
  onDeepgramError(error) {
    console.error('[CallSession] Deepgram hatası:', error);
    // Bağlantıyı yeniden kur
    setTimeout(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.deepgramConnection = deepgramService.createLiveTranscription(
          (transcript) => this.onTranscript(transcript),
          (error) => this.onDeepgramError(error)
        );
      }
    }, 1000);
  }

  /**
   * Oturumu temizler
   */
  async cleanup() {
    console.log(`[CallSession] Oturum temizleniyor: ${this.callSid}`);

    // Timeout'ları temizle
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    // Deepgram bağlantısını kapat
    if (this.deepgramConnection) {
      deepgramService.closeConnection(this.deepgramConnection);
    }

    // Arama kaydını güncelle
    if (this.callLogId) {
      try {
        // Konuşma özetini kaydet
        const transcript = this.conversation.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');

        await supabaseService.updateCallLog(this.callLogId, {
          status: 'completed',
          transcript,
        });
      } catch (error) {
        console.error('[CallSession] Arama kaydı güncelleme hatası:', error);
      }
    }
  }
}

/**
 * Aktif oturumları saklar
 */
const activeSessions = new Map();

/**
 * Yeni çağrı oturumu oluşturur
 * @param {string} callSid - Twilio Call SID
 * @param {string} streamSid - Twilio Stream SID
 * @param {WebSocket} ws - WebSocket bağlantısı
 * @param {string} callerNumber - Arayan numara
 * @returns {CallSession} Oturum
 */
function createSession(callSid, streamSid, ws, callerNumber) {
  const session = new CallSession(callSid, streamSid, ws, callerNumber);
  activeSessions.set(callSid, session);
  return session;
}

/**
 * Oturum getirir
 * @param {string} callSid - Twilio Call SID
 * @returns {CallSession|undefined} Oturum
 */
function getSession(callSid) {
  return activeSessions.get(callSid);
}

/**
 * Oturumu siler
 * @param {string} callSid - Twilio Call SID
 */
function removeSession(callSid) {
  const session = activeSessions.get(callSid);
  if (session) {
    session.cleanup();
    activeSessions.delete(callSid);
  }
}

module.exports = {
  CallSession,
  createSession,
  getSession,
  removeSession,
};
