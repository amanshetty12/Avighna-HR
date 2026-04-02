import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, ShieldCheck, Brain, Link, UserCheck, Loader2, Radio } from 'lucide-react';
import axios from 'axios';

interface TranscriptLine {
  role: 'INT' | 'CAN';
  text: string;
  isFinal?: boolean;
}

interface Match {
  name: string;
  company: string;
  role: string;
  linkedinUrl: string;
  snippet: string;
  confirmed?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const InterviewCopilot = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState('Neural Copilot Ready');
  
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const processWhisperChunk = async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return; 
    
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'chunk.webm');

    try {
      // Whisper-v3-Turbo for "Gold Standard" Transcript
      const transRes = await axios.post(`${API_BASE}/interview/transcribe`, formData);
      const goldText = transRes.data.transcript;
      
      if (goldText && goldText.trim().length > 2) {
        // Clear interim text as we now have "Gold" text for this segment
        setInterimText(""); 
        setTranscript(prev => [...prev, { role: 'CAN', text: goldText, isFinal: true }]);
        
        // Trigger Analysis on the Gold Text
        const extractRes = await axios.post(`${API_BASE}/interview/analyze-stream?text=${encodeURIComponent(goldText)}`);
        const newEntities = extractRes.data.entities;
        
        if (newEntities && newEntities.length > 0) {
            newEntities.forEach((ent: any) => {
              const match = ent.matches[0];
              if (match && !matches.find(m => m.name === ent.entity.name)) {
                setMatches(prev => [...prev, {
                  name: ent.entity.name,
                  company: ent.entity.company,
                  role: ent.entity.role,
                  linkedinUrl: match.link,
                  snippet: match.snippet,
                  confirmed: false
                }]);
              }
            });
            setStatus('Network match identified.');
        }
      }
    } catch (e) {
      console.error("Whisper error", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const startCopilot = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Setup Deepgram Nova-2 for Live Real-time Text
      if (DEEPGRAM_KEY) {
        const socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', [
            'token',
            DEEPGRAM_KEY,
        ]);

        socket.onopen = () => console.log("Deepgram Live Stream Active");
        socket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            const transcript = data.channel?.alternatives[0]?.transcript;
            if (transcript) {
                setInterimText(prev => prev + " " + transcript);
            }
        };
        deepgramSocketRef.current = socket;
      }

      // 2. Setup MediaRecorder for Chunked Whisper Processing
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            chunksRef.current.push(e.data);
            if (deepgramSocketRef.current?.readyState === 1) {
                deepgramSocketRef.current.send(e.data);
            }
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        processWhisperChunk(blob);
        if (isRecordingRef.current) {
          mediaRecorder.start();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      mediaRecorder.start(250); // Small slices for Deepgram
      setStatus('Hybrid ASR Active (Deepgram + Whisper)');

      // 6-second intervals for Whisper accuracy
      intervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 6000);

    } catch (err: any) {
      console.error("Start error", err);
      setStatus(`Error: ${err.message}`);
    }
  };

  const stopCopilot = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    mediaRecorderRef.current?.stop();
    deepgramSocketRef.current?.close();
    setStatus('Copilot Standby.');
    setInterimText("");
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Radio size={14} className={isRecording ? 'animate-pulse' : ''} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{isRecording ? 'HYBRID_SYNC_LIVE' : 'NEURAL_STBY'}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Copilot</h2>
        </div>
        <button 
          onClick={isRecording ? stopCopilot : startCopilot}
          className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white text-black hover:bg-white/90'}`}
        >
          {isRecording ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> : <Play size={16} />}
          {isRecording ? 'STOP_ANALYSIS' : 'START_COPILOT'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="premium-card min-h-[500px] lg:h-[650px] flex flex-col p-0 overflow-hidden relative border-white/5">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
              <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-tight">
                <Terminal size={18} className="text-secondary" />
                NEURAL_TRANSCRIPT
              </h3>
              <div className="flex gap-4 items-center">
                <span className="text-[10px] font-mono text-secondary">NOVA_2 + WHISPER_V3</span>
                {isProcessing && <Loader2 className="animate-spin text-accent" size={14} />}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide">
              {transcript.length === 0 && !interimText && !isRecording && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Brain size={48} className="mb-4" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em]">Ready for hybrid capture</p>
                </div>
              )}
              
              {transcript.map((line, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] flex flex-col items-end">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-accent mb-1 opacity-50">VERIFIED_WHISPER</span>
                    <div className="p-4 rounded-2xl text-sm leading-relaxed bg-accent/10 border border-accent/20 text-white">
                      {line.text}
                    </div>
                  </div>
                </motion.div>
              ))}

              {interimText && (
                <motion.div className="flex justify-end opacity-60 italic">
                  <div className="max-w-[85%] flex flex-col items-end">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-secondary mb-1">NOVA_2_LIVE</span>
                    <div className="p-4 rounded-2xl text-sm leading-relaxed bg-white/5 border border-white/10 text-white/70">
                      {interimText}...
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {isRecording && (
               <div className="p-4 bg-black/40 backdrop-blur-sm border-t border-white/5 flex items-center gap-4">
                  <div className="flex gap-1">
                    {[1,2,3].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: [4, 12, 4] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                        className="w-1 bg-accent rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">{status}</span>
               </div>
            )}
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card bg-accent/5 border-accent/20 p-6 md:p-8">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-sm uppercase tracking-tight text-accent">
              <ShieldCheck size={18} />
              IDENTIFIED_NETWORK
            </h3>
            
            <div className="space-y-4">
              <AnimatePresence>
                {matches.map((match, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`premium-card border-white/10 p-5 space-y-4 hover:border-accent/40 transition-all ${match.confirmed ? 'bg-green-400/5 border-green-400/20' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-bold text-base flex items-center gap-2 text-white">
                          {match.name}
                          {match.confirmed && <UserCheck size={14} className="text-green-400" />}
                        </h4>
                        <p className="text-[10px] text-secondary font-mono uppercase truncate max-w-[150px]">{match.role} @ {match.company}</p>
                      </div>
                      <a href={match.linkedinUrl} target="_blank" className="p-2 bg-white/5 rounded-lg text-secondary hover:text-white transition-colors">
                        <Link size={16} />
                      </a>
                    </div>
                    
                    <p className="text-xs text-secondary italic leading-normal border-l-2 border-accent/30 pl-3 line-clamp-3">
                      "{match.snippet}"
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              {matches.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center text-secondary/30">
                  <Brain size={32} className="mb-4 opacity-10" />
                  <p className="text-[10px] font-mono uppercase tracking-widest leading-relaxed">AI is listening. Nova-2 showing real-time, Whisper verifying entities.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewCopilot;
