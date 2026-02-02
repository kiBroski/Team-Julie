
import React, { useState, useEffect } from 'react';
import { ViewState, InstallationRecord, Note, UserProfile } from './types';
import Dashboard from './components/Dashboard';
import FiberForm from './components/FiberForm';
import LoginView from './components/LoginView';
import SupervisorDashboard from './components/SupervisorDashboard';
import { generateId, exportToCSV, generateWhatsAppLink } from './services/utils';
import { LayoutDashboard, StickyNote, Plus, Trash2, Calendar, LogOut, Settings, AlertTriangle, ChevronLeft } from 'lucide-react';

// Firebase imports
import { auth, db, isFirebaseSetup } from './firebase';

const SetupGuide = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-lg w-full p-8 rounded-2xl shadow-xl border border-indigo-100 text-center space-y-6">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
        <Settings size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Finish Your Setup</h1>
      <p className="text-gray-600">
        You are almost there! To start using FiberTrack, you need to connect your Firebase database.
      </p>
      
      <div className="bg-amber-50 text-left p-4 rounded-lg border border-amber-200 text-sm space-y-2">
        <p className="font-bold text-amber-800">Instructions:</p>
        <ol className="list-decimal pl-4 text-amber-900 space-y-1">
          <li>Open <code>firebase.ts</code> in your editor.</li>
          <li>Replace the <code>apiKey</code>, <code>projectId</code>, etc., with your own from the Firebase Console.</li>
          <li>Save the file. This page will auto-refresh.</li>
        </ol>
      </div>
      
       <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition">
        Open Firebase Console
      </a>
    </div>
  </div>
);

