
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { InstallationRecord, UserProfile, Announcement, DirectMessage, JobStatus } from '../types';
import { exportToCSV } from '../services/utils';
import { Users, BarChart3, FileSpreadsheet, Send, Download, LogOut, CheckCircle, Clock, XCircle, Megaphone, MessageCircle, X, Bell, Inbox, Layout, ChevronRight, User } from 'lucide-react';

interface SupervisorDashboardProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSwitchToField: () => void;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';
type Tab = 'overview' | 'data' | 'team' | 'communicate';

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ currentUser, onLogout, onSwitchToField }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [records, setRecords] = useState<InstallationRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
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
    
    // Drill down DSR
    if (selectedDsrId) {
      base = base.filter(r => r.createdByUid === selectedDsrId);
    }
    
    // Drill down Status
    if (statusFilter !== 'All') {
      base = base.filter(r => r.JobStatus === statusFilter);
    }

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

  // Global stats (based on time range only, ignoring drill down for the top cards initially)
  const getGlobalStats = () => {
     // We re-calculate based on records + time range only, so the top cards always show the "Big Picture"
     // unless we want them to reflect the filter? Usually top KPI cards drive the filter.
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
  };

  const globalStats = getGlobalStats();

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

  const goToData = (dsrId: string | null, status: JobStatus | 'All') => {
    setSelectedDsrId(dsrId);
    setStatusFilter(status);
    setActiveTab('data');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative">
      <header className="bg-indigo-900 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <BarChart3 size={24} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">FiberTrack</h1>
              <span className="text-xs text-indigo-300 font-mono uppercase">
                  {isHQ ? 'GLOBAL HQ ADMIN' : `${currentUser.team} CONTROL`}
              </span>
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
            <button onClick={onLogout} className="p-2 bg-indigo-800 rounded-lg hover:bg-indigo-700 transition">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="bg-indigo-800/50 px-4">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            <TabButton active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<BarChart3 size={16}/>} label="Overview" />
            <TabButton active={activeTab === 'data'} onClick={() => { setActiveTab('data'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<FileSpreadsheet size={16}/>} label="Data Grid" />
            <TabButton active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setSelectedDsrId(null); setStatusFilter('All'); }} icon={<Users size={16}/>} label="Team" />
            <TabButton active={activeTab === 'communicate'} onClick={() => setActiveTab('communicate')} icon={<Megaphone size={16}/>} label="Broadcast" badge={incomingMessages.length} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        
        {/* FILTERS & DRILL DOWN HEADER */}
        {(activeTab === 'overview' || activeTab === 'data') && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex flex-wrap items-center gap-2">
                {/* Active DSR Filter Badge */}
                {selectedDsrId ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedDsrId(null)} className="text-indigo-600 hover:underline font-bold text-sm">All Staff</button>
                    <ChevronRight size={16} className="text-gray-400"/>
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full text-indigo-700 font-bold text-sm">
                      <User size={14} /> {selectedDsrProfile?.displayName || 'Unknown DSR'}
                      <button onClick={() => setSelectedDsrId(null)}><X size={14}/></button>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm font-medium">Data: <strong>Entire Team</strong></span>
                )}

                {/* Active Status Filter Badge */}
                {statusFilter !== 'All' && (
                  <>
                     <ChevronRight size={16} className="text-gray-400"/>
                     <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full text-amber-700 font-bold text-sm">
                        Status: {statusFilter}
                        <button onClick={() => setStatusFilter('All')}><X size={14}/></button>
                     </div>
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

        {/* --- VIEW: OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Clickable KPI Cards */}
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

            {/* Performance List - Clickable */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Top Performers ({timeRange})</h3>
              <div className="space-y-3">
                {users.map(u => {
                  // For the list, we want raw counts for the time period irrespective of other filters
                  const rawUserCount = records.filter(r => {
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
                  }).length;

                  if (rawUserCount === 0) return null;
                  const max = Math.max(...users.map(usr => records.filter(r => r.createdByUid === usr.uid).length), 1); // rough max
                  const percent = (rawUserCount / (max || 1)) * 100;
                  
                  return (
                    <div 
                      key={u.uid} 
                      onClick={() => goToData(u.uid, 'All')}
                      className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer transition ${selectedDsrId === u.uid ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
                    >
                      <div className="w-32 text-sm font-medium truncate text-gray-700">{u.displayName}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <div className="w-10 text-right text-sm font-bold text-indigo-900">{rawUserCount}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: DATA GRID (Unified) --- */}
        {activeTab === 'data' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2">
                 <h2 className="font-bold text-gray-700">Records</h2>
                 <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{filteredRecords.length}</span>
              </div>
              <button 
                onClick={() => exportToCSV(filteredRecords)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium"
              >
                <Download size={18} /> Export CSV
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Alt Contact</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Road Name</th>
                    <th className="p-3">Coordinates</th>
                    <th className="p-3">Address/Apt</th>
                    <th className="p-3">FAT</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Agent</th>
                    <th className="p-3">Agent Contact</th>
                    <th className="p-3">Team</th>
                    <th className="p-3">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(r.updatedAt).toLocaleDateString()}</td>
                      <td className="p-3 text-gray-600">{r.Title}</td>
                      <td className="p-3 font-medium text-gray-900">{r.Name}</td>
                      <td className="p-3 text-gray-600">{r.Contact}</td>
                      <td className="p-3 text-gray-600">{r.AltContact}</td>
                      <td className="p-3 text-gray-600">{r.Email}</td>
                      <td className="p-3 text-gray-600">{r.RoadName}</td>
                      <td className="p-3 text-xs text-gray-400 font-mono">{r.coordinates}</td>
                      <td className="p-3 text-gray-600">{r.Address} {r.House ? `(${r.House})` : ''}</td>
                      <td className="p-3 text-gray-600">{r.FAT}</td>
                      <td className="p-3">
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                           r.JobStatus === 'Installed' ? 'bg-emerald-100 text-emerald-700' : 
                           r.JobStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 
                           r.JobStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                         }`}>
                           {r.JobStatus}
                         </span>
                      </td>
                      <td className="p-3 font-medium text-indigo-700">{r.DSR}</td>
                      <td className="p-3 text-gray-500">{r.DSRContacts}</td>
                      <td className="p-3 text-gray-500">{r.Team}</td>
                      <td className="p-3 text-gray-400 italic truncate max-w-[150px]">{r.Comment}</td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr><td colSpan={15} className="p-8 text-center text-gray-400">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW: TEAM (Clickable) --- */}
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
                  <div 
                    onClick={() => goToData(u.uid, 'All')}
                    className="flex-1 flex items-center gap-4 cursor-pointer"
                  >
                    <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition">
                      {u.displayName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{u.displayName}</h4>
                      <p className="text-xs text-gray-500">{u.phoneNumber}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setMessageTarget(u); }}
                    className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <MessageCircle size={18} />
                  </button>
               </div>
             ))}
          </div>
        )}

        {/* --- VIEW: COMMUNICATE --- */}
        {activeTab === 'communicate' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* INBOX */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 md:col-span-1 h-fit">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Inbox size={18} className="text-indigo-600"/> Inbox
               </h3>
               <div className="space-y-3">
                 {incomingMessages.length === 0 && <p className="text-sm text-gray-400 italic">No unread messages.</p>}
                 {incomingMessages.map(msg => (
                    <div key={msg.id} className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-indigo-900 text-xs">{msg.senderName}</h4>
                            <span className="text-[10px] text-indigo-400">{new Date(msg.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{msg.content}</p>
                        <button 
                           onClick={() => { 
                             db.collection('messages').doc(msg.id).update({ read: true }); 
                             const user = users.find(u => u.uid === msg.senderUid);
                             if(user) setMessageTarget(user);
                           }}
                           className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 mt-2 w-full"
                        >
                           Reply & Mark Read
                        </button>
                    </div>
                 ))}
               </div>
            </div>

            {/* Create Post */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 md:col-span-1 h-fit">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Send size={18} className="text-indigo-600"/> New Broadcast
               </h3>
               <div className="space-y-3">
                 <input 
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Subject / Title"
                    value={newAnnouncement.title}
                    onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                 />
                 <textarea 
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm h-32 resize-none"
                    placeholder="Message to all DSRs..."
                    value={newAnnouncement.content}
                    onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                 />
                 <button onClick={handlePostAnnouncement} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">
                   Post Notice
                 </button>
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
              <textarea 
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Type your message here..."
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
              />
              <button onClick={handleSendMessage} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                <Send size={18} /> Send Message
              </button>
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
