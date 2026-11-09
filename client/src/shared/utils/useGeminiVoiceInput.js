import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

/**
 * Universal Voice Recognition Hook:
 * 1. Primary Engine: Google Gemini Multimodal Audio (`/api/store-public/voice/transcribe`) via MediaRecorder.
 *    Uses active Gemini 3.5 / 3.1 Flash audio models on the backend.
 * 2. Secondary Fallback: Official Browser Web Speech API (`window.SpeechRecognition || window.webkitSpeechRecognition`).
 *
 * Interaction Model:
 * - Click 1: Starts recording cleanly (never auto-cuts prematurely while the user is speaking).
 * - Click 2: Stops recording and immediately transcribes via Gemini Audio (in ~1.5-2s).
 * - If Gemini is unavailable/offline, automatically falls back to Browser SpeechRecognition.
 */
export function useGeminiVoiceInput({
  onTranscript,
  onResult,
  onInterim,
  onError,
  contextHint = 'search',
  showToast,
  maxDurationMs = 30000
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [engineUsed, setEngineUsed] = useState(null); // 'gemini' | 'browser'

  // Keep latest callbacks in refs so closures inside MediaRecorder/SpeechRecognition never go stale
  const callbacksRef = useRef({ onTranscript, onResult, onInterim, onError, showToast });
  useEffect(() => {
    callbacksRef.current = { onTranscript, onResult, onInterim, onError, showToast };
  }, [onTranscript, onResult, onInterim, onError, showToast]);

  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const browserTranscriptRef = useRef('');
  const maxTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const hasDeliveredResultRef = useRef(false);

  const deliverTranscript = useCallback((text, provider) => {
    const clean = String(text || '').trim();
    if (!clean || hasDeliveredResultRef.current) return false;
    hasDeliveredResultRef.current = true;
    setEngineUsed(provider);
    const cb = callbacksRef.current.onTranscript || callbacksRef.current.onResult;
    if (cb) cb(clean, provider);
    return true;
  }, []);

  const notifyError = useCallback((msg) => {
    if (callbacksRef.current.onError) {
      callbacksRef.current.onError(msg);
    } else if (callbacksRef.current.showToast) {
      callbacksRef.current.showToast(msg, 'error');
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stopRecordingInternal = useCallback(() => {
    isRecordingRef.current = false;
    clearTimers();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsListening(false);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsListening(false);
    }
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      stopRecordingInternal();
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
      }
    };
  }, [stopRecordingInternal]);

  const startBrowserFallbackOnly = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      notifyError('التعرف الصوتي غير مدعوم في هذا المتصفح');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = 'ar-EG';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isRecordingRef.current = true;
        setIsListening(true);
        setEngineUsed('browser');
        callbacksRef.current.showToast?.('🎤 جاري الاستماع عبر المتصفح... تحدث الآن', 'info');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalStr += t + ' ';
          } else {
            interim += t;
          }
        }
        const combined = (finalStr || interim).trim();
        if (combined) {
          browserTranscriptRef.current = combined;
          callbacksRef.current.onInterim?.(combined);
        }
      };

      recognition.onerror = () => {
        isRecordingRef.current = false;
        setIsListening(false);
        notifyError('تعذر التقاط الصوت عبر المتصفح، يرجى المحاولة مرة أخرى');
      };

      recognition.onend = () => {
        isRecordingRef.current = false;
        setIsListening(false);
        const finalTxt = browserTranscriptRef.current.trim();
        if (finalTxt) {
          deliverTranscript(finalTxt, 'browser');
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Browser speech fallback error:', err);
      isRecordingRef.current = false;
      setIsListening(false);
    }
  }, [deliverTranscript, notifyError]);

  const toggleVoice = useCallback(async () => {
    // Click 2: If currently recording, stop immediately and send audio to Gemini!
    if (isRecordingRef.current || isListening) {
      stopRecordingInternal();
      return;
    }

    // If a previous transcription request was in flight, abort it so the user can record again immediately
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    setIsTranscribing(false);

    browserTranscriptRef.current = '';
    hasDeliveredResultRef.current = false;

    // If browser doesn't support MediaRecorder, use Browser SpeechRecognition directly
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      startBrowserFallbackOnly();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        isRecordingRef.current = false;
        clearTimers();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsListening(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });

        if (audioBlob.size < 300) {
          notifyError('التسجيل قصير جداً، اضغط على المايك وتحدث ثم اضغط مرة أخرى للإيقاف');
          return;
        }

        // Send to Primary Engine: Gemini Audio Transcription
        setIsTranscribing(true);
        callbacksRef.current.showToast?.('⏳ جاري تحويل الصوت إلى نص عبر Gemini...', 'info');
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice.webm');
          formData.append('contextHint', contextHint);

          const res = await axios.post('/api/store-public/voice/transcribe', formData, {
            signal: controller.signal,
            timeout: 18000
          });
          const geminiText = (res.data?.text || '').trim();

          if (res.data?.done && geminiText) {
            deliverTranscript(geminiText, 'gemini');
            return;
          }
          throw new Error(res.data?.error || 'لم يتم استخراج نص واضح');
        } catch (gemErr) {
          if (axios.isCancel(gemErr)) return;
          const errMsg = gemErr.response?.data?.error || gemErr.message || '';
          console.warn('[VOICE_GEMINI_ERR]:', errMsg);

          // If user recorded silence, tell them clearly
          if (errMsg.includes('لم يتم سماع كلام واضح')) {
            notifyError(errMsg);
            return;
          }

          // Otherwise, automatically launch Browser Official SpeechRecognition Fallback!
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRec) {
            callbacksRef.current.showToast?.(
              'تعذر الاتصال بـ Gemini Audio — تم تشغيل التعرف الصوتي للمتصفح تلقائياً، تحدث الآن',
              'info'
            );
            startBrowserFallbackOnly();
          } else {
            notifyError(errMsg || 'تعذر التعرف على الصوت، يرجى المحاولة مرة أخرى');
          }
        } finally {
          setIsTranscribing(false);
          abortControllerRef.current = null;
        }
      };

      mediaRecorder.start(250);
      isRecordingRef.current = true;
      setIsListening(true);
      setEngineUsed('gemini');
      callbacksRef.current.showToast?.('🔴 جاري التسجيل... تحدث الآن ثم اضغط على علامة المايك مرة أخرى للإرسال', 'info');

      // Safety max duration timer (30 seconds)
      maxTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          stopRecordingInternal();
        }
      }, maxDurationMs);
    } catch (err) {
      console.warn('MediaRecorder mic access failed, falling back to Browser SpeechRecognition:', err);
      startBrowserFallbackOnly();
    }
  }, [
    contextHint,
    maxDurationMs,
    isListening,
    clearTimers,
    stopRecordingInternal,
    startBrowserFallbackOnly,
    deliverTranscript,
    notifyError
  ]);

  return {
    isListening,
    isTranscribing,
    isProcessing: isTranscribing,
    engineUsed,
    toggleVoice,
    stopVoice: stopRecordingInternal
  };
}

export default useGeminiVoiceInput;