const PermissionError = () => (
  <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-lg w-full p-8 rounded-2xl shadow-xl border border-red-100 text-center space-y-6">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
        <AlertTriangle size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Database Access Denied</h1>
      <p className="text-gray-600">
        The application cannot read or write data. This is usually due to missing <strong>Firestore Security Rules</strong>.
      </p>
      
      <div className="bg-slate-50 text-left p-4 rounded-lg border border-slate-200 text-sm space-y-2">
        <p className="font-bold text-slate-800">How to Fix:</p>
        <ol className="list-decimal pl-4 text-slate-700 space-y-2">
          <li>Go to Firebase Console &gt; Firestore Database &gt; Rules.</li>
          <li>Open the file <code>firestore.rules</code> in this project.</li>
          <li>Copy the code and paste it into the Firebase Rules editor.</li>
          <li>Click <strong>Publish</strong>.</li>
        </ol>
      </div>
      
       <button onClick={() => window.location.reload()} className="block w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition">
        I've Updated Rules - Retry
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const [view, setView] = useState<ViewState>(ViewState.Login);
  const [records, setRecords] = useState<InstallationRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<InstallationRecord | null>(null);
  
  // Notes State
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // 1. Auth Listener
  useEffect(() => {
    if (!isFirebaseSetup) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch Profile
        try {
          const profileDoc = await db.collection('users').doc(currentUser.uid).get();
          if (profileDoc.exists) {
            const data = profileDoc.data() as UserProfile;
            // Backfill role if missing
            if (!data.role) data.role = 'dsr';
            
            setUserProfile(data);
            
            // Default View Routing
            if (data.role === 'supervisor') {
                setView(ViewState.SupervisorMode);
            } else {
                setView(ViewState.Dashboard);
            }
          } else {
            // Logged in but no profile (Registration flow handles creation, this is fallback)
            setView(ViewState.Login);
          }
        } catch (error: any) {
          console.error("Profile fetch error:", error);
          if (error.code === 'permission-denied') {
            setPermissionError(true);
          }
        }
      } else {
        setUserProfile(null);
        setView(ViewState.Login);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (Only when in Field Mode Dashboard)
  useEffect(() => {
    if (!user || view === ViewState.Login || view === ViewState.SupervisorMode || permissionError) return;

    // Installations Listener
    // REMOVED .orderBy('updatedAt', 'desc') to fix Missing Index Error
    const unsubInstallations = db.collection('installations')
      .where('createdByUid', '==', user.uid)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InstallationRecord[];
        
        // Sort client-side
        data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRecords(data);
      }, (error) => {
        console.error("Installations listener error:", error);
        if (error.code === 'permission-denied') setPermissionError(true);
      });

    // Notes Listener
    // REMOVED .orderBy('createdAt', 'desc') to fix Missing Index Error
    const unsubNotes = db.collection('notes')
      .where('createdByUid', '==', user.uid)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
        // Sort client-side
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotes(data);
      }, (error) => {
        console.error("Notes listener error:", error);
      });

    return () => {
      unsubInstallations();
      unsubNotes();
    };
  }, [user, view, permissionError]);

  // Actions
  const handleLoginSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    if (profile.role === 'supervisor') {
      setView(ViewState.SupervisorMode);
    } else {
      setView(ViewState.Dashboard);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setView(ViewState.Login);
    setUserProfile(null);
  };

  const handleSaveRecord = async (data: Partial<InstallationRecord>, method: 'save' | 'whatsapp') => {
    if (!user || !userProfile) return;

    try {
      const now = new Date().toISOString();
      const payload = {
        ...data,
        updatedAt: now,
        synced: true, // Online save is synced
        edited: !!data.id,
        // Ensure these fields are always present
        DSR: userProfile.displayName,
        DSRContacts: userProfile.phoneNumber,
        Team: userProfile.team,
        createdByUid: user.uid
      };

      if (data.id) {
        await db.collection('installations').doc(data.id).update(payload);
      } else {
        const newRef = db.collection('installations').doc();
        await newRef.set({ ...payload, id: newRef.id, createdAt: now });
        // Update payload with ID for WhatsApp
        payload.id = newRef.id;
        // @ts-ignore
        payload.createdAt = now;
      }

      if (method === 'whatsapp') {
        generateWhatsAppLink(payload as InstallationRecord);
      }

      setView(ViewState.Dashboard);
      setEditingRecord(null);
    } catch (error: any) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      await db.collection('installations').doc(id).delete();
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !user) return;
    await db.collection('notes').add({
      content: newNoteText,
      createdAt: new Date().toISOString(),
      createdByUid: user.uid
    });
    setNewNoteText('');
  };

  const handleDeleteNote = async (id: string) => {
    await db.collection('notes').doc(id).delete();
  };

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------

  if (!isFirebaseSetup) return <SetupGuide />;
  if (permissionError) return <PermissionError />;
  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading...</div>;

  if (view === ViewState.Login) {
    return (
      <LoginView 
        onLoginSuccess={handleLoginSuccess} 
        installPrompt={deferredPrompt} 
        onInstall={handleInstallClick}
      />
    );
  }

  if (view === ViewState.SupervisorMode && userProfile) {
    return (
      <SupervisorDashboard 
        currentUser={userProfile} 
        onLogout={handleLogout} 
        onSwitchToField={() => setView(ViewState.Dashboard)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden min-w-0">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard /> FiberTrack
          </h1>
          <div className="flex gap-2">
            {userProfile?.role === 'supervisor' && (
              <button 
                onClick={() => setView(ViewState.SupervisorMode)} 
                className="p-2 bg-indigo-500 rounded-lg hover:bg-indigo-400 text-xs font-bold"
              >
                Super Admin
              </button>
            )}
            <button onClick={handleLogout} className="p-2 bg-indigo-500 rounded-lg hover:bg-indigo-400">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="flex gap-1 bg-indigo-700/50 p-1 rounded-xl">
           <TabButton 
             active={view === ViewState.Dashboard} 
             onClick={() => setView(ViewState.Dashboard)} 
             icon={<LayoutDashboard size={18} />} 
             label="Jobs" 
           />
           <TabButton 
             active={view === ViewState.Form && !editingRecord} 
             onClick={() => { setEditingRecord(null); setView(ViewState.Form); }} 
             icon={<Plus size={18} />} 
             label="New" 
           />
           <TabButton 
             active={view === ViewState.Notes} 
             onClick={() => setView(ViewState.Notes)} 
             icon={<StickyNote size={18} />} 
             label="Notes" 
           />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        {view === ViewState.Dashboard && (
          <div className="p-4">
            <Dashboard 
              records={records}
              currentUser={userProfile}
              onEdit={(r) => { setEditingRecord(r); setView(ViewState.Form); }}
              onDelete={handleDelete}
              onSync={() => window.location.reload()}
              onExport={() => exportToCSV(records)}
              onNew={() => { setEditingRecord(null); setView(ViewState.Form); }}
            />
          </div>
        )}

        {view === ViewState.Form && (
          <div className="p-4">
             <button onClick={() => setView(ViewState.Dashboard)} className="mb-4 text-indigo-600 flex items-center gap-1 font-medium">
               <ChevronLeft size={18} /> Back to Dashboard
             </button>
             <FiberForm 
               initialData={editingRecord}
               userProfile={userProfile}
               onSave={handleSaveRecord}
               onCancel={() => setView(ViewState.Dashboard)}
             />
          </div>
        )}

        {view === ViewState.Notes && (
          <div className="p-4 space-y-4 pb-20">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <StickyNote className="text-yellow-500" /> My Notes
            </h2>
            
            <div className="flex gap-2">
              <input 
                className="flex-1 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Quick note..."
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
              />
              <button onClick={handleAddNote} className="bg-indigo-600 text-white px-4 rounded-lg font-bold">Add</button>
            </div>

            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-100 relative group">
                  <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(note.createdAt).toLocaleDateString()}</span>
                    <button onClick={() => handleDeleteNote(note.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              {notes.length === 0 && <div className="text-center text-gray-400 py-10">No notes yet.</div>}
            </div>
          </div>
        )}
      </main>

    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition text-sm font-medium ${active ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-200 hover:bg-indigo-600'}`}
  >
    {icon} {label}
  </button>
);

export default App;
