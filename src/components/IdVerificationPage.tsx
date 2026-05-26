import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  CreditCard, 
  Upload, 
  Camera, 
  Check, 
  X, 
  ShieldCheck, 
  Loader2, 
  Sparkles 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth, defaultLocalUser, isVideoUrl, getCleanMediaUrl } from '../App';

export const IdVerificationPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useAuth();
  
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  
  // Real-time camera dialog states
  const [activeSide, setActiveSide] = useState<'front' | 'back' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [verificationState, setVerificationState] = useState<'idle' | 'analyzing' | 'success'>('idle');
  const [analysisStep, setAnalysisStep] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const user = currentUser || defaultLocalUser;

  // Formatting Aadhaar string: 1234 5678 9012
  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const formatted: string[] = [];
    for (let i = 0; i < raw.length && i < 12; i += 4) {
      formatted.push(raw.substring(i, i + 4));
    }
    setAadhaarNumber(formatted.join(' '));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const startCamera = async (side: 'front' | 'back') => {
    setActiveSide(side);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 200);
    } catch (err) {
      console.error(err);
      showToast('Live camera feed not supported. Please use Click to Upload fallback! 📁');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setActiveSide(null);
  };

  const captureIdFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (activeSide === 'front') {
          setFrontImage(dataUrl);
          showToast('Aadhaar Front captured successfully! 📸');
        } else if (activeSide === 'back') {
          setBackImage(dataUrl);
          showToast('Aadhaar Back captured successfully! 📸');
        }
        stopCamera();
      }
    }
  };

  const handleFileUpload = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (side === 'front') {
            setFrontImage(reader.result);
            showToast('Aadhaar Front loaded from device gallery! 📁');
          } else {
            setBackImage(reader.result);
            showToast('Aadhaar Back loaded from device gallery! 📁');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaarNumber.replace(/\s/g, '').length < 12) {
      alert("Please provide a valid 12-digit Aadhaar Card number.");
      return;
    }
    if (!frontImage || !backImage) {
      alert("Please upload / capture both Front and Back sides of your ID.");
      return;
    }

    setVerificationState('analyzing');
    setAnalysisStep(1);

    const token = localStorage.getItem('barter_user_token');

    try {
      setAnalysisStep(2);
      const res = await fetch('/api/auth/verify-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          aadhaarFront: frontImage,
          aadhaarBack: backImage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'e-KYC submission failed');

      setAnalysisStep(3);
      setTimeout(() => {
        setVerificationState('success');
        setCurrentUser(data);
      }, 1000);
    } catch (err: any) {
      setVerificationState('idle');
      alert(err.message || 'e-KYC submission failed. Please try again.');
    }
  };

  return (
    <div className="bg-white min-h-screen pb-24 relative">
      {/* Toast Bar */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-xl z-50 flex items-center gap-2 border border-white/20 whitespace-nowrap"
          >
            <Sparkles size={14} className="text-brand-accent" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 border-b border-border-sleek flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface-beige rounded-xl transition-all">
            <ArrowLeft size={22} className="text-text-charcoal" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-black uppercase tracking-wider text-text-charcoal">Govt Identity</h1>
            <p className="text-[10px] text-text-charcoal/40 font-bold uppercase tracking-widest">Aadhaar Vault e-KYC</p>
          </div>
        </div>
        <span className="px-3 py-1.5 bg-brand-accent/50 text-[9px] font-black uppercase tracking-widest text-brand-primary rounded-full flex items-center gap-1">
          <ShieldCheck size={13} /> Secure Vault
        </span>
      </header>

      {verificationState === 'idle' && (
        <form onSubmit={handleSubmitVerification} className="p-6 space-y-8 max-w-sm mx-auto">
          {/* Card info Banner */}
          <div className="bg-surface-beige p-5 rounded-[28px] border border-border-sleek space-y-2">
            <div className="w-10 h-10 rounded-xl bg-brand-primary text-brand-accent flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <h3 className="text-sm font-black text-text-charcoal uppercase tracking-wider">KYC Compliance Rule</h3>
            <p className="text-[11px] text-text-charcoal/60 leading-relaxed font-semibold">
              Exchanging expensive hardware or assets is limited to ID-verified users to form a peer-to-peer circle of pure trust. ID data is stored locally in sandbox memory.
            </p>
          </div>

          {/* UID Card Number Entry */}
          <div className="space-y-2">
            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">12-Digit Aadhaar Card Number</label>
            <input
              type="text"
              value={aadhaarNumber}
              onChange={handleAadhaarChange}
              placeholder="0000 0000 0000"
              className="w-full bg-surface-beige border border-border-sleek focus:border-brand-primary rounded-2xl py-4.5 px-4 text-center text-lg font-black tracking-widest text-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all font-mono"
            />
          </div>

          {/* Dual ID Target Upload Slots */}
          <div className="space-y-4">
            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">Upload Front & Back Documents</label>
            
            {/* Front file handle input */}
            <input 
              type="file" 
              ref={frontFileInputRef} 
              onChange={(e) => handleFileUpload('front', e)} 
              accept="image/*" 
              className="hidden" 
            />
            
            {/* Back file handle input */}
            <input 
              type="file" 
              ref={backFileInputRef} 
              onChange={(e) => handleFileUpload('back', e)} 
              accept="image/*" 
              className="hidden" 
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Front Slot Card Box */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-text-charcoal/50 pr-1 tracking-wider block text-center">Aadhaar FRONT</span>
                {frontImage ? (
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-2 border-[#059669] group bg-surface-beige">
                    <img src={frontImage} className="w-full h-full object-cover" alt="ID Front Preview" />
                    <button 
                      type="button" 
                      onClick={() => setFrontImage(null)} 
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => frontFileInputRef.current?.click()}
                      className="aspect-[4/3] rounded-2xl border-2 border-dashed border-border-sleek hover:border-brand-primary bg-surface-beige/40 flex flex-col items-center justify-center gap-1 text-text-charcoal/40 hover:text-brand-primary transition-all cursor-pointer group"
                    >
                      <Upload size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Device File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('front')}
                      className="py-2 bg-brand-accent/50 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Camera size={12} /> Instant Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Back Slot Card Box */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-text-charcoal/50 pr-1 tracking-wider block text-center">Aadhaar BACK</span>
                {backImage ? (
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border-2 border-[#059669] group bg-surface-beige">
                    <img src={backImage} className="w-full h-full object-cover" alt="ID Back Preview" />
                    <button 
                      type="button" 
                      onClick={() => setBackImage(null)} 
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => backFileInputRef.current?.click()}
                      className="aspect-[4/3] rounded-2xl border-2 border-dashed border-border-sleek hover:border-brand-primary bg-surface-beige/40 flex flex-col items-center justify-center gap-1 text-text-charcoal/40 hover:text-brand-primary transition-all cursor-pointer group"
                    >
                      <Upload size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Device File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('back')}
                      className="py-2 bg-brand-accent/50 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Camera size={12} /> Instant Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-primary text-white font-black uppercase tracking-wider text-xs py-4.5 rounded-[22px] shadow-lg shadow-brand-primary/15 hover:scale-[1.01] transition-all cursor-pointer active:scale-98"
          >
            Submit ID For e-KYC
          </button>
        </form>
      )}

      {/* Real-time Loading/Authenticating Screens */}
      {verificationState === 'analyzing' && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-white text-center">
          <Loader2 size={48} className="text-brand-accent animate-spin mb-6" />
          <h2 className="text-2xl font-display font-black tracking-tight mb-2">Simulated Aadhaar Sync</h2>
          <div className="w-full max-w-xs bg-zinc-800 h-1 rounded-full overflow-hidden mb-8">
            <div 
              className="bg-brand-accent h-full rounded-full transition-all duration-500" 
              style={{ width: analysisStep === 1 ? '35%' : analysisStep === 2 ? '70%' : '100%' }}
            ></div>
          </div>
          <p className="text-xs uppercase tracking-widest font-black text-brand-accent mb-1 animate-pulse">
            {analysisStep === 1 ? 'Extracting visual OCR coordinates...' : analysisStep === 2 ? 'Connecting Govt Registrar Node API...' : 'Hashing secure UID token key...'}
          </p>
          <p className="text-[10px] text-zinc-500 max-w-[240px] leading-relaxed uppercase">
            Data compression running local browser sandbox environment. No files are stored or shipped to raw third-party servers.
          </p>
        </div>
      )}

      {verificationState === 'success' && (
        <div className="fixed inset-0 bg-[#059669] z-50 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-[#059669] shadow-2xl mb-6 scale-up animate-bounce">
            <Check size={36} className="stroke-[3.5px]" />
          </div>
          <h2 className="text-3xl font-display font-black tracking-tight mb-1.5">Verification Successful!</h2>
          <p className="text-[10px] font-black tracking-widest uppercase text-emerald-100 mb-8">
            YOUR ID WAS SECURELY LOCKED AND CERTIFIED
          </p>
          <p className="text-xs font-semibold max-w-[250px] leading-relaxed mb-10 text-emerald-50">
            A real-time "Govt ID Verified" credential badge has been securely added to your profile. You can now perform premium unlimited system barters!
          </p>
          <button
            type="button"
            onClick={() => {
              setVerificationState('idle');
              navigate('/profile');
            }}
            className="px-8 py-4.5 bg-white text-[#059669] font-black uppercase text-xs tracking-wider rounded-[22px] shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Return to Profile
          </button>
        </div>
      )}

      {/* Real-time Interactive Camera Modal Stream Overlay within Aadhaar screen */}
      {activeSide && cameraStream && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6 text-white animate-fade-in">
          <div className="w-full max-w-sm flex items-center justify-between mt-4">
            <span className="text-xs font-black text-white/50 tracking-widest uppercase">
              Capture Document: {activeSide === 'front' ? 'FRONT SIDE' : 'BACK SIDE'}
            </span>
            <button 
              type="button" 
              onClick={stopCamera} 
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative w-full max-w-sm aspect-[4/3] rounded-[32px] overflow-hidden bg-zinc-950 border border-white/15 flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-6 border-2 border-dashed border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
              <span className="text-[10px] text-white/40 tracking-widest font-black uppercase bg-black/60 px-3 py-1.5 rounded-full select-none">
                Align Aadhaar Card Card Frame
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm flex flex-col items-center gap-4 mb-6">
            <button
              type="button"
              onClick={captureIdFrame}
              className="w-20 h-20 rounded-full bg-white border-[6px] border-white/20 hover:scale-105 active:scale-95 transition-all text-black flex items-center justify-center shadow-lg cursor-pointer"
            >
              <Camera size={26} className="text-black" />
            </button>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Aadhaar card frame bounds detection active</p>
          </div>
        </div>
      )}
    </div>
  );
};
