import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Phone, 
  ArrowRight, 
  Lock, 
  MapPin, 
  User as UserIcon, 
  Upload, 
  X, 
  Check, 
  Plus, 
  Sparkles 
} from 'lucide-react';
import { cn, getApiUrl } from '../lib/utils';
import { useAuth, defaultLocalUser } from '../App';
import { User } from '../types';

interface LoginPageProps {
  redirect?: string;
  onSuccess?: () => void;
}

export const LoginPage = ({ redirect = '/', onSuccess }: LoginPageProps) => {
  const navigate = useNavigate();
  const [, setAuthUser] = useAuth();
  
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [inputValue, setInputValue] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Show a simulated toast
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setErrorMessage(loginMethod === 'email' ? 'Please enter a valid email address' : 'Please enter your phone number');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const res = await fetch(getApiUrl('/api/auth/send-passcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: inputValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send passcode');
      
      setIsLoading(false);
      setOtpSent(true);
      triggerToast(`Passcode sent successfully! Please check your ${loginMethod}. 🔑`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Could not send passcode. Please try again.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const typedOtp = otpCode.join('');
    if (typedOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit OTP code');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(getApiUrl('/api/auth/verify-passcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: inputValue, code: typedOtp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Passcode verification failed');

      localStorage.setItem('barter_user_token', data.token);
      setAuthUser(data.user);

      setIsLoading(false);
      if (onSuccess) onSuccess();

      if (data.isNewUser) {
        navigate('/onboarding');
      } else {
        navigate(redirect);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Verification failed. Try again.');
    }
  };

  const handleForgotPassword = async () => {
    if (!inputValue.trim() || loginMethod !== 'email') {
      setErrorMessage('Please enter your email address to reset password/retrieve secure OTP code');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const res = await fetch(getApiUrl('/api/auth/send-passcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: inputValue })
      });
      if (!res.ok) throw new Error('Failed to send code');
      
      setIsLoading(false);
      setOtpSent(true);
      triggerToast(`Dynamic OTP recovery passcode pushed straight to ${inputValue}! 📪`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage('Failed to send passcode. Try again.');
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (!cleaned) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = cleaned.substring(cleaned.length - 1);
    setOtpCode(newOtp);

    // Auto-focus next box
    if (index < 5 && cleaned) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otpCode];
      if (!newOtp[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtpCode(newOtp);
        otpInputsRef.current[index - 1]?.focus();
      } else {
        newOtp[index] = '';
        setOtpCode(newOtp);
      }
    }
  };

  const triggerDemoQuickLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const demoEmail = 'ravi@barterhub.in';
      await fetch(getApiUrl('/api/auth/send-passcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: demoEmail })
      });
      const res = await fetch(getApiUrl('/api/auth/verify-passcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: demoEmail, code: '123456' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('barter_user_token', data.token);
      setAuthUser(data.user);

      setIsLoading(false);
      triggerToast('Logged in as demo user Ravi Kumar! 🚀');
      if (onSuccess) onSuccess();
      navigate(redirect);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage('Demo login failed: ' + err.message);
    }
  };

  return (
    <div className="bg-white min-h-screen py-10 px-6 flex flex-col justify-between">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-xl z-50 flex items-center gap-2 border border-white/20 whitespace-nowrap"
          >
            <Sparkles size={14} className="text-brand-accent" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-sm mx-auto space-y-8 my-auto">
        {/* App Greeting Brand Frame */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-[24px] bg-brand-primary text-brand-accent flex items-center justify-center mx-auto shadow-lg shadow-brand-primary/20">
            <span className="font-display font-black text-3xl">B</span>
          </div>
          <h1 className="text-3xl font-display font-black tracking-tight text-text-charcoal">BarterHub</h1>
          <p className="text-xs text-text-charcoal/50 max-w-[240px] mx-auto font-medium">Verify your identity instantly using simple secure passcode login.</p>
        </div>

        {/* Outer Form Box Segment */}
        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            {/* Login Toggle Select Tabs */}
            <div className="flex bg-surface-beige p-1 rounded-2xl border border-border-sleek">
              <button
                type="button"
                onClick={() => { setLoginMethod('email'); setInputValue(''); setErrorMessage(''); }}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                  loginMethod === 'email' ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40 hover:text-text-charcoal"
                )}
              >
                Email Mode
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod('phone'); setInputValue(''); setErrorMessage(''); }}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                  loginMethod === 'phone' ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40 hover:text-text-charcoal"
                )}
              >
                Mobile Mode
              </button>
            </div>

            {/* Credential Ingestion */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">
                {loginMethod === 'email' ? 'Enter Email Address' : 'Enter Mobile Contact'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center text-text-charcoal/30">
                  {loginMethod === 'email' ? <Mail size={18} /> : <Phone size={18} />}
                </div>
                <input
                  type={loginMethod === 'email' ? 'email' : 'tel'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={loginMethod === 'email' ? 'ravi@barterhub.in' : '+91 98765 43210'}
                  className="w-full bg-surface-beige border border-border-sleek rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text-charcoal focus:outline-none focus:ring-2 focus:ring-brand-primary/20 placeholder:text-text-charcoal/20 transition-all"
                />
              </div>
              <p className="text-[9px] text-text-charcoal/40 italic">
                *Tip: Enter <span className="underline">new@barterhub.in</span> or any new phone number to explore the first-time profile onboarding wizard!
              </p>
            </div>

            {errorMessage && (
              <p className="text-red-500 font-bold text-xs bg-red-50/50 p-3 rounded-xl border border-red-100 flex items-center gap-1.5 animate-pulse">
                ⚠️ {errorMessage}
              </p>
            )}

            {/* Control Triggers */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-primary text-white font-black uppercase tracking-wider text-xs py-4.5 rounded-[22px] shadow-lg shadow-brand-primary/10 flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    Send verification passcode <ArrowRight size={15} />
                  </>
                )}
              </button>

              {loginMethod === 'email' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-center text-[10px] font-black uppercase tracking-widest text-[#06b6d4] hover:underline"
                >
                  Forgot Password? Get Recovery OTP
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-accent text-brand-primary flex items-center justify-center mx-auto mb-2">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-display font-black text-text-charcoal">Security Passcode</h2>
              <p className="text-xs text-text-charcoal/50 max-w-[250px] mx-auto">
                Testing sandbox active! Enter <span className="font-bold text-brand-primary">any 6 digits</span> below, or use the quick helper:
              </p>
            </div>

            {/* Quick Auto-fill Assist Button for testing */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpCode(['1', '2', '3', '4', '5', '6']);
                  setErrorMessage('');
                  triggerToast('Pre-filled passcode key 123456! ⚡');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent text-brand-primary text-[10px] font-black uppercase tracking-wider rounded-xl border border-brand-primary/10 hover:bg-brand-primary hover:text-white transition-all cursor-pointer"
              >
                <Sparkles size={11} /> Auto-fill Sandbox Passcode (123456)
              </button>
            </div>

            {/* OTP Input Fields */}
            <div className="flex justify-between gap-1.5">
              {otpCode.map((char, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpInputsRef.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  placeholder="•"
                  className="w-12 h-14 bg-surface-beige border border-border-sleek focus:border-brand-primary rounded-xl text-center text-lg font-black text-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-text-charcoal/10"
                />
              ))}
            </div>

            {errorMessage && (
              <p className="text-red-500 font-bold text-xs bg-red-50/50 p-3 rounded-xl border border-red-100 animate-pulse">
                ⚠️ {errorMessage}
              </p>
            )}

            {/* Custom Code Verification CTAs */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-primary text-white font-black uppercase tracking-wider text-xs py-4.5 rounded-[22px] shadow-lg flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>Verify Code & Unlock</>
                )}
              </button>

              <div className="flex justify-between items-center px-1">
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(['','','','','','']); }}
                  className="text-[9px] font-black uppercase tracking-widest text-text-charcoal/40 hover:text-text-charcoal"
                >
                  Change Account
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-[9px] font-black uppercase tracking-widest text-brand-primary hover:underline"
                >
                  Resend Passcode
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Divider Grid */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-border-sleek"></div>
          <span className="flex-shrink mx-4 text-[9px] font-black text-text-charcoal/20 uppercase tracking-widest">or sandbox testing</span>
          <div className="flex-grow border-t border-border-sleek"></div>
        </div>

        {/* Sandbox Dev Trigger Bypass */}
        <button
          type="button"
          onClick={triggerDemoQuickLogin}
          className="w-full bg-surface-beige hover:bg-brand-accent/40 border border-border-sleek text-text-charcoal/60 hover:text-brand-primary font-black uppercase tracking-wider text-[10px] py-3.5 rounded-[18px] transition-all cursor-pointer text-center"
        >
          ⚡ Demo Bypass (Instant Log In)
        </button>
      </div>

      <div className="text-center font-bold text-[8px] uppercase tracking-widest text-text-charcoal/20 mt-6 select-none">
        Secure SHA-256 OTP Encrypted Layer Active
      </div>
    </div>
  );
};

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky');
  const [location, setLocation] = useState('Surat, Gujarat');
  const [customCity, setCustomCity] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);

  const majorCities = [
    'Surat, Gujarat',
    'Mumbai, Maharashtra',
    'New Delhi, Delhi',
    'Bengaluru, Karnataka',
    'Ahmedabad, Gujarat',
    'Pune, Maharashtra',
    'Hyderabad, Telangana'
  ];

  const interestCategories = [
    { name: 'Electronics', icon: '💻' },
    { name: 'Furniture', icon: '🪑' },
    { name: 'Fashion', icon: '👕' },
    { name: 'Service', icon: '🛠️' },
    { name: 'Skills', icon: '✍️' },
    { name: 'Food', icon: '🍕' },
    { name: 'Books', icon: '📚' },
    { name: 'Other', icon: '📦' }
  ];

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsPhotoUploading(true);
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
          setIsPhotoUploading(false);
          setToastMsg('Profile photo cached successfully! 📸');
          setTimeout(() => setToastMsg(''), 2500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleInterest = (category: string) => {
    setSelectedInterests(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleStepNext = () => {
    if (step === 1 && !name.trim()) {
      alert("Please provide your display name.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleStepBack = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleOnboardingSubmit = async () => {
    if (selectedInterests.length === 0) {
      alert("Please check at least one interest to personalize your feed.");
      return;
    }

    const finalLocation = customCity.trim() ? customCity.trim() : location;
    const token = localStorage.getItem('barter_user_token');

    try {
      const res = await fetch(getApiUrl('/api/auth/onboarding'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          avatar,
          location: finalLocation,
          interests: selectedInterests
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Onboarding update failed');

      setCurrentUser(data);
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to submit onboarding profile.');
    }
  };

  return (
    <div className="bg-white min-h-screen py-10 px-6 flex flex-col justify-between">
      {/* Visual Header Timeline */}
      <div className="w-full max-w-sm mx-auto space-y-4">
        {toastMsg && (
          <div className="bg-black text-white px-3 py-2 text-[10px] uppercase font-black tracking-widest text-center rounded-xl animate-bounce">
            {toastMsg}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-brand-primary tracking-widest">
            Profile Setup Step {step} of 3
          </span>
          <span className="text-[10px] font-black text-text-charcoal/30">
            {step === 1 ? 'WHO ARE YOU?' : step === 2 ? 'WHERE ARE YOU?' : 'YOUR INTERESTS'}
          </span>
        </div>
        <div className="flex gap-2 h-1.5 bg-surface-beige rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-300 bg-brand-primary", step >= 1 ? "w-1/3" : "w-0")}></div>
          <div className={cn("h-full rounded-full transition-all duration-300 bg-brand-primary", step >= 2 ? "w-1/3" : "w-0")}></div>
          <div className={cn("h-full rounded-full transition-all duration-300 bg-brand-primary", step >= 3 ? "w-1/3" : "w-0")}></div>
        </div>
      </div>

      <div className="w-full max-w-sm mx-auto my-auto py-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-display font-black text-text-charcoal">Display Identity</h2>
                <p className="text-xs text-text-charcoal/50">Enter your name and pick a verified avatar photo.</p>
              </div>

              {/* Dynamic Profile Avatar Selector */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                  <div className="w-28 h-28 rounded-[40px] bg-brand-accent flex items-center justify-center overflow-hidden border-4 border-white shadow-xl shadow-brand-primary/10 relative">
                    {isPhotoUploading ? (
                      <span className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <img src={avatar} className="w-full h-full object-cover" alt="Avatar Preview" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-white border border-border-sleek rounded-full flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-all text-brand-primary">
                    <Upload size={14} />
                  </div>
                </div>
                
                {/* File picker handle */}
                <input 
                  type="file" 
                  ref={photoInputRef}
                  onChange={handleCustomAvatarUpload}
                  accept="image/*" 
                  className="hidden" 
                />

                <span className="text-[9px] uppercase tracking-wider font-extrabold text-text-charcoal/30">
                  Tap avatar above to pick or take device custom photo
                </span>
              </div>

              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">Display Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-text-charcoal/35">
                    <UserIcon size={18} />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Ravi Kumar"
                    className="w-full bg-surface-beige border border-border-sleek rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text-charcoal focus:outline-none focus:ring-2 focus:ring-brand-primary/20 placeholder:text-text-charcoal/20 transition-all font-sans"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-display font-black text-text-charcoal">Where is your hub?</h2>
                <p className="text-xs text-text-charcoal/50">Choose local cities to secure matches in nearest zip ranges.</p>
              </div>

              {/* Major Indian Hub Presets */}
              <div className="space-y-2">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">Popular Swap Locations</label>
                <div className="grid grid-cols-2 gap-2">
                  {majorCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => { setLocation(city); setCustomCity(''); }}
                      className={cn(
                        "py-3 px-2 text-xs font-bold rounded-xl border text-center cursor-pointer transition-all active:scale-95",
                        location === city && !customCity
                          ? "bg-brand-primary text-white border-brand-primary shadow"
                          : "bg-white text-text-charcoal/70 border-border-sleek hover:bg-surface-beige"
                      )}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Area Option */}
              <div className="space-y-1.5 border-t border-border-sleek pt-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-text-charcoal/40">Or Enter custom city/area</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-text-charcoal/35">
                    <MapPin size={18} />
                  </div>
                  <input
                    type="text"
                    value={customCity}
                    onChange={(e) => { setCustomCity(e.target.value); setLocation(''); }}
                    placeholder="E.g., Bangalore, Whitefield"
                    className="w-full bg-surface-beige border border-border-sleek rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text-charcoal focus:outline-none focus:ring-2 focus:ring-brand-primary/20 placeholder:text-text-charcoal/20 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-display font-black text-text-charcoal">Barter Interests</h2>
                <p className="text-xs text-text-charcoal/50">Pick topics you own or wants to swap for personalized feeds.</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {interestCategories.map((cat) => {
                  const isSelected = selectedInterests.includes(cat.name);
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => toggleInterest(cat.name)}
                      className={cn(
                        "p-4 rounded-2xl border flex flex-col items-start gap-4 cursor-pointer text-left transition-all active:scale-95 group",
                        isSelected
                          ? "bg-brand-accent/50 border-brand-primary text-brand-primary shadow-sm"
                          : "bg-white border-border-sleek text-text-charcoal hover:bg-surface-beige"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-lg",
                        isSelected ? "bg-white shadow-sm" : "bg-surface-beige group-hover:scale-105 transition-transform"
                      )}>
                        {cat.icon}
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-black uppercase tracking-wider">{cat.name}</span>
                        {isSelected && (
                          <span className="w-4.5 h-4.5 rounded-full bg-brand-primary text-white flex items-center justify-center">
                            <Check size={10} className="stroke-[3.5px]" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stepper Buttons Panel */}
      <div className="w-full max-w-sm mx-auto flex gap-4">
        {step > 1 && (
          <button
            type="button"
            onClick={handleStepBack}
            className="flex-1 bg-surface-beige active:scale-95 hover:bg-surface-beige/75 border border-border-sleek font-black uppercase tracking-widest text-[10px] py-4 rounded-xl cursor-pointer text-center text-text-charcoal/60 transition-all"
          >
            Back
          </button>
        )}
        
        {step < 3 ? (
          <button
            type="button"
            onClick={handleStepNext}
            className="flex-1 bg-brand-primary text-white active:scale-95 hover:bg-brand-primary/95 font-black uppercase tracking-widest text-[10px] py-4 rounded-xl cursor-pointer text-center shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOnboardingSubmit}
            className="flex-1 bg-[#059669] text-white active:scale-95 hover:bg-[#047857] font-black uppercase tracking-widest text-[10px] py-4 rounded-xl cursor-pointer text-center shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            Finish & Launch <Sparkles size={14} className="text-yellow-300" />
          </button>
        )}
      </div>
    </div>
  );
};
