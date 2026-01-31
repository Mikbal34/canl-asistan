const OpenAI = require('openai');
const config = require('../config/env');
const { functionDefinitions, processFunctionCall } = require('../prompts/functions');
const { getSystemPrompt } = require('../prompts/systemPrompt');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Konuşma geçmişini yönetir ve AI yanıtı alır
 */
class ConversationManager {
  constructor(language = 'tr') {
    this.language = language;
    this.messages = [
      {
        role: 'system',
        content: getSystemPrompt(language),
      },
    ];
    this.abortController = null;
  }

  /**
   * Mevcut streaming'i iptal eder (barge-in için)
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Kullanıcı mesajı ekler ve AI yanıtı alır (STREAMING)
   * @param {string} userMessage - Kullanıcının söylediği metin
   * @param {Function} onSentence - Her cümle tamamlandığında çağrılacak callback
   * @returns {Object} AI yanıtı ve olası function call
   */
  async chat(userMessage, onSentence = null) {
    // Kullanıcı mesajını ekle
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    this.abortController = new AbortController();

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Daha hızlı model
        messages: this.messages,
        tools: functionDefinitions,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 300,
        stream: true,
      }, { signal: this.abortController.signal });

      let fullText = '';
      let sentenceBuffer = '';
      let toolCalls = [];
      let currentToolCall = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Tool call handling
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        // Text content handling
        if (delta?.content) {
          fullText += delta.content;
          sentenceBuffer += delta.content;

          // Cümle bitişi kontrolü (. ? ! veya virgülden sonra boşluk)
          const sentenceEnd = sentenceBuffer.match(/[.!?]\s|[.!?]$/);
          if (sentenceEnd && onSentence) {
            const sentence = sentenceBuffer.trim();
            if (sentence.length > 5) { // Çok kısa cümleleri atla
              onSentence(sentence);
            }
            sentenceBuffer = '';
          }
        }
      }

      // Kalan buffer'ı gönder
      if (sentenceBuffer.trim() && onSentence) {
        onSentence(sentenceBuffer.trim());
      }

      // Mesajı kaydet
      const assistantMessage = {
        role: 'assistant',
        content: fullText || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      };
      this.messages.push(assistantMessage);

      // Function call var mı kontrol et
      if (toolCalls.length > 0) {
        return await this.handleFunctionCalls(toolCalls, onSentence);
      }

      return {
        text: fullText,
        functionCalled: null,
        functionResult: null,
      };
    } catch (error) {
      // Abort hatası - barge-in için normal
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('[OpenAI] Stream iptal edildi (barge-in)');
        return { text: '', functionCalled: null, functionResult: null };
      }
      console.error('[OpenAI] Hata:', error);
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Function call'ları işler (streaming destekli)
   * @param {Array} toolCalls - AI'ın çağırmak istediği fonksiyonlar
   * @param {Function} onSentence - Her cümle tamamlandığında çağrılacak callback
   * @returns {Object} İşlenmiş yanıt
   */
  async handleFunctionCalls(toolCalls, onSentence = null) {
    const results = [];

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log(`[OpenAI] Function call: ${functionName}`, functionArgs);

      // Fonksiyonu çalıştır
      const result = await processFunctionCall(functionName, functionArgs);

      results.push({
        name: functionName,
        args: functionArgs,
        result,
      });

      // Sonucu mesajlara ekle
      this.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Function sonuçlarıyla tekrar AI'dan yanıt al (streaming)
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: this.messages,
      tools: functionDefinitions,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 300,
      stream: true,
    });

    let fullText = '';
    let sentenceBuffer = '';
    let newToolCalls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!newToolCalls[tc.index]) {
              newToolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            }
            if (tc.id) newToolCalls[tc.index].id = tc.id;
            if (tc.function?.name) newToolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) newToolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      if (delta?.content) {
        fullText += delta.content;
        sentenceBuffer += delta.content;

        const sentenceEnd = sentenceBuffer.match(/[.!?]\s|[.!?]$/);
        if (sentenceEnd && onSentence) {
          const sentence = sentenceBuffer.trim();
          if (sentence.length > 5) {
            onSentence(sentence);
          }
          sentenceBuffer = '';
        }
      }
    }

    if (sentenceBuffer.trim() && onSentence) {
      onSentence(sentenceBuffer.trim());
    }

    const followUpMessage = {
      role: 'assistant',
      content: fullText || null,
      tool_calls: newToolCalls.length > 0 ? newToolCalls : undefined,
    };
    this.messages.push(followUpMessage);

    // Recursive function call kontrolü
    if (newToolCalls.length > 0) {
      return await this.handleFunctionCalls(newToolCalls, onSentence);
    }

    return {
      text: fullText,
      functionCalled: results[0]?.name,
      functionResult: results[0]?.result,
    };
  }

  /**
   * Dil değiştirir
   * @param {string} language - 'tr' veya 'en'
   */
  setLanguage(language) {
    this.language = language;
    this.messages[0].content = getSystemPrompt(language);
  }

  /**
   * Konuşma geçmişini temizler
   */
  reset() {
    this.messages = [
      {
        role: 'system',
        content: getSystemPrompt(this.language),
      },
    ];
  }
}

module.exports = {
  ConversationManager,
};
