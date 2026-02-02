
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { InstallationRecord, UserProfile, Announcement, DirectMessage } from '../types';
import { exportToCSV } from '../services/utils';
import { Users, BarChart3, FileSpreadsheet, Send, Download, LogOut, CheckCircle, Clock, XCircle, Megaphone, MessageCircle, X, Bell, Inbox, Layout } from 'lucide-react';

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
  
  // Communication
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [incomingMessages, setIncomingMessages] = useState<DirectMessage[]>([]);

  // Direct Messaging Modal
  const [messageTarget, setMessageTarget] = useState<UserProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  
  const isHQ = currentUser.team === 'HQ';

  useEffect(() => {
    // 1. Fetch Installations
    let queryRecords = db.collection('installations');
    
    // If NOT HQ, filter by team. If HQ, fetch ALL.
    if (!isHQ) {
        queryRecords = queryRecords.where('Team', '==', currentUser.team);
    }

    const unsubRecords = queryRecords.onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as InstallationRecord));
        // Client-side sort
        data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRecords(data);
    }, err => console.error("Records error:", err));

    // 2. Fetch Users (DSRs)
    let queryUsers = db.collection('users').where('role', '==', 'dsr');
    
    // If NOT HQ, filter by team
    if (!isHQ) {
        queryUsers = queryUsers.where('team', '==', currentUser.team);
    }

    const unsubUsers = queryUsers.onSnapshot(snap => {
        setUsers(snap.docs.map(d => d.data() as UserProfile));
    }, err => console.error("Users error:", err));
      
    // 3. Fetch Announcements
    let queryAnnounce = db.collection('announcements');
    if (!isHQ) {
        queryAnnounce = queryAnnounce.where('team', '==', currentUser.team);
    }

    const unsubAnnounce = queryAnnounce.onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(data);
    }, err => console.error("Announcements error:", err));
      
    // 4. Fetch Incoming Messages (Always specific to the logged in user)
    const unsubMessages = db.collection('messages')
      .where('recipientUid', '==', currentUser.uid)
      .where('read', '==', false)
      .onSnapshot(snap => {
        setIncomingMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage)));
      }, err => console.error("Messages error:", err));

    return () => { unsubRecords(); unsubUsers(); unsubAnnounce(); unsubMessages(); };
  }, [currentUser, isHQ]);

  const getFilteredRecords = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return records.filter(r => {
      const d = new Date(r.updatedAt);
      if (timeRange === 'today') return d >= startOfDay;
      if (timeRange === 'week') return d >= startOfWeek;
      if (timeRange === 'month') return d >= startOfMonth;
      return true;
    });
  };

  const filteredRecords = getFilteredRecords();

  const stats = useMemo(() => {
    return {
      total: filteredRecords.length,
      installed: filteredRecords.filter(r => r.JobStatus === 'Installed').length,
      pending: filteredRecords.filter(r => r.JobStatus === 'Pending').length,
      rejected: filteredRecords.filter(r => r.JobStatus === 'Rejected').length,
    };
  }, [filteredRecords]);

  const handlePostAnnouncement = async () => {
    if(!newAnnouncement.title || !newAnnouncement.content) return;
    try {
      await db.collection('announcements').add({
        ...newAnnouncement,
        team: currentUser.team, // Bind to team
        createdAt: new Date().toISOString(),
        createdBy: currentUser.displayName
      });
      setNewAnnouncement({ title: '', content: '' });
      alert('Announcement Posted!');
    } catch (e: any) {
      alert("Error posting: " + e.message);
    }
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
    } catch (e) {
      console.error(e);
      alert('Failed to send message.');
    }
  };

  const markMessageRead = async (id: string) => {
    await db.collection('messages').doc(id).update({ read: true });
  };
  
  const handleReplyToMessage = (msg: DirectMessage) => {
    const user = users.find(u => u.uid === msg.senderUid);
    if (user) {
        markMessageRead(msg.id);
        setMessageTarget(user);
    } else {
        alert("User profile not found in your team list.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative">
      {/* Top Navigation */}
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
            <button 
              onClick={onSwitchToField}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
            >
              <Layout size={14} /> Enter Field Mode
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
        
        {/* Tab Bar */}
        <div className="bg-indigo-800/50 px-4">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={16}/>} label="Overview" />
            <TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<FileSpreadsheet size={16}/>} label="Data Reports" />
            <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<Users size={16}/>} label="Team Mgmt" />
            <TabButton active={activeTab === 'communicate'} onClick={() => setActiveTab('communicate')} icon={<Megaphone size={16}/>} label="Broadcast" badge={incomingMessages.length} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        
        {/* Date Filter (Global for Data/Overview) */}
        {(activeTab === 'overview' || activeTab === 'data') && (
          <div className="flex justify-end gap-2 mb-4">
             <FilterBtn active={timeRange === 'today'} onClick={() => setTimeRange('today')}>Today</FilterBtn>
             <FilterBtn active={timeRange === 'week'} onClick={() => setTimeRange('week')}>This Week</FilterBtn>
             <FilterBtn active={timeRange === 'month'} onClick={() => setTimeRange('month')}>This Month</FilterBtn>
             <FilterBtn active={timeRange === 'all'} onClick={() => setTimeRange('all')}>All Time</FilterBtn>
          </div>
        )}

        {/* Global Inbox Alert */}
        {incomingMessages.length > 0 && activeTab !== 'communicate' && (
             <div 
               onClick={() => setActiveTab('communicate')}
               className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg cursor-pointer flex justify-between items-center animate-pulse"
             >
                <div className="flex items-center gap-3">
                  <Bell className="text-yellow-300" /> 
                  <span className="font-bold">You have {incomingMessages.length} unread message(s).</span>
                </div>
                <span className="text-sm underline">View Inbox</span>
             </div>
        )}

        {/* --- VIEW: OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Submissions" value={stats.total} icon={<FileSpreadsheet />} color="bg-indigo-600" />
              <KpiCard label="Successful Installs" value={stats.installed} icon={<CheckCircle />} color="bg-emerald-600" />
              <KpiCard label="Pending Processing" value={stats.pending} icon={<Clock />} color="bg-amber-500" />
              <KpiCard label="Rejected / Dead" value={stats.rejected} icon={<XCircle />} color="bg-red-500" />
            </div>

            {/* Performance By User Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Top Performers ({timeRange})</h3>
              <div className="space-y-3">
                {users.map(u => {
                  const userCount = filteredRecords.filter(r => r.createdByUid === u.uid).length;
                  if (userCount === 0) return null;
                  const max = Math.max(...users.map(usr => filteredRecords.filter(r => r.createdByUid === usr.uid).length), 1);
                  const percent = (userCount / max) * 100;
                  
                  return (
                    <div key={u.uid} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium truncate">{u.displayName}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="w-10 text-right text-sm font-bold">{userCount}</div>
                    </div>
                  );
                })}
                {users.length === 0 && <p className="text-gray-400 text-sm">No active DSRs found.</p>}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: DATA REPORTS --- */}
        {activeTab === 'data' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-700">Master Data Grid</h2>
              <button 
                onClick={() => exportToCSV(filteredRecords)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium"
              >
                <Download size={18} /> Export CSV
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="p-3">Date</th>
                    {isHQ && <th className="p-3 bg-indigo-50 text-indigo-900">Team</th>}
                    <th className="p-3">DSR</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Road/Loc</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-3 whitespace-nowrap text-gray-500">{new Date(r.updatedAt).toLocaleDateString()}</td>
                      {isHQ && <td className="p-3 font-bold text-indigo-900 bg-indigo-50/50">{r.Team}</td>}
                      <td className="p-3 font-medium text-indigo-700">{r.DSR}</td>
                      <td className="p-3 font-medium">{r.Name}</td>
                      <td className="p-3 text-gray-500">{r.Contact}</td>
                      <td className="p-3 text-gray-500 truncate max-w-[150px]">{r.RoadName}</td>
                      <td className="p-3">
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                           r.JobStatus === 'Installed' ? 'bg-emerald-100 text-emerald-700' : 
                           r.JobStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                         }`}>
                           {r.JobStatus}
                         </span>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr><td colSpan={isHQ ? 7 : 6} className="p-8 text-center text-gray-400">No records found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW: TEAM --- */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
             <div className="col-span-full bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-blue-900">Invite DSRs</h3>
                  <p className="text-sm text-blue-700">DSRs can sign up on the login page and select <strong>{currentUser.team}</strong>.</p>
                </div>
                <div className="flex gap-2">
                   <div className="bg-white p-2 rounded-lg font-mono text-sm border border-blue-200 flex items-center">
                     DSRs: <strong>{users.length}</strong>
                   </div>
                </div>
             </div>

             {users.map(u => (
               <div key={u.uid} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4 relative">
                  <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">
                    {u.displayName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">{u.displayName}</h4>
                    <p className="text-xs text-gray-500">{u.team}</p>
                    <p className="text-xs text-gray-500 mt-1">{u.phoneNumber}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="text-right">
                      <span className="block text-xl font-bold text-gray-800">
                        {records.filter(r => r.createdByUid === u.uid).length}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Sales</span>
                    </div>
                    <button 
                      onClick={() => setMessageTarget(u)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100"
                      title="Send Message"
                    >
                      <MessageCircle size={16} />
                    </button>
                  </div>
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
                    <div key={msg.id} className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 shadow-sm relative group">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-indigo-900 text-xs">{msg.senderName}</h4>
                            <span className="text-[10px] text-indigo-400">{new Date(msg.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{msg.content}</p>
                        <div className="mt-2 flex gap-2">
                             <button 
                               onClick={() => handleReplyToMessage(msg)}
                               className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 flex-1"
                             >
                                Reply
                             </button>
                             <button 
                                onClick={() => markMessageRead(msg.id)}
                                className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300"
                             >
                                Mark Read
                             </button>
                        </div>
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
                    placeholder={isHQ ? "Broadcast to HQ team only..." : "Message to all DSRs..."}
                    value={newAnnouncement.content}
                    onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                 />
                 <button 
                  onClick={handlePostAnnouncement}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700"
                 >
                   Post Notice
                 </button>
               </div>
            </div>

            {/* List Posts */}
            <div className="md:col-span-1 space-y-4">
               <h3 className="font-bold text-gray-700">Notice Board History</h3>
               {announcements.map(a => (
                 <div key={a.id} className="bg-white border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900">{a.title}</h4>
                      <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{a.content}</p>
                    <div className="mt-2 text-xs text-gray-400">Posted by {a.createdBy}</div>
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
              <button 
                onClick={handleSendMessage}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
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
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${active ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white hover:bg-white/5'}`}
  >
    {icon} {label}
    {badge > 0 && (
      <span className="absolute -top-0 right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
        {badge}
      </span>
    )}
  </button>
);

const FilterBtn = ({active, children, onClick}: any) => (
  <button 
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
  >
    {children}
  </button>
);

const KpiCard = ({ label, value, icon, color }: any) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${color}`}>
      {icon}
    </div>
    <div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 font-medium uppercase">{label}</div>
    </div>
  </div>
);

export default SupervisorDashboard;
