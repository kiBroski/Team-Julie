import React, { useMemo, useEffect, useState } from 'react';
import { InstallationRecord, JobStatus, Announcement, DirectMessage, UserProfile } from '../types';
import { db } from '../firebase';
import { Edit2, Trash2, Search, Download, RefreshCw, Megaphone, Bell, Check, X, Reply, Send, UserCog } from 'lucide-react';

interface DashboardProps {
  records: InstallationRecord[];
  currentUser: UserProfile | null;
  onEdit: (r: InstallationRecord) => void;
  onDelete: (id: string) => void;
  onSync: () => void;
  onExport: () => void;
  onNew: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ records, currentUser, onEdit, onDelete, onSync, onExport, onNew }) => {
  const [filter, setFilter] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | 'All'>('All');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  
  // Messaging State
  const [replyTarget, setReplyTarget] = useState<DirectMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  
  // New Message to Supervisor State
  const [supervisor, setSupervisor] = useState<UserProfile | null>(null);
  const [isMessagingSupervisor, setIsMessagingSupervisor] = useState(false);
  const [supervisorMsgText, setSupervisorMsgText] = useState('');

  useEffect(() => {
    if (!currentUser?.team) return;

    // 1. Listen for announcements
    // FIX: Filter by team to match Security Rules and remove orderBy to prevent index errors
    const unsubAnnounce = db.collection('announcements')
      .where('team', '==', currentUser.team)
      .onSnapshot(snap => {
        const data = snap.docs.map(d => ({id: d.id, ...d.data()} as Announcement));
        // Sort client-side
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(data.slice(0, 1)); // Take the latest one
      }, err => console.log("Announce error", err));

    // 2. Listen for Private Messages (Unread or recent)
    let unsubMsg = () => {};
    if (currentUser?.uid) {
      unsubMsg = db.collection('messages')
        .where('recipientUid', '==', currentUser.uid)
        .where('read', '==', false)
        .limit(5)
        .onSnapshot(snap => {
          setMessages(snap.docs.map(d => ({id: d.id, ...d.data()} as DirectMessage)));
        }, err => console.log("Msg error", err));
    }

    // 3. Find My Supervisor
    let unsubSuper = () => {};
    if (currentUser?.team) {
       unsubSuper = db.collection('users')
         .where('team', '==', currentUser.team)
         .where('role', '==', 'supervisor')
         .limit(1)
         .onSnapshot(snap => {
           if (!snap.empty) {
             setSupervisor(snap.docs[0].data() as UserProfile);
           }
         }, err => console.log("Supervisor lookup error", err));
    }

    return () => { unsubAnnounce(); unsubMsg(); unsubSuper(); };
  }, [currentUser]);

  const markMessageRead = async (id: string) => {
    try {
      await db.collection('messages').doc(id).update({ read: true });
    } catch (e) {
      console.error("Error marking read", e);
    }
  };

  const handleSendReply = async () => {
    if (!replyTarget || !currentUser || !replyText.trim()) return;

    try {
      await db.collection('messages').add({
        recipientUid: replyTarget.senderUid, // Replying to the sender
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: replyText,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      // Auto-mark the original message as read when replying
      await markMessageRead(replyTarget.id);
      
      setReplyTarget(null);
      setReplyText('');
      alert("Reply sent successfully.");
    } catch (e) {
      console.error("Error sending reply", e);
      alert("Failed to send reply.");
    }
  };

  const handleSendToSupervisor = async () => {
    if (!supervisor || !currentUser || !supervisorMsgText.trim()) return;

    try {
      await db.collection('messages').add({
        recipientUid: supervisor.uid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: supervisorMsgText,
        read: false,
        createdAt: new Date().toISOString()
      });
      setIsMessagingSupervisor(false);
      setSupervisorMsgText('');
      alert("Message sent to Supervisor.");
    } catch (e) {
      console.error("Error sending to supervisor", e);
      alert("Failed to send.");
    }
  }

  const stats = useMemo(() => {
    return {
      pending: records.filter(r => r.JobStatus === 'Pending').length,
      installed: records.filter(r => r.JobStatus === 'Installed').length,
      rejected: records.filter(r => r.JobStatus === 'Rejected').length,
      lead: records.filter(r => r.JobStatus === 'Lead').length,
      unsynced: records.filter(r => !r.synced).length,
      total: records.length
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = filter.toLowerCase();
    return records
      .filter(r => statusFilter === 'All' || r.JobStatus === statusFilter)
      .filter(r => 
        r.Name.toLowerCase().includes(q) || 
        r.Contact.includes(q) || 
        r.Address.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [records, filter, statusFilter]);

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* 1. Private Messages (Priority) */}
      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex flex-col gap-3 animate-fade-in">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="p-2 bg-indigo-500 rounded-lg h-fit">
                    <Bell size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Message from {msg.senderName || 'Supervisor'}</h4>
                    <p className="text-indigo-100 text-sm mt-1">{msg.content}</p>
                  </div>
                </div>
                <button 
                  onClick={() => markMessageRead(msg.id)}
                  className="p-1 hover:bg-indigo-500 rounded text-indigo-200 hover:text-white"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={() => setReplyTarget(msg)}
                  className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-50"
                >
                  <Reply size={12} /> Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Announcements Banner */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start shadow-sm">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
            <Megaphone size={20} />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Team Notice: {announcements[0].title}</h4>
            <p className="text-amber-800 text-sm mt-1">{announcements[0].content}</p>
            <p className="text-xs text-amber-600/70 mt-1">{new Date(announcements[0].createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {/* Contact Supervisor Button */}
      {supervisor && (
        <div className="flex justify-end">
            <button 
                onClick={() => setIsMessagingSupervisor(true)}
                className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
            >
                <UserCog size={16} /> Contact Supervisor ({supervisor.displayName})
            </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Pending" value={stats.pending} color="bg-amber-500" />
        <StatBox label="Lead" value={stats.lead} color="bg-blue-500" />
        <StatBox label="Installed" value={stats.installed} color="bg-emerald-500" />
        <StatBox label="Rejected" value={stats.rejected} color="bg-red-500" />
        <StatBox label="Total" value={stats.total} color="bg-indigo-600" />
        <StatBox label="Unsynced" value={stats.unsynced} color="bg-gray-600" />
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
        <button onClick={onNew} className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-indigo-700 whitespace-nowrap">
          ➕ New
        </button>
        <button onClick={onExport} className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-emerald-700 whitespace-nowrap flex items-center justify-center gap-2">
          <Download size={18} /> CSV
        </button>
        <button onClick={onSync} className="flex-1 bg-gray-800 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-900 whitespace-nowrap flex items-center justify-center gap-2">
          <RefreshCw size={18} /> Sync
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="w-full pl-10 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Search name, contact, address..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select 
          className="p-2.5 rounded-lg border border-gray-300 bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'All')}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Lead">Lead</option>
          <option value="Installed">Installed</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredRecords.map(r => (
          <div key={r.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex justify-between items-start pr-2">
                <div>
                   <h4 className="font-bold text-gray-800">{r.Name}</h4>
                   <p className="text-sm text-gray-500">{r.Contact}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(r.JobStatus)}`}>
                  {r.JobStatus || 'Pending'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{r.RoadName} {r.Address ? `• ${r.Address}` : ''}</p>
              
              {/* Alert for missing Account Number on Installed jobs */}
              {r.JobStatus === 'Installed' && !r.AccountNumber && (
                <div className="mt-2 text-xs bg-red-50 text-red-600 px-2 py-1 rounded w-fit font-bold border border-red-100 flex items-center gap-1">
                  ⚠️ Missing Account #
                </div>
              )}

              <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                 <span>{r.synced ? '✅ Synced' : '⏳ Unsynced'}</span>
                 {r.edited && <span>• ✏️ Edited</span>}
                 <span>• {new Date(r.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 ml-2">
               <button onClick={() => onEdit(r)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"><Edit2 size={18} /></button>
               <button onClick={() => onDelete(r.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
        {filteredRecords.length === 0 && (
          <div className="text-center py-10 text-gray-400">No records found.</div>
        )}
      </div>

      {/* Reply Modal */}
      {(replyTarget || isMessagingSupervisor) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="bg-indigo-900 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="font-bold">
                  {replyTarget ? `Reply to ${replyTarget.senderName}` : `Message ${supervisor?.displayName}`}
              </h3>
              <button 
                  onClick={() => {
                      setReplyTarget(null);
                      setIsMessagingSupervisor(false);
                  }} 
                  className="text-indigo-200 hover:text-white"
              >
                  <X size={20}/>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {replyTarget && (
                  <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 italic border border-gray-100">
                    "{replyTarget.content}"
                  </div>
              )}
              <textarea 
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder={replyTarget ? "Type your reply..." : "Type message to supervisor..."}
                value={replyTarget ? replyText : supervisorMsgText}
                onChange={e => replyTarget ? setReplyText(e.target.value) : setSupervisorMsgText(e.target.value)}
              />
              <button 
                onClick={replyTarget ? handleSendReply : handleSendToSupervisor}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Send size={18} /> Send
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const StatBox = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className={`${color} text-white p-3 rounded-xl text-center shadow-md`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs uppercase opacity-90 font-medium">{label}</div>
  </div>
);

const getStatusColor = (status: JobStatus) => {
  switch (status) {
    case 'Installed': return 'bg-emerald-100 text-emerald-700';
    case 'Rejected': return 'bg-red-100 text-red-700';
    case 'Pending': return 'bg-amber-100 text-amber-700';
    case 'Lead': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export default Dashboard;