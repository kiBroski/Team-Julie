
import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { UserProfile, VALID_TEAMS } from '../types';
import { User, LogIn, Save, ShieldCheck, Lock, Download, Share } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
  installPrompt?: any;
  onInstall?: () => void;
}

// The secret code to become a supervisor
const SUPERVISOR_CODE = "FIBERADMIN";

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, installPrompt, onInstall }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState(VALID_TEAMS[0]); 
  
  // New: Admin Code for Supervisors
  const [adminCode, setAdminCode] = useState('');

  // Detect iOS for instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let userCred;
      if (isRegistering) {
        userCred = await auth.createUserWithEmailAndPassword(email, password);
        
        // Determine Role based on Admin Code
        const role = adminCode === SUPERVISOR_CODE ? 'supervisor' : 'dsr';

        const newProfile: UserProfile = {
          uid: userCred.user!.uid,
          email: userCred.user!.email || '',
          displayName,
          phoneNumber,
          team,
          role: role
        };
        await db.collection('users').doc(userCred.user!.uid).set(newProfile);
        onLoginSuccess(newProfile);
      } else {
        userCred = await auth.signInWithEmailAndPassword(email, password);
        const docSnap = await db.collection('users').doc(userCred.user!.uid).get();
        
        if (docSnap.exists) {
          const data = docSnap.data() as any;
          const profile: UserProfile = {
            ...data,
            role: data.role || 'dsr'
          };
          onLoginSuccess(profile);
        } else {
          setIsRegistering(true);
          setError('Please complete your profile details.');
        }
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700">FiberTrack</h1>
          <p className="text-gray-500 mt-2">
            {isRegistering ? 'Create New Account' : 'Field Data Collection'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              minLength={6}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {isRegistering && (
            <div className="bg-indigo-50 p-4 rounded-lg space-y-3 border border-indigo-100 animate-fade-in">
              <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                <User size={16} /> Profile Details
              </h3>
              <input 
                placeholder="Full Name"
                required
                className="w-full p-2 border rounded text-sm"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
              <input 
                placeholder="Phone Number"
                required
                className="w-full p-2 border rounded text-sm"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
              />
              
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Select Team</label>
                <select 
                  className="w-full p-2 border rounded text-sm bg-white"
                  value={team}
                  onChange={e => setTeam(e.target.value)}
                >
                  {VALID_TEAMS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-2 border-t border-indigo-200">
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                   <Lock size={12}/> Admin / Supervisor Code (Optional)
                </label>
                <input 
                  placeholder="Enter code to become Supervisor"
                  className="w-full p-2 border rounded text-sm bg-white"
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  type="password"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave blank if you are a DSR.</p>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm p-2 bg-red-50 rounded text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white py-3 rounded-lg font-bold transition flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700`}
          >
            {loading ? 'Processing...' : (isRegistering ? 'Sign Up' : 'Login')}
            {!loading && (isRegistering ? <Save size={18} /> : <LogIn size={18} />)}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-indigo-600 text-sm hover:underline"
          >
            {isRegistering ? 'Already have an account? Login' : 'First time here? Create Account'}
          </button>
        </div>

        {/* Install App Section */}
        {(installPrompt || isIOS) && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            {installPrompt && (
              <button
                onClick={onInstall}
                className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border border-indigo-100 shadow-sm hover:bg-indigo-100"
              >
                <Download size={20} /> Install App on Phone
              </button>
            )}
            
            {isIOS && (
              <div className="text-center text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-800 mb-2">Install on iPhone</p>
                <p className="flex items-center justify-center gap-1">
                   Tap <Share size={16} className="text-blue-500 inline"/> and select <br/>
                   <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginView;
