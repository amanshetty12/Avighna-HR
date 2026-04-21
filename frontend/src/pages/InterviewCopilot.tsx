import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, ShieldCheck, Brain, Link, UserCheck, Loader2, Radio, Monitor, Mic } from 'lucide-react';
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

type InterviewMode = 'virtual' | 'in-person';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const InterviewCopilot = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState('Neural Copilot Ready');
  const [mode, setMode] = useState<InterviewMode>('virtual');
  
  const isRecordingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastSpeakerRef = useRef<'INT' | 'CAN'>('INT');
  
  // Mic refs
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSocketRef = useRef<WebSocket | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micIntervalRef = useRef<any>(null);

  // System audio refs (virtual mode only)
  const sysStreamRef = useRef<MediaStream | null>(null);
  const sysSocketRef = useRef<WebSocket | null>(null);
  const sysRecorderRef = useRef<MediaRecorder | null>(null);

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
        setInterimText(""); 
        setTranscript(prev => [...prev, { role: lastSpeakerRef.current, text: goldText, isFinal: true }]);
        
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

  // Creates a Deepgram WebSocket for a specific role
  const createDeepgramSocket = (role: 'INT' | 'CAN', useDiarization: boolean): WebSocket | null => {
    if (!DEEPGRAM_KEY) return null;
    
    let url = 'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true';
    if (useDiarization) {
      url += '&diarize=true';
    }
    
    const socket = new WebSocket(url, ['token', DEEPGRAM_KEY]);

    socket.onopen = () => {
      console.log(`Deepgram [${role}] WebSocket Active`);
    };

    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (!data.channel?.alternatives?.[0]) return;
      
      const text = data.channel.alternatives[0].transcript;
      if (!text) return;

      let assignedRole: 'INT' | 'CAN' = role;

      // In diarization mode (in-person), use speaker IDs
      if (useDiarization) {
        const speakerId = data.channel.alternatives[0].words?.[0]?.speaker ?? 0;
        // Speaker 0 = first speaker = Interviewer, Speaker 1+ = Candidate
        assignedRole = speakerId === 0 ? 'INT' : 'CAN';
        console.log(`[IN-PERSON | Speaker ${speakerId}] -> ${assignedRole}: ${text}`);
      } else {
        console.log(`[${role} SOCKET] -> ${assignedRole}: ${text}`);
      }

      lastSpeakerRef.current = assignedRole;
      setInterimText(JSON.stringify({ role: assignedRole, text }));
    };

    socket.onerror = (e) => {
      console.error(`Deepgram [${role}] error:`, e);
    };

    return socket;
  };

  // Pipes a MediaStream into a Deepgram WebSocket
  const pipeStreamToSocket = (stream: MediaStream, socket: WebSocket): MediaRecorder => {
    const recorder = new MediaRecorder(stream, { 
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && socket.readyState === 1) {
        socket.send(e.data);
      }
    };

    recorder.start(250); // 250ms slices for real-time streaming
    return recorder;
  };

  // ============ VIRTUAL MODE: Two separate WebSockets ============
  const startVirtual = async () => {
    setStatus('Requesting Mic + Tab Audio...');

    // 1. Get Microphone
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
    });
    micStreamRef.current = micStream;

    // 2. Get System/Tab Audio
    const sysStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true, 
      audio: {
        channelCount: 1,
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false
      } as any
    });
    sysStreamRef.current = sysStream;

    if (!sysStream.getAudioTracks().length) {
      throw new Error("System Audio not shared. Please check 'Share tab audio' when sharing.");
    }

    // 3. Create TWO separate Deepgram WebSockets (bypasses Chrome mono limitation!)
    const micSocket = createDeepgramSocket('INT', false);
    const sysSocket = createDeepgramSocket('CAN', false);
    
    if (!micSocket || !sysSocket) throw new Error("Deepgram API key missing");

    micSocketRef.current = micSocket;
    sysSocketRef.current = sysSocket;

    // Wait for both sockets to open before piping audio
    await Promise.all([
      new Promise<void>((resolve) => { micSocket.addEventListener('open', () => resolve()); }),
      new Promise<void>((resolve) => { sysSocket.addEventListener('open', () => resolve()); }),
    ]);

    // 4. Pipe each stream to its own WebSocket independently
    // This is the key fix: no merging, no stereo, no Chrome downmixing!
    micRecorderRef.current = pipeStreamToSocket(micStream, micSocket);
    
    // For system audio, we extract just the audio tracks into a new stream
    const sysAudioOnly = new MediaStream(sysStream.getAudioTracks());
    sysRecorderRef.current = pipeStreamToSocket(sysAudioOnly, sysSocket);

    // 5. Whisper chunk processing on mic only
    const whisperRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
    whisperRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) micChunksRef.current.push(e.data);
    };
    whisperRecorder.onstop = () => {
      const blob = new Blob(micChunksRef.current, { type: 'audio/webm' });
      micChunksRef.current = [];
      processWhisperChunk(blob);
      if (isRecordingRef.current) whisperRecorder.start();
    };
    whisperRecorder.start();
    micIntervalRef.current = setInterval(() => {
      if (whisperRecorder.state === 'recording') whisperRecorder.stop();
    }, 6000);

    setStatus('Dual-Socket Active (Mic=INT, Tab=CAN)');
  };

  // ============ IN-PERSON MODE: Single mic with diarization ============
  const startInPerson = async () => {
    setStatus('Requesting Microphone...');

    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } 
    });
    micStreamRef.current = micStream;

    // Single socket with diarization
    const socket = createDeepgramSocket('INT', true);
    if (!socket) throw new Error("Deepgram API key missing");
    micSocketRef.current = socket;

    await new Promise<void>((resolve) => { socket.addEventListener('open', () => resolve()); });

    micRecorderRef.current = pipeStreamToSocket(micStream, socket);

    // Whisper chunk processing
    const whisperRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
    whisperRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) micChunksRef.current.push(e.data);
    };
    whisperRecorder.onstop = () => {
      const blob = new Blob(micChunksRef.current, { type: 'audio/webm' });
      micChunksRef.current = [];
      processWhisperChunk(blob);
      if (isRecordingRef.current) whisperRecorder.start();
    };
    whisperRecorder.start();
    micIntervalRef.current = setInterval(() => {
      if (whisperRecorder.state === 'recording') whisperRecorder.stop();
    }, 6000);

    setStatus('In-Person Mode Active (AI Diarization)');
  };

  const startCopilot = async () => {
    try {
      isRecordingRef.current = true;
      setIsRecording(true);

      if (mode === 'virtual') {
        await startVirtual();
      } else {
        await startInPerson();
      }
    } catch (err: any) {
      console.error("Start error", err);
      setStatus(`Error: ${err.message}`);
      stopCopilot();
    }
  };

  const stopCopilot = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (micIntervalRef.current) clearInterval(micIntervalRef.current);
    
    // Stop recorders
    micRecorderRef.current?.stop();
    sysRecorderRef.current?.stop();

    // Close sockets
    micSocketRef.current?.close();
    sysSocketRef.current?.close();
    
    // Stop all tracks
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    sysStreamRef.current?.getTracks().forEach(t => t.stop());

    setStatus('Copilot Standby.');
    setInterimText("");
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Radio size={14} className={isRecording ? 'animate-pulse' : ''} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{isRecording ? 'DUAL_SOCKET_LIVE' : 'NEURAL_STBY'}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Copilot</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          {!isRecording && (
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setMode('virtual')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all ${
                  mode === 'virtual' 
                    ? 'bg-accent/20 text-accent border-accent/30' 
                    : 'text-secondary hover:text-white'
                }`}
              >
                <Monitor size={14} />
                Virtual
              </button>
              <button
                onClick={() => setMode('in-person')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all ${
                  mode === 'in-person' 
                    ? 'bg-accent/20 text-accent border-accent/30' 
                    : 'text-secondary hover:text-white'
                }`}
              >
                <Mic size={14} />
                In-Person
              </button>
            </div>
          )}
          <button 
            onClick={isRecording ? stopCopilot : startCopilot}
            className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white text-black hover:bg-white/90'}`}
          >
            {isRecording ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> : <Play size={16} />}
            {isRecording ? 'STOP_ANALYSIS' : 'START_COPILOT'}
          </button>
        </div>
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
                <span className="text-[10px] font-mono text-secondary">
                  {mode === 'virtual' ? 'DUAL_SOCKET' : 'DIARIZE'} + WHISPER_V3
                </span>
                {isProcessing && <Loader2 className="animate-spin text-accent" size={14} />}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide">
              {transcript.length === 0 && !interimText && !isRecording && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Brain size={48} className="mb-4" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
                    {mode === 'virtual' 
                      ? 'Virtual mode: Mic + Tab Audio (two separate streams)' 
                      : 'In-person mode: Single mic with AI voice separation'}
                  </p>
                </div>
              )}
              
              {transcript.map((line, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${line.role === 'INT' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] flex flex-col ${line.role === 'INT' ? 'items-start' : 'items-end'}`}>
                    <span className={`text-[9px] font-mono uppercase tracking-widest mb-1 opacity-50 ${line.role === 'INT' ? 'text-secondary' : 'text-accent'}`}>
                       {line.role === 'INT' ? 'INTERVIEWER_VERIFIED' : 'CANDIDATE_VERIFIED'}
                    </span>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                      line.role === 'INT' 
                        ? 'bg-secondary/10 border-secondary/20 text-white' 
                        : 'bg-accent/10 border-accent/20 text-white'
                    }`}>
                      {line.text}
                    </div>
                  </div>
                </motion.div>
              ))}

              {interimText && (() => {
                try {
                  const data = JSON.parse(interimText);
                  return (
                    <motion.div className={`flex ${data.role === 'INT' ? 'justify-start' : 'justify-end'} opacity-60 italic`}>
                      <div className={`max-w-[85%] flex flex-col ${data.role === 'INT' ? 'items-start' : 'items-end'}`}>
                        <span className={`text-[9px] font-mono uppercase tracking-widest mb-1 ${data.role === 'INT' ? 'text-secondary' : 'text-accent'}`}>
                          {data.role === 'INT' ? 'INT_LIVE' : 'CAN_LIVE'}
                        </span>
                        <div className="p-4 rounded-2xl text-sm leading-relaxed bg-white/5 border border-white/10 text-white/70">
                          {data.text}...
                        </div>
                      </div>
                    </motion.div>
                  );
                } catch (e) {
                  return null;
                }
              })()}
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
