import React, { useState, useEffect } from 'react';
import { ViewState, InstallationRecord, Note, UserProfile } from './types';
import Dashboard from './components/Dashboard';
import FiberForm from './components/FiberForm';
import LoginView from './components/LoginView';
import SupervisorDashboard from './components/SupervisorDashboard';
import { generateId, exportToCSV, generateWhatsAppLink } from './services/utils';
import { LayoutDashboard, StickyNote, Plus, Trash2, Calendar, LogOut, Settings, AlertTriangle } from 'lucide-react';

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
            const data = profileDoc.data() as any;
            // Backfill role for legacy users
            const profile: UserProfile = { ...data, role: data.role || 'dsr' };
            
            setUserProfile(profile);

            // Determine View based on Role
            if (profile.role === 'supervisor') {
              setView(ViewState.SupervisorMode);
            } else {
              setView(ViewState.Dashboard);
            }

          } else {
            // Profile incomplete
            setView(ViewState.Login); 
          }
        } catch (e: any) {
          console.error("Error fetching profile:", e);
          if (e.code === 'permission-denied') {
            setPermissionError(true);
          }
        }
      } else {
        setUserProfile(null);
        setView(ViewState.Login);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Real-time Data Listeners (Only when logged in AND NOT SUPERVISOR)
  // Supervisors fetch their own global data inside their component
  useEffect(() => {
    if (!user || !isFirebaseSetup || (userProfile?.role === 'supervisor')) {
      if (userProfile?.role !== 'supervisor') {
        setRecords([]);
        setNotes([]);
      }
      return;
    }

    // A. Listen to Installations (My Own Only)
    // Note: We removed .orderBy('updatedAt') to avoid needing a Firestore Composite Index.
    // We sort client-side instead.
    const qRecords = db.collection('installations')
      .where('createdByUid', '==', user.uid);

    const unsubRecords = qRecords.onSnapshot((snapshot) => {
      const loaded: InstallationRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InstallationRecord));
      
      // Client-side sort: Newest first
      loaded.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      setRecords(loaded);
    }, (error: any) => {
      console.error("Error fetching records:", error);
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    // B. Listen to Notes (Only my notes)
    const qNotes = db.collection('notes').where('createdByUid', '==', user.uid);
    const unsubNotes = qNotes.onSnapshot((snapshot) => {
      const loaded: Note[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Note)).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(loaded);
    }, (error: any) => {
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    return () => {
      unsubRecords();
      unsubNotes();
    };
  }, [user, userProfile]);

  const handleLoginSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    if (profile.role === 'supervisor') {
      setView(ViewState.SupervisorMode);
    } else {
      setView(ViewState.Dashboard);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setView(ViewState.Login);
    setPermissionError(false);
  };

  const handleSaveRecord = async (data: Partial<InstallationRecord>, method: 'save' | 'whatsapp') => {
    if (!user) return;
    const now = new Date().toISOString();

    try {
      let finalRecord: InstallationRecord;

      if (editingRecord) {
        // UPDATE existing in Firestore
        const updateData = {
          ...data,
          edited: true,
          synced: true, 
          updatedAt: now,
        };
        await db.collection('installations').doc(editingRecord.id).update(updateData);
        finalRecord = { ...editingRecord, ...updateData } as InstallationRecord;
      } else {
        // CREATE new in Firestore
        const newRecordData = {
          ...data,
          createdByUid: user.uid,
          createdAt: now,
          updatedAt: now,
          synced: true,
          edited: false,
          source: 'manual',
        };
        const docRef = await db.collection('installations').add(newRecordData);
        finalRecord = { id: docRef.id, ...newRecordData } as InstallationRecord;
      }

      setEditingRecord(null);
      
      if (method === 'whatsapp') {
        generateWhatsAppLink(finalRecord);
      }
      setView(ViewState.Dashboard);

    } catch (e) {
      console.error("Error saving record: ", e);
      alert("Error saving to database. Check internet connection.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await db.collection('installations').doc(id).delete();
      } catch (e) {
        console.error("Error deleting", e);
        alert("Could not delete record.");
      }
    }
  };

  const handleEdit = (r: InstallationRecord) => {
    setEditingRecord(r);
    setView(ViewState.Form);
  };

  // Note Handlers
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !user) return;
    try {
      await db.collection('notes').add({
        content: newNoteText,
        createdAt: new Date().toISOString(),
        createdByUid: user.uid
      });
      setNewNoteText('');
    } catch (e) {
      console.error("Error adding note", e);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (window.confirm('Delete this note?')) {
      try {
        await db.collection('notes').doc(id).delete();
      } catch (e) {
        console.error("Error deleting note", e);
      }
    }
  };

  if (!isFirebaseSetup) {
    return <SetupGuide />;
  }

  if (permissionError) {
    return <PermissionError />;
  }

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center text-indigo-600 font-bold">Loading FiberTrack...</div>;
  }

  // ROUTING VIEW
  if (view === ViewState.Login) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (view === ViewState.SupervisorMode && userProfile) {
    return <SupervisorDashboard currentUser={userProfile} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      {/* Header */}
      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex justify-between h-14 items-center">
             <div className="flex flex-col">
               <span className="font-bold text-indigo-600 text-lg leading-none">FiberTrack</span>
               <span className="text-[10px] text-gray-500">
                 {userProfile?.displayName} | {userProfile?.team}
               </span>
             </div>
             <div className="flex gap-1 items-center">
                <NavBtn active={view === ViewState.Form} onClick={() => { setEditingRecord(null); setView(ViewState.Form); }}>Form</NavBtn>
                <NavBtn active={view === ViewState.Dashboard} onClick={() => setView(ViewState.Dashboard)}>Dash</NavBtn>
                <NavBtn active={view === ViewState.Notes} onClick={() => setView(ViewState.Notes)}>Notes</NavBtn>
                <button onClick={handleLogout} className="ml-2 p-2 text-gray-400 hover:text-red-500"><LogOut size={16}/></button>
             </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-2xl p-4">
        {view === ViewState.Dashboard && (
          <Dashboard 
            records={records} 
            currentUser={userProfile}
            onEdit={handleEdit} 
            onDelete={handleDelete}
            onExport={() => exportToCSV(records)}
            onSync={() => alert('Data is automatically synced with Firebase Cloud.')}
            onNew={() => { setEditingRecord(null); setView(ViewState.Form); }}
          />
        )}

        {view === ViewState.Form && (
          <FiberForm 
            initialData={editingRecord} 
            onSave={handleSaveRecord}
            onCancel={() => { setEditingRecord(null); setView(ViewState.Dashboard); }}
            userProfile={userProfile}
          />
        )}

        {view === ViewState.Notes && (
          <div className="space-y-6 pb-20">
            {/* New Note Input */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-gray-800">
                <StickyNote className="text-indigo-600" /> My Field Notes
              </h2>
              <textarea 
                className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-2 h-24 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Type a new note here..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
              />
              <button 
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Cloud Note
              </button>
            </div>

            {/* Notes List */}
            <div className="grid grid-cols-1 gap-4">
              {notes.map(note => (
                <div key={note.id} className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-200 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-yellow-700 flex items-center gap-1">
                      <Calendar size={12} /> {new Date(note.createdAt).toLocaleDateString()} at {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <button 
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-yellow-600 hover:text-red-600 p-1 rounded transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed font-medium">
                    {note.content}
                  </p>
                </div>
              ))}
              
              {notes.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <p>No notes found in cloud.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FAB (Only on Dashboard) */}
      {view === ViewState.Dashboard && (
        <button 
          onClick={() => { setEditingRecord(null); setView(ViewState.Form); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 z-30"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

const NavBtn = ({ active, children, onClick }: { active: boolean, children?: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);

export default App;