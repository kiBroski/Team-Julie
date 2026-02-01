import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { User, LogIn, Save, ShieldCheck } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState('');
  const [isSupervisor, setIsSupervisor] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let userCred;
      if (isRegistering) {
        userCred = await auth.createUserWithEmailAndPassword(email, password);
        // Create Profile in Firestore
        const newProfile: UserProfile = {
          uid: userCred.user!.uid,
          email: userCred.user!.email || '',
          displayName,
          phoneNumber,
          team,
          role: isSupervisor ? 'supervisor' : 'dsr'
        };
        await db.collection('users').doc(userCred.user!.uid).set(newProfile);
        onLoginSuccess(newProfile);
      } else {
        userCred = await auth.signInWithEmailAndPassword(email, password);
        // Fetch Profile
        const docSnap = await db.collection('users').doc(userCred.user!.uid).get();
        
        if (docSnap.exists) {
          const data = docSnap.data() as any;
          // Backwards compatibility for users without role
          const profile: UserProfile = {
            ...data,
            role: data.role || 'dsr'
          };
          onLoginSuccess(profile);
        } else {
          // Legacy user or profile missing
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
            {isRegistering && isSupervisor ? 'Team Leader Registration' : 'Field Data Collection'}
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
              <input 
                placeholder="Team / Agency Name"
                required
                className="w-full p-2 border rounded text-sm"
                value={team}
                onChange={e => setTeam(e.target.value)}
              />
              
              <div className="flex items-center gap-2 pt-2 border-t border-indigo-200">
                <input 
                  type="checkbox" 
                  id="chkSuper" 
                  checked={isSupervisor} 
                  onChange={e => setIsSupervisor(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="chkSuper" className="text-sm font-bold text-indigo-900 flex items-center gap-1">
                   <ShieldCheck size={14}/> I am a Supervisor / Team Leader
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm p-2 bg-red-50 rounded text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white py-3 rounded-lg font-bold transition flex justify-center items-center gap-2 ${isSupervisor ? 'bg-indigo-800 hover:bg-indigo-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}
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
      </div>
    </div>
  );
};

export default LoginView;