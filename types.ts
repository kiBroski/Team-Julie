
export type JobStatus = 'Forwarded' | 'Pending' | 'Installed' | 'Rejected' | 'Lead' | '';
export type FiberReady = 'Yes' | 'No' | '';
export type UserRole = 'dsr' | 'supervisor';

// Hardcoded Team List
export const VALID_TEAMS = [
  "Julia",
  "BigTex",
  "Straton",
  "SkyReighn",
  "HQ"
];

export interface UserProfile {
  uid: string;
  displayName: string;
  phoneNumber: string;
  team: string;
  email: string;
  role: UserRole; // Added role
}

export interface InstallationRecord {
  id: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  edited: boolean;
  source: 'manual' | 'whatsapp';
  
  // Data Fields
  Title: string;
  Name: string;
  Contact: string;
  AltContact: string;
  Email: string;
  IdNo: string;
  RoadName: string;
  Address: string;
  FloorNo: string;
  House: string;
  FAT: string;
  coordinates: string; // "lat,lng"
  fiberReady: FiberReady;
  JobStatus: JobStatus;
  AccountNumber: string;
  DSR: string;
  DSRContacts: string;
  Team: string;
  Comment: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdByUid: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
  team: string; // Added team scope
}

export interface DirectMessage {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderName: string; // Supervisor Name
  content: string;
  read: boolean;
  createdAt: string;
}

export enum ViewState {
  Dashboard,
  Form,
  Notes,
  Login,
  SupervisorMode // New view state
}

export interface MapSearchResult {
  lat: string;
  lon: string;
  display_name: string;
}
