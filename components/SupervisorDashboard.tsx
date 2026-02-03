
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { InstallationRecord, UserProfile, Announcement, DirectMessage, JobStatus } from '../types';
import { exportToCSV } from '../services/utils';
import FiberForm from './FiberForm';
import { FixedSizeList as List } from 'react-window';
import { Users, BarChart3, FileSpreadsheet, Send, Download, LogOut, CheckCircle, Clock, XCircle, Megaphone, MessageCircle, X, Bell, Inbox, Layout, ChevronRight, User, Trophy, Medal, Edit, Award } from 'lucide-react';

interface SupervisorDashboardProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSwitchToField: () => void;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';
type Tab = 'overview' | 'data' | 'team' | 'communicate' | 'leaderboard';

// Virtualized Row defined OUTSIDE to prevent re-mounting
const Row = ({ index, style, data }: any) => {
  const { records, onEdit } = data;
  const r = records[index];
  if (!r) return null;

  const isOdd = index % 2 !== 0;
  
  return (
    <div style={style} className={`flex items-center text-sm border-b border-gray-100 hover:bg-indigo-50 transition-colors ${isOdd ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="w-24 px-3 py-2 text-gray-500 truncate">{new Date(r.updatedAt).toLocaleDateString()}</div>
      <div className="w-32 px-3 py-2 font-medium text-gray-900 truncate">{r.Name}</div>
      <div className="w-28 px-3 py-2 text-gray-600 truncate">{r.Contact}</div>
      <div className="w-40 px-3 py-2 text-gray-600 truncate">{r.RoadName}</div>
      <div className="w-20 px-3 py-2 text-gray-600 truncate">{r.FAT || '-'}</div>
      <div className="w-24 px-3 py-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              r.JobStatus === 'Installed' ? 'bg-emerald-100 text-emerald-700' : 
              r.JobStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 
              r.JobStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
              {r.JobStatus}
          </span>
      </div>
      <div className="w-32 px-3 py-2 text-indigo-700 truncate font-medium">{r.DSR}</div>
      <div className="w-32 px-3 py-2 text-gray-400 italic truncate">{r.Comment}</div>
      <div className="w-20 px-3 py-2 flex items-center justify-center">
          <button onClick={() => onEdit(r)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded">
              <Edit size={16} />
          </button>
      </div>
    </div>
  );
};

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ currentUser, onLogout, onSwitchToField }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [records, setRecords] = useState<InstallationRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
  // Edit State
  const [editingRecord, setEditingRecord] = useState<InstallationRecord | null>(null);

  // Drill down filters
  const [selectedDsrId, setSelectedDsrId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');

  // Communication
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [incomingMessages, setIncomingMessages] = useState<DirectMessage[]>([]);
  const [messageTarget, setMessageTarget] = useState<UserProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  
  const isHQ = currentUser.team === 'HQ';

  useEffect(() => {
    // 1. Fetch Installations
    let queryRecords: any = db.collection('installations');
    if (!isHQ) { queryRecords = queryRecords.where('Team', '==', currentUser.team); }

    const unsubRecords = queryRecords.onSnapshot((snap: any) => {
        const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as InstallationRecord));
        // Sort by date descending
        data.sort((a: InstallationRecord, b: InstallationRecord) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRecords(data);
    }, (err: any) => console.error("Records error:", err));

    // 2. Fetch Users (DSRs)
    let queryUsers = db.collection('users').where('role', '==', 'dsr');
    if (!isHQ) { queryUsers = queryUsers.where('team', '==', currentUser.team); }

    const unsubUsers = queryUsers.onSnapshot((snap: any) => {
        setUsers(snap.docs.map((d: any) => d.data() as UserProfile));
    }, (err: any) => console.error("Users error:", err));
      
    // 3. Fetch Announcements
    let queryAnnounce: any = db.collection('announcements');
    if (!isHQ) { queryAnnounce = queryAnnounce.where('team', '==', currentUser.team); }

    const unsubAnnounce = queryAnnounce.onSnapshot((snap: any) => {
        const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Announcement));
        data.sort((a: Announcement, b: Announcement) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(data);
    }, (err: any) => console.error("Announcements error:", err));
      
    // 4. Messages
    const unsubMessages = db.collection('messages')
      .where('recipientUid', '==', currentUser.uid)
      .where('read', '==', false)
      .onSnapshot((snap: any) => {
        setIncomingMessages(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as DirectMessage)));
      }, (err: any) => console.error("Messages error:", err));

    return () => { unsubRecords(); unsubUsers(); unsubAnnounce(); unsubMessages(); };
  }, [currentUser, isHQ]);

  const getFilteredRecords = () => {
    let base = records;
    if (selectedDsrId) base = base.filter(r => r.createdByUid === selectedDsrId);
    if (statusFilter !== 'All') base = base.filter(r => r.JobStatus === statusFilter);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return base.filter(r => {
      const d = new Date(r.updatedAt);
      if (timeRange === 'today') return d >= startOfDay;
      if (timeRange === 'week') return d >= startOfWeek;
      if (timeRange === 'month') return d >= startOfMonth;
      return true;
    });
  };

  const filteredRecords = getFilteredRecords();
  const selectedDsrProfile = users.find(u => u.uid === selectedDsrId);

  // Global stats for Top Cards
  const globalStats = useMemo(() => {
     const relevantRecords = records.filter(r => {
        const d = new Date(r.updatedAt);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (timeRange === 'today') return d >= startOfDay;
        if (timeRange === 'week') return d >= startOfWeek;
        if (timeRange === 'month') return d >= startOfMonth;
        return true;
     });
     return {
      total: relevantRecords.length,
      installed: relevantRecords.filter(r => r.JobStatus === 'Installed').length,
      pending: relevantRecords.filter(r => r.JobStatus === 'Pending').length,
      rejected: relevantRecords.filter(r => r.JobStatus === 'Rejected').length,
     };
  }, [records, timeRange]);

  // Leaderboard Logic
  const leaderboardData = useMemo(() => {
    return users.map(u => {
      // Leaderboard is always based on "All Time" or "Current Month" to be fair? Let's use current timeRange filter
      const userRecs = records.filter(r => {
         const d = new Date(r.updatedAt);
         const now = new Date();
         const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
         const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
         let matchTime = true;
         if (timeRange === 'today') matchTime = d >= startOfDay;
         if (timeRange === 'week') matchTime = d >= startOfWeek;
         if (timeRange === 'month') matchTime = d >= startOfMonth;
         return r.createdByUid === u.uid && matchTime;
      });
      
      const installs = userRecs.filter(r => r.JobStatus === 'Installed').length;
      const total = userRecs.length;
      // Simple Score: 10 pts for install, 1 pt for others
      const score = (installs * 10) + total;
      
      return { ...u, installs, total, score };
    }).sort((a,b) => b.score - a.score);
  }, [users, records, timeRange]);

  const handlePostAnnouncement = async () => {
    if(!newAnnouncement.title || !newAnnouncement.content) return;
    try {
      await db.collection('announcements').add({
        ...newAnnouncement,
        team: currentUser.team,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.displayName
      });
      setNewAnnouncement({ title: '', content: '' });
      alert('Announcement Posted!');
    } catch (e: any) { alert("Error posting: " + e.message); }
  };

  const handleSendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    try {
      await db.collection('messages').add({
        recipientUid: messageTarget.uid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: messageText,
        read: false,
        createdAt: new Date().toISOString()
      });
      alert(`Message sent to ${messageTarget.displayName}`);
      setMessageTarget(null);
      setMessageText('');
    } catch (e) { alert('Failed to send message.'); }
  };

  const handleUpdateRecord = async (data: Partial<InstallationRecord>, method: 'save' | 'whatsapp') => {
      if(!editingRecord || !data.id) return;
      try {
          const payload = { ...data, updatedAt: new Date().toISOString(), edited: true };
          await db.collection('installations').doc(data.id).update(payload);
          setEditingRecord(null);
      } catch (e: any) {
          alert("Update failed: " + e.message);
      }
  };

  const goToData = (dsrId: string | null, status: JobStatus | 'All') => {
    setSelectedDsrId(dsrId);
    setStatusFilter(status);
    setActiveTab('data');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative">
      {/* HEADER */}
      <header className="bg-indigo-900 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><BarChart3 size={24} className="text-yellow-400" /></div>
            <div>
              <h1 className="font-bold text-lg leading-none">FiberTrack</h1>
              <span className="text-xs text-indigo-300 font-mono uppercase">{isHQ ? 'GLOBAL HQ ADMIN' : `${currentUser.team} CONTROL`}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onSwitchToField} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition">
              <Layout size={14} /> Field Mode
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{currentUser.displayName}</div>
              <div className="text-xs text-indigo-300">{currentUser.team}</div>
            </div>
            <button onClick={onLogout} className="p-2 bg-indigo-800 rounded-lg hover:bg-indigo-700 transition"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="bg-indigo-800/50 px-4">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            <TabButton active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<BarChart3 size={16}/>} label="Overview" />
            <TabButton active={activeTab === 'data'} onClick={() => { setActiveTab('data'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<FileSpreadsheet size={16}/>} label="Data Grid" />
            <TabButton active={activeTab === 'leaderboard'} onClick={() => { setActiveTab('leaderboard'); }} icon={<Trophy size={16}/>} label="Leaderboard" />
            <TabButton active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<Users size={16}/>} label="Team" />
            <TabButton active={activeTab === 'communicate'} onClick={() => setActiveTab('communicate')} icon={<Megaphone size={16}/>} label="Broadcast" badge={incomingMessages.length} />
          </div>
        </div>
      </header>

      {/* EDIT MODAL OVERLAY */}
      {editingRecord && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="bg-indigo-900 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                      <h3 className="font-bold flex items-center gap-2"><Edit size={18} /> Edit Record</h3>
                      <button onClick={() => setEditingRecord(null)} className="hover:text-red-300"><X size={24}/></button>
                  </div>
                  <div className="p-4">
                     <FiberForm 
                        initialData={editingRecord}
                        onSave={handleUpdateRecord}
                        onCancel={() => setEditingRecord(null)}
                        userProfile={currentUser}
                     />
                  </div>
              </div>
          </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        
        {/* FILTERS BAR */}
        {(activeTab === 'overview' || activeTab === 'data' || activeTab === 'leaderboard') && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex flex-wrap items-center gap-2">
                {activeTab === 'leaderboard' ? (
                   <span className="text-gray-500 text-sm font-medium flex items-center gap-2"><Trophy size={16} className="text-yellow-500"/> Team Rankings</span>
                ) : (
                  <>
                    {selectedDsrId ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedDsrId(null)} className="text-indigo-600 hover:underline font-bold text-sm">All Staff</button>
                        <ChevronRight size={16} className="text-gray-400"/>
                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full text-indigo-700 font-bold text-sm">
                        <User size={14} /> {selectedDsrProfile?.displayName || 'Unknown DSR'}
                        <button onClick={() => setSelectedDsrId(null)}><X size={14}/></button>
                        </div>
                    </div>
                    ) : <span className="text-gray-500 text-sm font-medium">Viewing: <strong>Entire Team</strong></span>}
                    
                    {statusFilter !== 'All' && (
                    <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full text-amber-700 font-bold text-sm ml-2">
                        Status: {statusFilter}
                        <button onClick={() => setStatusFilter('All')}><X size={14}/></button>
                    </div>
                    )}
                  </>
                )}
             </div>

             <div className="flex gap-2">
               {['today', 'week', 'month', 'all'].map(t => (
                 <FilterBtn key={t} active={timeRange === t} onClick={() => setTimeRange(t as TimeRange)}>
                    {t === 'all' ? 'All Time' : t.charAt(0).toUpperCase() + t.slice(1)}
                 </FilterBtn>
               ))}
             </div>
          </div>
        )}

        {/* --- TAB: OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div onClick={() => goToData(selectedDsrId, 'All')} className="cursor-pointer transition transform hover:scale-105">
                <KpiCard label="Total Submissions" value={globalStats.total} icon={<FileSpreadsheet />} color="bg-indigo-600" />
              </div>
              <div onClick={() => goToData(selectedDsrId, 'Installed')} className="cursor-pointer transition transform hover:scale-105">
                <KpiCard label="Successful Installs" value={globalStats.installed} icon={<CheckCircle />} color="bg-emerald-600" />
              </div>
              <div onClick={() => goToData(selectedDsrId, 'Pending')} className="cursor-pointer transition transform hover:scale-105">
                 <KpiCard label="Pending Processing" value={globalStats.pending} icon={<Clock />} color="bg-amber-500" />
              </div>
              <div onClick={() => goToData(selectedDsrId, 'Rejected')} className="cursor-pointer transition transform hover:scale-105">
                 <KpiCard label="Rejected / Dead" value={globalStats.rejected} icon={<XCircle />} color="bg-red-500" />
              </div>
            </div>
            
            {/* Simple Top List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="font-bold text-gray-800 mb-4 text-lg">Quick Performance Overview</h3>
               <div className="space-y-3">
                   {leaderboardData.slice(0, 5).map((u, idx) => (
                       <div key={u.uid} onClick={() => goToData(u.uid, 'All')} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                           <div className="w-8 font-bold text-gray-400">#{idx + 1}</div>
                           <div className="flex-1 font-medium text-gray-700">{u.displayName}</div>
                           <div className="font-bold text-indigo-700">{u.total} <span className="text-[10px] text-gray-400 font-normal">leads</span></div>
                       </div>
                   ))}
               </div>
            </div>
          </div>
        )}

        {/* --- TAB: DATA GRID (Virtualized) --- */}
        {activeTab === 'data' && (
          <div className="space-y-4 animate-fade-in h-[calc(100vh-250px)] flex flex-col">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2">
                 <h2 className="font-bold text-gray-700">Records</h2>
                 <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{filteredRecords.length}</span>
              </div>
              <button onClick={() => exportToCSV(filteredRecords)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium">
                <Download size={18} /> Export CSV
              </button>
            </div>

            {/* Virtualized Table Header */}
            <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 flex items-center text-sm font-bold text-gray-700 bg-gray-50">
               <div className="w-24 px-3 py-3">Date</div>
               <div className="w-32 px-3 py-3">Name</div>
               <div className="w-28 px-3 py-3">Contact</div>
               <div className="w-40 px-3 py-3">Road/Loc</div>
               <div className="w-20 px-3 py-3">FAT</div>
               <div className="w-24 px-3 py-3">Status</div>
               <div className="w-32 px-3 py-3">Agent</div>
               <div className="w-32 px-3 py-3">Comment</div>
               <div className="w-20 px-3 py-3 text-center">Action</div>
            </div>

            {/* Virtualized List Container */}
            <div className="bg-white border border-gray-200 rounded-b-xl flex-1 overflow-hidden">
                <List
                  height={500} // This should ideally be responsive, but fixed for simplicity in this implementation
                  itemCount={filteredRecords.length}
                  itemSize={50}
                  width={'100%'}
                  itemData={{ records: filteredRecords, onEdit: (r: InstallationRecord) => setEditingRecord(r) }}
                >
                  {Row}
                </List>
                {filteredRecords.length === 0 && <div className="p-8 text-center text-gray-400">No records found matching filters.</div>}
            </div>
          </div>
        )}

        {/* --- TAB: LEADERBOARD --- */}
        {activeTab === 'leaderboard' && (
            <div className="animate-fade-in space-y-6">
                {/* Podium */}
                <div className="grid grid-cols-3 gap-4 mb-8 items-end">
                    {/* 2nd Place */}
                    {leaderboardData[1] && (
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full border-4 border-slate-300 bg-slate-100 flex items-center justify-center mb-2 relative">
                                <span className="text-2xl font-bold text-slate-500">{leaderboardData[1].displayName.charAt(0)}</span>
                                <div className="absolute -bottom-2 bg-slate-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">2nd</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-gray-800">{leaderboardData[1].displayName}</div>
                                <div className="text-sm text-gray-500">{leaderboardData[1].installs} Installs</div>
                            </div>
                            <div className="h-24 w-full bg-slate-200 rounded-t-lg mt-2 mx-auto max-w-[100px]"></div>
                        </div>
                    )}
                    {/* 1st Place */}
                    {leaderboardData[0] && (
                        <div className="flex flex-col items-center">
                             <Medal size={32} className="text-yellow-500 mb-2" />
                            <div className="w-24 h-24 rounded-full border-4 border-yellow-400 bg-yellow-50 flex items-center justify-center mb-2 relative shadow-lg">
                                <span className="text-3xl font-bold text-yellow-600">{leaderboardData[0].displayName.charAt(0)}</span>
                                <div className="absolute -bottom-2 bg-yellow-500 text-white text-xs px-3 py-0.5 rounded-full font-bold">1st</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-gray-900">{leaderboardData[0].displayName}</div>
                                <div className="text-sm font-bold text-indigo-600">{leaderboardData[0].installs} Installs</div>
                            </div>
                            <div className="h-32 w-full bg-yellow-300 rounded-t-lg mt-2 mx-auto max-w-[100px] shadow-lg"></div>
                        </div>
                    )}
                    {/* 3rd Place */}
                    {leaderboardData[2] && (
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full border-4 border-amber-700 bg-amber-50 flex items-center justify-center mb-2 relative">
                                <span className="text-2xl font-bold text-amber-800">{leaderboardData[2].displayName.charAt(0)}</span>
                                <div className="absolute -bottom-2 bg-amber-700 text-white text-xs px-2 py-0.5 rounded-full font-bold">3rd</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-gray-800">{leaderboardData[2].displayName}</div>
                                <div className="text-sm text-gray-500">{leaderboardData[2].installs} Installs</div>
                            </div>
                            <div className="h-16 w-full bg-amber-200 rounded-t-lg mt-2 mx-auto max-w-[100px]"></div>
                        </div>
                    )}
                </div>

                {/* The Rest of the List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-4">Rank</th>
                                <th className="p-4">Agent</th>
                                <th className="p-4">Installed (Gold)</th>
                                <th className="p-4">Total Leads</th>
                                <th className="p-4">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {leaderboardData.slice(3).map((u, i) => (
                                <tr key={u.uid} className="hover:bg-gray-50">
                                    <td className="p-4 font-bold text-gray-400">#{i + 4}</td>
                                    <td className="p-4 font-medium text-gray-900">{u.displayName}</td>
                                    <td className="p-4 font-bold text-emerald-600">{u.installs}</td>
                                    <td className="p-4 text-gray-600">{u.total}</td>
                                    <td className="p-4 font-bold text-indigo-700">{u.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- TAB: TEAM --- */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
             <div className="col-span-full bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-blue-900">Invite DSRs</h3>
                  <p className="text-sm text-blue-700">DSRs sign up selecting <strong>{currentUser.team}</strong>.</p>
                </div>
                <div className="bg-white p-2 rounded-lg font-mono text-sm border border-blue-200">
                  Staff: <strong>{users.length}</strong>
                </div>
             </div>
             {users.map(u => (
               <div key={u.uid} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4 relative hover:border-indigo-300 transition group">
                  <div onClick={() => goToData(u.uid, 'All')} className="flex-1 flex items-center gap-4 cursor-pointer">
                    <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition">
                      {u.displayName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{u.displayName}</h4>
                      <p className="text-xs text-gray-500">{u.phoneNumber}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setMessageTarget(u); }} className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-indigo-50 hover:text-indigo-600">
                    <MessageCircle size={18} />
                  </button>
               </div>
             ))}
          </div>
        )}

        {/* --- TAB: COMMUNICATE --- */}
        {activeTab === 'communicate' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* INBOX */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 md:col-span-1 h-fit">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Inbox size={18} className="text-indigo-600"/> Inbox</h3>
               <div className="space-y-3">
                 {incomingMessages.length === 0 && <p className="text-sm text-gray-400 italic">No unread messages.</p>}
                 {incomingMessages.map(msg => (
                    <div key={msg.id} className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-indigo-900 text-xs">{msg.senderName}</h4>
                            <span className="text-[10px] text-indigo-400">{new Date(msg.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{msg.content}</p>
                        <button onClick={() => { db.collection('messages').doc(msg.id).update({ read: true }); const user = users.find(u => u.uid === msg.senderUid); if(user) setMessageTarget(user); }} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 mt-2 w-full">Reply & Mark Read</button>
                    </div>
                 ))}
               </div>
            </div>
            {/* Create Post */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 md:col-span-1 h-fit">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={18} className="text-indigo-600"/> New Broadcast</h3>
               <div className="space-y-3">
                 <input className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Subject / Title" value={newAnnouncement.title} onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})} />
                 <textarea className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm h-32 resize-none" placeholder="Message to all DSRs..." value={newAnnouncement.content} onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})} />
                 <button onClick={handlePostAnnouncement} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">Post Notice</button>
               </div>
            </div>
            {/* List Posts */}
            <div className="md:col-span-1 space-y-4">
               <h3 className="font-bold text-gray-700">Notice Board</h3>
               {announcements.map(a => (
                 <div key={a.id} className="bg-white border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900">{a.title}</h4>
                      <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{a.content}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

      </main>

      {/* Message Modal */}
      {messageTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-indigo-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold">Message {messageTarget.displayName}</h3>
              <button onClick={() => setMessageTarget(null)} className="text-indigo-200 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-4">
              <textarea className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Type your message here..." value={messageText} onChange={e => setMessageText(e.target.value)} />
              <button onClick={handleSendMessage} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"><Send size={18} /> Send Message</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, badge }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${active ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white hover:bg-white/5'}`}>
    {icon} {label}
    {badge > 0 && <span className="absolute -top-0 right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">{badge}</span>}
  </button>
);

const FilterBtn = ({active, children, onClick}: any) => (
  <button onClick={onClick} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
    {children}
  </button>
);

const KpiCard = ({ label, value, icon, color }: any) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${color}`}>{icon}</div>
    <div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 font-medium uppercase">{label}</div>
    </div>
  </div>
);

export default SupervisorDashboard;
